import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { InventoryLedger } from "@/models";
import { recordAudit } from "../audit";
import { connectMongo, mongoose } from "@/lib/mongo";
import { tenantContext } from "@/lib/tenant-context";

export const inventoryRouter = router({
  /**
   * Aggregated current stock by grade × location.
   * Sum of (IN, OPENING, TRANSFER_IN, ADJUSTMENT) - (OUT, TRANSFER_OUT)
   */
  currentStock: requirePermission("inventory.read")
    .input(
      z
        .object({
          locationId: z.string().optional(),
          materialGradeId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const match: any = {};
      if (input?.locationId) match.locationId = new Types.ObjectId(input.locationId);
      if (input?.materialGradeId)
        match.materialGradeId = new Types.ObjectId(input.materialGradeId);
      const pipeline: any[] = [
        { $match: match },
        {
          $project: {
            materialGradeId: 1,
            locationId: 1,
            transactionType: 1,
            qty: { $toDouble: "$quantity" },
          },
        },
        {
          $group: {
            _id: {
              materialGradeId: "$materialGradeId",
              locationId: "$locationId",
            },
            inSum: {
              $sum: {
                $cond: [
                  { $in: ["$transactionType", ["IN", "OPENING", "TRANSFER_IN"]] },
                  "$qty",
                  0,
                ],
              },
            },
            outSum: {
              $sum: {
                $cond: [
                  { $in: ["$transactionType", ["OUT", "TRANSFER_OUT"]] },
                  "$qty",
                  0,
                ],
              },
            },
            adjustmentSum: {
              $sum: {
                $cond: [{ $eq: ["$transactionType", "ADJUSTMENT"] }, "$qty", 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            materialGradeId: "$_id.materialGradeId",
            locationId: "$_id.locationId",
            quantity: { $add: ["$inSum", "$adjustmentSum", { $multiply: ["$outSum", -1] }] },
          },
        },
        {
          $lookup: {
            from: "materialgrades",
            localField: "materialGradeId",
            foreignField: "_id",
            as: "grade",
          },
        },
        {
          $lookup: {
            from: "locations",
            localField: "locationId",
            foreignField: "_id",
            as: "location",
          },
        },
        {
          $project: {
            materialGradeId: 1,
            locationId: 1,
            quantity: 1,
            gradeName: { $arrayElemAt: ["$grade.name", 0] },
            gradeColor: { $arrayElemAt: ["$grade.color", 0] },
            pricePerUnit: { $arrayElemAt: ["$grade.pricePerUnit", 0] },
            locationName: { $arrayElemAt: ["$location.name", 0] },
            locationType: { $arrayElemAt: ["$location.type", 0] },
          },
        },
        { $sort: { gradeName: 1, locationName: 1 } },
      ];
      return InventoryLedger.aggregate(pipeline);
    }),

  ledger: requirePermission("inventory.read")
    .input(
      z
        .object({
          materialGradeId: z.string().optional(),
          locationId: z.string().optional(),
          transactionType: z.string().optional(),
          referenceType: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          limit: z.number().default(100),
          skip: z.number().default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.materialGradeId) filter.materialGradeId = input.materialGradeId;
      if (input?.locationId) filter.locationId = input.locationId;
      if (input?.transactionType) filter.transactionType = input.transactionType;
      if (input?.referenceType) filter.referenceType = input.referenceType;
      if (input?.from || input?.to) {
        filter.transactionDate = {};
        if (input.from) filter.transactionDate.$gte = input.from;
        if (input.to) filter.transactionDate.$lte = input.to;
      }
      const limit = input?.limit ?? 100;
      const skip = input?.skip ?? 0;
      const [items, total] = await Promise.all([
        InventoryLedger.find(filter)
          .populate("materialGradeId", "name color")
          .populate("locationId", "name type")
          .populate("userId", "name")
          .sort({ transactionDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        InventoryLedger.countDocuments(filter),
      ]);
      return {
        items: items.map((i: any) => ({
          ...i,
          quantity: Number(i.quantity?.toString() ?? 0),
        })),
        total,
      };
    }),

  adjustment: requirePermission("inventory.update")
    .input(
      z.object({
        materialGradeId: z.string(),
        locationId: z.string(),
        quantity: z.number(), // can be negative
        reason: z.string().min(2),
        transactionDate: z.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const entry = await InventoryLedger.create({
        materialGradeId: input.materialGradeId,
        locationId: input.locationId,
        transactionType: "ADJUSTMENT",
        quantity: input.quantity,
        notes: input.reason,
        transactionDate: input.transactionDate ?? new Date(),
        referenceType: "MANUAL_ADJUSTMENT",
        userId: ctx.user.id,
      });
      await recordAudit({
        action: "inventory.adjustment",
        entityType: "InventoryLedger",
        entityId: String(entry._id),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(entry._id) };
    }),

  transfer: requirePermission("inventory.update")
    .input(
      z.object({
        materialGradeId: z.string(),
        fromLocationId: z.string(),
        toLocationId: z.string(),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.fromLocationId === input.toLocationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "From and To locations must differ.",
        });
      }
      await connectMongo();
      const session = await mongoose.startSession();
      const ref = new Types.ObjectId();
      try {
        await session.withTransaction(async () => {
          await InventoryLedger.create(
            [
              {
                tenantId: ctx.user.tenantId,
                materialGradeId: input.materialGradeId,
                locationId: input.fromLocationId,
                transactionType: "TRANSFER_OUT",
                quantity: input.quantity,
                notes: input.notes ?? "",
                referenceType: "TRANSFER",
                referenceId: ref,
                transactionDate: new Date(),
                userId: ctx.user.id,
                createdBy: ctx.user.id,
                updatedBy: ctx.user.id,
              },
              {
                tenantId: ctx.user.tenantId,
                materialGradeId: input.materialGradeId,
                locationId: input.toLocationId,
                transactionType: "TRANSFER_IN",
                quantity: input.quantity,
                notes: input.notes ?? "",
                referenceType: "TRANSFER",
                referenceId: ref,
                transactionDate: new Date(),
                userId: ctx.user.id,
                createdBy: ctx.user.id,
                updatedBy: ctx.user.id,
              },
            ],
            { session, ordered: true },
          );
        });
      } finally {
        await session.endSession();
      }
      await recordAudit({
        action: "inventory.transfer",
        entityType: "InventoryLedger",
        entityId: String(ref),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true, referenceId: String(ref) };
    }),

  /**
   * Add an OPENING balance entry. Used during onboarding/seed.
   */
  recordOpening: requirePermission("inventory.update")
    .input(
      z.object({
        materialGradeId: z.string(),
        locationId: z.string(),
        quantity: z.number(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const entry = await InventoryLedger.create({
        materialGradeId: input.materialGradeId,
        locationId: input.locationId,
        transactionType: "OPENING",
        quantity: input.quantity,
        notes: input.notes ?? "Opening balance",
        transactionDate: new Date(),
        referenceType: "OPENING",
        userId: ctx.user.id,
      });
      return { id: String(entry._id) };
    }),
});
