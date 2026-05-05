import { Model } from "mongoose";
import { z, ZodTypeAny } from "zod";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "./trpc";
import { recordAudit } from "./audit";
import type { Permission } from "@/lib/permissions";

export type CrudOptions<TCreate extends ZodTypeAny, TUpdate extends ZodTypeAny> = {
  model: Model<any>;
  module: string; // permission prefix, e.g. "materialGrade"
  entityType: string; // for audit
  createSchema: TCreate;
  updateSchema: TUpdate;
  /** Optional default sort. */
  defaultSort?: Record<string, 1 | -1>;
  /** Optional list filter builder from generic input. */
  listFilter?: (input: any) => Record<string, unknown>;
  /** Optional populate spec(s) applied to find queries. */
  populate?: string | { path: string; select?: string }[];
};

export function buildCrudRouter<C extends ZodTypeAny, U extends ZodTypeAny>(
  opts: CrudOptions<C, U>,
) {
  const readPerm = `${opts.module}.read` as Permission;
  const createPerm = `${opts.module}.create` as Permission;
  const updatePerm = `${opts.module}.update` as Permission;
  const deletePerm = `${opts.module}.delete` as Permission;

  return router({
    list: requirePermission(readPerm)
      .input(
        z
          .object({
            search: z.string().optional(),
            limit: z.number().min(1).max(500).default(100),
            skip: z.number().min(0).default(0),
            extra: z.record(z.unknown()).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const filter: Record<string, unknown> = opts.listFilter
          ? opts.listFilter(input?.extra ?? {})
          : {};
        if (input?.search) {
          (filter as any).name = { $regex: input.search, $options: "i" };
        }
        const limit = input?.limit ?? 100;
        const skip = input?.skip ?? 0;
        let q = opts.model.find(filter as any);
        if (opts.populate) {
          if (Array.isArray(opts.populate)) {
            for (const p of opts.populate) q = q.populate(p);
          } else q = q.populate(opts.populate);
        }
        const [items, total] = await Promise.all([
          q.sort(opts.defaultSort ?? { createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          opts.model.countDocuments(filter as any),
        ]);
        return { items, total };
      }),

    byId: requirePermission(readPerm)
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        let q = opts.model.findById(input.id);
        if (opts.populate) {
          if (Array.isArray(opts.populate)) {
            for (const p of opts.populate) q = q.populate(p);
          } else q = q.populate(opts.populate);
        }
        const doc = await q.lean();
        if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
        return doc;
      }),

    create: requirePermission(createPerm)
      .input(opts.createSchema as any)
      .mutation(async ({ input, ctx }) => {
        const doc = await opts.model.create(input as any);
        await recordAudit({
          action: `${opts.module}.create`,
          entityType: opts.entityType,
          entityId: String(doc._id),
          newValue: input,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return { id: String(doc._id) };
      }),

    update: requirePermission(updatePerm)
      .input(z.object({ id: z.string() }).and(opts.updateSchema as any))
      .mutation(async ({ input, ctx }) => {
        const { id, ...rest } = input as any;
        const before = await opts.model.findById(id).lean();
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        const after = await opts.model
          .findByIdAndUpdate(id, { $set: rest }, { new: true })
          .lean();
        await recordAudit({
          action: `${opts.module}.update`,
          entityType: opts.entityType,
          entityId: id,
          previousValue: before,
          newValue: after,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return { ok: true };
      }),

    delete: requirePermission(deletePerm)
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const before = await opts.model.findById(input.id).lean();
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        await opts.model.findByIdAndUpdate(input.id, {
          $set: { isDeleted: true },
        });
        await recordAudit({
          action: `${opts.module}.delete`,
          entityType: opts.entityType,
          entityId: input.id,
          previousValue: before,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return { ok: true };
      }),
  });
}
