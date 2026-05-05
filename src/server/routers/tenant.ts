import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { Tenant } from "@/models";
import { tenantContext } from "@/lib/tenant-context";

export const tenantRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return tenantContext.run(
      { tenantId: ctx.user.tenantId, userId: ctx.user.id, permissions: [], systemBypass: true },
      () => Tenant.findById(ctx.user.tenantId).lean(),
    );
  }),

  update: requirePermission("settings.update")
    .input(
      z.object({
        name: z.string().min(2).optional(),
        industryType: z.string().min(2).optional(),
        materialName: z.string().min(1).optional(),
        unitOfMeasure: z.string().min(1).optional(),
        currency: z.string().min(2).optional(),
        timezone: z.string().min(2).optional(),
        logoS3Key: z.string().optional(),
        settings: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return tenantContext.run(
        { tenantId: ctx.user.tenantId, userId: ctx.user.id, permissions: ["*"], systemBypass: true },
        () =>
          Tenant.findByIdAndUpdate(
            ctx.user.tenantId,
            { $set: input },
            { new: true },
          ).lean(),
      );
    }),
});
