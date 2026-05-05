import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { router, publicProcedure } from "../trpc";
import { Tenant, User, Role } from "@/models";
import { tenantContext } from "@/lib/tenant-context";
import { ROLE_TEMPLATES } from "@/lib/permissions";
import { sendEmail, emailTemplates } from "@/lib/email";
import { env } from "@/lib/env";
import { TRPCError } from "@trpc/server";

const onboardingInput = z.object({
  // Tenant
  companyName: z.string().min(2),
  industryType: z.string().min(2),
  materialName: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  currency: z.string().min(2),
  timezone: z.string().min(2),
  // Owner user
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
});

export const authRouter = router({
  register: publicProcedure
    .input(onboardingInput)
    .mutation(async ({ input }) => {
      const existing = await tenantContext.run(
        { tenantId: "", userId: "", permissions: [], systemBypass: true },
        () => User.findOne({ email: input.ownerEmail.toLowerCase() }).lean(),
      );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const tenant = await Tenant.create({
        name: input.companyName,
        industryType: input.industryType,
        materialName: input.materialName,
        unitOfMeasure: input.unitOfMeasure,
        currency: input.currency,
        timezone: input.timezone,
        subscriptionStatus: "TRIAL",
        isActive: true,
      });

      // Run subsequent writes inside this tenant's context
      const result = await tenantContext.run(
        {
          tenantId: String(tenant._id),
          userId: String(tenant._id), // self-referential bootstrap
          permissions: ["*"],
        },
        async () => {
          // Create default roles
          const ownerRole = await Role.create({
            name: "Owner",
            description: ROLE_TEMPLATES.Owner.description,
            permissions: ROLE_TEMPLATES.Owner.permissions,
            isSystem: true,
          });
          await Role.create({
            name: "Manager",
            description: ROLE_TEMPLATES.Manager.description,
            permissions: ROLE_TEMPLATES.Manager.permissions,
            isSystem: true,
          });
          await Role.create({
            name: "Operator",
            description: ROLE_TEMPLATES.Operator.description,
            permissions: ROLE_TEMPLATES.Operator.permissions,
            isSystem: true,
          });
          await Role.create({
            name: "Viewer",
            description: ROLE_TEMPLATES.Viewer.description,
            permissions: ROLE_TEMPLATES.Viewer.permissions,
            isSystem: true,
          });

          const passwordHash = await bcrypt.hash(input.ownerPassword, 12);
          const user = await User.create({
            name: input.ownerName,
            email: input.ownerEmail.toLowerCase(),
            passwordHash,
            roleId: ownerRole._id,
            isActive: true,
          });

          return { tenantId: String(tenant._id), userId: String(user._id) };
        },
      );

      return result;
    }),

  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user: any = await tenantContext.run(
        { tenantId: "", userId: "", permissions: [], systemBypass: true },
        () => User.findOne({ email: input.email.toLowerCase() }),
      );
      if (!user) return { ok: true }; // don't reveal existence
      const token = randomBytes(32).toString("hex");
      user.passwordResetToken = token;
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      const link = `${env.APP_URL}/reset-password?token=${token}`;
      const tmpl = emailTemplates.passwordReset(user.name, link);
      await sendEmail({ to: user.email, ...tmpl });
      return { ok: true };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(10),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const user: any = await tenantContext.run(
        { tenantId: "", userId: "", permissions: [], systemBypass: true },
        () =>
          User.findOne({
            passwordResetToken: input.token,
            passwordResetExpiresAt: { $gt: new Date() },
          }),
      );
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link is invalid or expired.",
        });
      }
      user.passwordHash = await bcrypt.hash(input.newPassword, 12);
      user.passwordResetToken = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();
      return { ok: true };
    }),
});
