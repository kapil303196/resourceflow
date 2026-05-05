import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { Tenant, AlertRule } from "@/models";
import {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  buildS3Key,
} from "@/lib/s3";

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const tenant: any = await Tenant.findById(ctx.user.tenantId).lean();
    return tenant;
  }),

  update: requirePermission("settings.update")
    .input(
      z.object({
        name: z.string().min(2).optional(),
        industryType: z.string().optional(),
        materialName: z.string().optional(),
        unitOfMeasure: z.string().optional(),
        currency: z.string().optional(),
        timezone: z.string().optional(),
        logoS3Key: z.string().optional(),
        settings: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await Tenant.findByIdAndUpdate(ctx.user.tenantId, { $set: input });
      return { ok: true };
    }),

  /** Logo upload presigned PUT. */
  presignedLogoUpload: requirePermission("settings.update")
    .input(
      z.object({
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const key = buildS3Key({
        tenantId: ctx.user.tenantId,
        entityType: "TENANT_LOGO",
        entityId: ctx.user.tenantId,
        fileName: input.fileName,
      });
      const presigned = await generatePresignedPutUrl({
        key,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
      return { ...presigned, key };
    }),

  logoUrl: protectedProcedure.query(async ({ ctx }) => {
    const tenant: any = await Tenant.findById(ctx.user.tenantId).lean();
    if (!tenant?.logoS3Key) return null;
    return generatePresignedGetUrl(tenant.logoS3Key);
  }),

  alertRules: requirePermission("settings.read").query(() =>
    AlertRule.find({}).sort({ alertType: 1 }).lean(),
  ),
});
