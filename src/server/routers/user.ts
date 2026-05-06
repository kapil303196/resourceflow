import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import {
  router,
  requirePermission,
  protectedProcedure,
} from "../trpc";
import { User, Role } from "@/models";
import { recordAudit } from "../audit";
import { tenantStamp } from "../tenant-stamp";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.user),

  list: requirePermission("user.read")
    .input(
      z
        .object({
          search: z.string().optional(),
          isActive: z.boolean().optional(),
          limit: z.number().min(1).max(200).default(50),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.search) {
        filter.$or = [
          { name: { $regex: input.search, $options: "i" } },
          { email: { $regex: input.search, $options: "i" } },
        ];
      }
      if (input?.isActive !== undefined) filter.isActive = input.isActive;
      const limit = input?.limit ?? 50;
      const items = await User.find(filter)
        .populate("roleId", "name")
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .lean();
      const hasMore = items.length > limit;
      return {
        items: items.slice(0, limit).map((u: any) => ({
          ...u,
          roleName: u.roleId?.name,
          roleId: u.roleId?._id,
          passwordHash: undefined,
        })),
        hasMore,
      };
    }),

  create: requirePermission("user.create")
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        roleId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await User.findOne({ email: input.email.toLowerCase() });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use within this organization.",
        });
      }
      const role = await Role.findById(input.roleId);
      if (!role) throw new TRPCError({ code: "BAD_REQUEST", message: "Role not found" });
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await User.create({
        ...tenantStamp(),
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        roleId: role._id,
        isActive: true,
      });
      await recordAudit({
        action: "user.create",
        entityType: "User",
        entityId: String(user._id),
        newValue: { email: input.email, roleId: input.roleId },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(user._id) };
    }),

  update: requirePermission("user.update")
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        roleId: z.string().optional(),
        isActive: z.boolean().optional(),
        emailDigestPreference: z.enum(["NONE", "DAILY", "WEEKLY"]).optional(),
        profilePhotoS3Key: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const before = await User.findById(input.id).lean();
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const { id, ...rest } = input;
      const user = await User.findByIdAndUpdate(id, { $set: rest }, { new: true }).lean();
      await recordAudit({
        action: "user.update",
        entityType: "User",
        entityId: id,
        previousValue: before,
        newValue: user,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  resetPassword: requirePermission("user.update")
    .input(
      z.object({
        id: z.string(),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await User.findByIdAndUpdate(input.id, { $set: { passwordHash } });
      await recordAudit({
        action: "user.resetPassword",
        entityType: "User",
        entityId: input.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  deactivate: requirePermission("user.delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot deactivate yourself.",
        });
      }
      await User.findByIdAndUpdate(input.id, {
        $set: { isActive: false, isDeleted: true },
      });
      await recordAudit({
        action: "user.deactivate",
        entityType: "User",
        entityId: input.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  changeMyPassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user: any = await User.findById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect.",
        });
      }
      user.passwordHash = await bcrypt.hash(input.newPassword, 12);
      await user.save();
      return { ok: true };
    }),
});
