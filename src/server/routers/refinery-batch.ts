import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import {
  RefineryBatch,
  ExtractionBatch,
  PurchaseDelivery,
  InventoryLedger,
} from "@/models";
import { recordAudit } from "../audit";
import { connectMongo, mongoose } from "@/lib/mongo";

const outputSchema = z.object({
  materialGradeId: z.string(),
  tonnage: z.number().min(0),
  locationId: z.string(),
});

const createInput = z.object({
  refineryId: z.string(),
  sourceType: z.enum(["EXTRACTION", "PURCHASE"]),
  sourceId: z.string(),
  processedDate: z.date(),
  inputTonnage: z.number().positive(),
  processingLoss: z.number().min(0).default(0),
  operatorUserId: z.string().optional(),
  outputs: z.array(outputSchema).min(1),
  notes: z.string().optional(),
});

export const refineryBatchRouter = router({
  list: requirePermission("refineryBatch.read")
    .input(
      z
        .object({
          refineryId: z.string().optional(),
          status: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.refineryId) filter.refineryId = input.refineryId;
      if (input?.status) filter.status = input.status;
      if (input?.from || input?.to) {
        filter.processedDate = {};
        if (input.from) filter.processedDate.$gte = input.from;
        if (input.to) filter.processedDate.$lte = input.to;
      }
      const items = await RefineryBatch.find(filter)
        .populate("refineryId", "name")
        .populate("operatorUserId", "name")
        .sort({ processedDate: -1 })
        .lean();
      return items.map((b: any) => ({
        ...b,
        inputTonnage: Number(b.inputTonnage?.toString() ?? 0),
        processingLoss: Number(b.processingLoss?.toString() ?? 0),
        outputs: (b.outputs ?? []).map((o: any) => ({
          ...o,
          tonnage: Number(o.tonnage?.toString() ?? 0),
        })),
      }));
    }),

  byId: requirePermission("refineryBatch.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const b: any = await RefineryBatch.findById(input.id)
        .populate("refineryId", "name")
        .populate("operatorUserId", "name email")
        .lean();
      if (!b) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...b,
        inputTonnage: Number(b.inputTonnage?.toString() ?? 0),
        processingLoss: Number(b.processingLoss?.toString() ?? 0),
        outputs: (b.outputs ?? []).map((o: any) => ({
          ...o,
          tonnage: Number(o.tonnage?.toString() ?? 0),
        })),
      };
    }),

  /** Extraction and purchase deliveries that haven't been refined yet. */
  unrefinedQueue: requirePermission("refineryBatch.read").query(async () => {
    const [extractions, deliveries] = await Promise.all([
      ExtractionBatch.find({ status: { $in: ["PENDING", "AT_REFINERY"] } })
        .populate("locationId", "name")
        .populate("licenseId", "licenseNumber")
        .sort({ extractedDate: -1 })
        .limit(100)
        .lean(),
      PurchaseDelivery.find({ refineryProcessed: { $ne: true } })
        .populate("purchaseOrderId", "poNumber")
        .populate("locationId", "name")
        .sort({ deliveredDate: -1 })
        .limit(100)
        .lean(),
    ]);
    return {
      extractions: extractions.map((e: any) => ({
        _id: e._id,
        sourceType: "EXTRACTION",
        date: e.extractedDate,
        tonnage: Number(e.grossTonnage?.toString() ?? 0),
        location: e.locationId?.name,
        ref: e.licenseId?.licenseNumber,
        status: e.status,
      })),
      deliveries: deliveries.map((d: any) => {
        const tonnage = (d.items ?? []).reduce(
          (s: number, it: any) => s + Number(it.actualTonnage?.toString() ?? 0),
          0,
        );
        return {
          _id: d._id,
          sourceType: "PURCHASE",
          date: d.deliveredDate,
          tonnage,
          location: d.locationId?.name,
          ref: d.purchaseOrderId?.poNumber,
        };
      }),
    };
  }),

  create: requirePermission("refineryBatch.create")
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const outputSum = input.outputs.reduce((s, o) => s + o.tonnage, 0);
      const expected = input.inputTonnage - input.processingLoss;
      const tolerance = expected * 0.001;
      if (Math.abs(outputSum - expected) > tolerance) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Output sum ${outputSum.toFixed(3)} must equal input - loss = ${expected.toFixed(3)} (within 0.1%).`,
        });
      }
      const batch = await RefineryBatch.create({
        ...input,
        operatorUserId: input.operatorUserId ?? ctx.user.id,
        status: "IN_PROGRESS",
      });
      await recordAudit({
        action: "refineryBatch.create",
        entityType: "RefineryBatch",
        entityId: String(batch._id),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(batch._id) };
    }),

  /**
   * Mark COMPLETED — atomically posts InventoryLedger IN entries
   * for each output and flips source status.
   */
  complete: requirePermission("refineryBatch.update")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const batch: any = await RefineryBatch.findById(input.id);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
      if (batch.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already completed.",
        });
      }
      if (batch.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot complete a cancelled batch.",
        });
      }

      await connectMongo();
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Post inventory IN
          const ledgerDocs = (batch.outputs ?? []).map((o: any) => ({
            tenantId: ctx.user.tenantId,
            materialGradeId: o.materialGradeId,
            locationId: o.locationId,
            transactionType: "IN",
            quantity: Number(o.tonnage?.toString() ?? 0),
            referenceType: "REFINERY_BATCH",
            referenceId: batch._id,
            transactionDate: batch.processedDate ?? new Date(),
            userId: ctx.user.id,
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
            notes: `Refined batch`,
          }));
          if (ledgerDocs.length) {
            await InventoryLedger.insertMany(ledgerDocs, { session });
          }

          // Update source status
          if (batch.sourceType === "EXTRACTION") {
            await ExtractionBatch.findByIdAndUpdate(
              batch.sourceId,
              { $set: { status: "REFINED" } },
              { session },
            );
          } else if (batch.sourceType === "PURCHASE") {
            await PurchaseDelivery.findByIdAndUpdate(
              batch.sourceId,
              { $set: { refineryProcessed: true } },
              { session },
            );
          }

          // Flip batch status
          await RefineryBatch.findByIdAndUpdate(
            batch._id,
            { $set: { status: "COMPLETED" } },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      await recordAudit({
        action: "refineryBatch.complete",
        entityType: "RefineryBatch",
        entityId: String(batch._id),
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  cancel: requirePermission("refineryBatch.update")
    .input(z.object({ id: z.string(), reason: z.string().min(2) }))
    .mutation(async ({ input }) => {
      const batch: any = await RefineryBatch.findById(input.id);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
      if (batch.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot cancel a completed batch.",
        });
      }
      batch.status = "CANCELLED";
      batch.notes = `${batch.notes ?? ""}\nCANCELLED: ${input.reason}`.trim();
      await batch.save();
      return { ok: true };
    }),
});
