import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { ExtractionBatch, License } from "@/models";
import { recordAudit } from "../audit";

const createInput = z.object({
  licenseId: z.string(),
  locationId: z.string(),
  extractedDate: z.date(),
  grossTonnage: z.number().positive(),
  operatorUserId: z.string().optional(),
  vehicleId: z.string().optional(),
  notes: z.string().optional(),
});

export const extractionRouter = router({
  list: requirePermission("extraction.read")
    .input(
      z
        .object({
          status: z.string().optional(),
          licenseId: z.string().optional(),
          locationId: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          limit: z.number().default(100),
          skip: z.number().default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.status) filter.status = input.status;
      if (input?.licenseId) filter.licenseId = input.licenseId;
      if (input?.locationId) filter.locationId = input.locationId;
      if (input?.from || input?.to) {
        filter.extractedDate = {};
        if (input.from) filter.extractedDate.$gte = input.from;
        if (input.to) filter.extractedDate.$lte = input.to;
      }
      const limit = input?.limit ?? 100;
      const skip = input?.skip ?? 0;
      const [items, total] = await Promise.all([
        ExtractionBatch.find(filter)
          .populate("licenseId", "licenseNumber")
          .populate("locationId", "name")
          .populate("operatorUserId", "name")
          .populate("vehicleId", "registrationNumber")
          .sort({ extractedDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ExtractionBatch.countDocuments(filter),
      ]);
      return {
        items: items.map((b: any) => ({
          ...b,
          grossTonnage: Number(b.grossTonnage?.toString() ?? 0),
        })),
        total,
      };
    }),

  byId: requirePermission("extraction.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const b = await ExtractionBatch.findById(input.id)
        .populate("licenseId", "licenseNumber permittedTonnage usedTonnage royaltyRatePerUnit")
        .populate("locationId", "name")
        .populate("operatorUserId", "name email")
        .populate("vehicleId", "registrationNumber")
        .lean();
      if (!b) throw new TRPCError({ code: "NOT_FOUND" });
      return b;
    }),

  create: requirePermission("extraction.create")
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const license: any = await License.findById(input.licenseId);
      if (!license) throw new TRPCError({ code: "BAD_REQUEST", message: "License not found" });
      if (license.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `License is ${license.status}. Only ACTIVE licenses accept extraction.`,
        });
      }

      const permitted = Number(license.permittedTonnage?.toString() ?? 0);
      const used = Number(license.usedTonnage?.toString() ?? 0);
      const remaining = permitted - used;
      if (input.grossTonnage > remaining) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Exceeds remaining license tonnage (${remaining.toFixed(3)} available, ${input.grossTonnage} requested).`,
        });
      }

      const royaltyAmount = Math.round(
        input.grossTonnage * (license.royaltyRatePerUnit ?? 0),
      );

      const batch = await ExtractionBatch.create({
        ...input,
        royaltyAmount,
        status: "PENDING",
      });

      // Decrement license usage atomically
      await License.findByIdAndUpdate(input.licenseId, {
        $inc: { usedTonnage: input.grossTonnage },
      });

      await recordAudit({
        action: "extraction.create",
        entityType: "ExtractionBatch",
        entityId: String(batch._id),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(batch._id), royaltyAmount };
    }),

  setStatus: requirePermission("extraction.update")
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["AT_REFINERY", "REFINED"]),
      }),
    )
    .mutation(async ({ input }) => {
      const before: any = await ExtractionBatch.findById(input.id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      if (before.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cancelled batches cannot change status.",
        });
      }
      before.status = input.status;
      await before.save();
      return { ok: true };
    }),

  cancel: requirePermission("extraction.update")
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(2),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const batch: any = await ExtractionBatch.findById(input.id);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
      if (batch.status === "CANCELLED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already cancelled." });
      }
      if (batch.status === "REFINED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot cancel a refined batch.",
        });
      }
      const tonnage = Number(batch.grossTonnage?.toString() ?? 0);
      batch.status = "CANCELLED";
      batch.cancellationReason = input.reason;
      await batch.save();
      // Refund the license tonnage
      await License.findByIdAndUpdate(batch.licenseId, {
        $inc: { usedTonnage: -tonnage },
      });
      await recordAudit({
        action: "extraction.cancel",
        entityType: "ExtractionBatch",
        entityId: input.id,
        previousValue: { status: "PENDING" },
        newValue: { status: "CANCELLED", reason: input.reason },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),
});
