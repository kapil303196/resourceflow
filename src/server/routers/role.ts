import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { Role, User } from "@/models";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export const roleRouter = router({
  list: requirePermission("role.read").query(async () => {
    return Role.find({}).sort({ isSystem: -1, name: 1 }).lean();
  }),

  permissions: requirePermission("role.read").query(() => ALL_PERMISSIONS),

  create: requirePermission("role.create")
    .input(
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        permissions: z.array(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      const role = await Role.create({
        name: input.name,
        description: input.description ?? "",
        permissions: input.permissions,
        isSystem: false,
      });
      return { id: String(role._id) };
    }),

  update: requirePermission("role.update")
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        permissions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const role = await Role.findById(input.id);
      if (!role) throw new TRPCError({ code: "NOT_FOUND" });
      if (role.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System roles cannot be modified.",
        });
      }
      const { id, ...rest } = input;
      await Role.findByIdAndUpdate(id, { $set: rest });
      return { ok: true };
    }),

  delete: requirePermission("role.delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const role = await Role.findById(input.id);
      if (!role) throw new TRPCError({ code: "NOT_FOUND" });
      if (role.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System roles cannot be deleted.",
        });
      }
      const usage = await User.countDocuments({ roleId: input.id });
      if (usage > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot delete: ${usage} user(s) currently have this role.`,
        });
      }
      await Role.findByIdAndUpdate(input.id, { $set: { isDeleted: true } });
      return { ok: true };
    }),
});
