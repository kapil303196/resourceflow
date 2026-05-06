import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { License, LicenseConditionLog, ExtractionBatch } from "@/models";
import { recordAudit } from "../audit";
import { tenantStamp } from "../tenant-stamp";

const createInput = z.object({
  locationId: z.string(),
  licenseNumber: z.string().min(1),
  issuingAuthority: z.string().optional(),
  issuedBy: z.string().optional(),
  validFrom: z.date(),
  validTo: z.date(),
  permittedTonnage: z.number().min(0),
  royaltyRatePerUnit: z.number().min(0).default(0),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "RENEWED"]).default("ACTIVE"),
  renewalReminderDays: z.number().min(0).default(30),
  restrictions: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export const licenseRouter = router({
  list: requirePermission("license.read")
    .input(
      z
        .object({
          status: z.string().optional(),
          locationId: z.string().optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.status) filter.status = input.status;
      if (input?.locationId) filter.locationId = input.locationId;
      if (input?.search) filter.licenseNumber = { $regex: input.search, $options: "i" };
      const items = await License.find(filter)
        .populate("locationId", "name type")
        .sort({ validTo: 1 })
        .lean();
      const now = new Date();
      return items.map((l: any) => ({
        ...l,
        permittedTonnage: Number(l.permittedTonnage?.toString() ?? 0),
        usedTonnage: Number(l.usedTonnage?.toString() ?? 0),
        utilization:
          Number(l.usedTonnage?.toString() ?? 0) /
          Math.max(Number(l.permittedTonnage?.toString() ?? 1), 1),
        daysToExpiry: Math.ceil(
          (new Date(l.validTo).getTime() - now.getTime()) / 86_400_000,
        ),
      }));
    }),

  byId: requirePermission("license.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const lic = await License.findById(input.id)
        .populate("locationId", "name type")
        .lean();
      if (!lic) throw new TRPCError({ code: "NOT_FOUND" });
      return lic;
    }),

  create: requirePermission("license.create")
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      if (input.validTo <= input.validFrom) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "validTo must be after validFrom",
        });
      }
      const doc = await License.create({ ...input, ...tenantStamp() });
      await recordAudit({
        action: "license.create",
        entityType: "License",
        entityId: String(doc._id),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(doc._id) };
    }),

  update: requirePermission("license.update")
    .input(z.object({ id: z.string() }).and(createInput.partial()))
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input as any;
      const before = await License.findById(id).lean();
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const after = await License.findByIdAndUpdate(id, { $set: rest }, { new: true }).lean();
      await recordAudit({
        action: "license.update",
        entityType: "License",
        entityId: id,
        previousValue: before,
        newValue: after,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  delete: requirePermission("license.delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const usage = await ExtractionBatch.countDocuments({
        licenseId: new Types.ObjectId(input.id),
        status: { $ne: "CANCELLED" },
      });
      if (usage > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot delete: ${usage} extraction batch(es) reference this license.`,
        });
      }
      await License.findByIdAndUpdate(input.id, { $set: { isDeleted: true } });
      await recordAudit({
        action: "license.delete",
        entityType: "License",
        entityId: input.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  // Compliance condition log
  conditionLogs: requirePermission("license.read")
    .input(z.object({ licenseId: z.string() }))
    .query(async ({ input }) => {
      return LicenseConditionLog.find({ licenseId: input.licenseId })
        .populate("recordedByUserId", "name")
        .sort({ checkDate: -1 })
        .lean();
    }),

  addConditionLog: requirePermission("license.update")
    .input(
      z.object({
        licenseId: z.string(),
        checkDate: z.date(),
        conditionType: z.enum([
          "TONNAGE_REPORT",
          "INSPECTION",
          "ROYALTY_PAYMENT",
          "RENEWAL",
          "VIOLATION",
        ]),
        status: z.string().default("OK"),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const log = await LicenseConditionLog.create({
        ...input,
        ...tenantStamp(),
        recordedByUserId: ctx.user.id,
      });
      return { id: String(log._id) };
    }),
});
