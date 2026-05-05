import { Schema, SchemaOptions, Types } from "mongoose";
import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantContext } from "./tenant-context";

/**
 * Mongoose schema plugin that enforces multi-tenancy and soft delete.
 *
 * IMPORTANT — about the `getCtx` helper below: it reads the current
 * AsyncLocalStorage from `globalThis` at hook fire time, NOT from a
 * captured import. Mongoose models register hooks once and live for the
 * whole process; in Next.js dev with HMR, the lib/tenant-context module
 * may reload and create a new storage instance. Hooks captured under
 * the OLD module reference would then be reading a different ALS than
 * the procedure (which uses the NEW module). By always reading via
 * `globalThis.__tenantStorage` (which is set once per process — see
 * tenant-context.ts), both sides see the same store regardless of
 * reload order.
 */
function getCtx(): TenantContext | undefined {
  const storage = (globalThis as any).__tenantStorage as
    | AsyncLocalStorage<TenantContext>
    | undefined;
  return storage?.getStore();
}

export function applyBasePlugin(schema: Schema) {
  schema.add({
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  });

  // Auto-filter find queries by tenantId + isDeleted
  const findHooks = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndDelete",
    "findOneAndReplace",
    "count",
    "countDocuments",
    "estimatedDocumentCount",
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
    "distinct",
  ] as const;

  for (const hook of findHooks) {
    schema.pre(hook as any, function (this: any) {
      const ctx = getCtx();
      if (ctx?.systemBypass) return;
      if (!ctx) return;
      const filter = this.getFilter ? this.getFilter() : this.getQuery();
      if (filter && filter.tenantId === undefined) {
        this.where({ tenantId: ctx.tenantId });
      }
      if (
        filter &&
        filter.isDeleted === undefined &&
        !this.getOptions?.()?.includeDeleted
      ) {
        this.where({ isDeleted: { $ne: true } });
      }
    });
  }

  schema.pre("aggregate", function (this: any) {
    const ctx = getCtx();
    if (ctx?.systemBypass) return;
    if (!ctx) return;
    const pipeline = this.pipeline();
    const first = pipeline[0];
    const match: Record<string, unknown> = {
      tenantId: new Types.ObjectId(ctx.tenantId),
      isDeleted: { $ne: true },
    };
    if (first && Object.keys(first)[0] === "$match") {
      Object.assign(first.$match, match, first.$match);
    } else {
      pipeline.unshift({ $match: match });
    }
  });

  // Stamp tenantId + createdBy BEFORE validation so the required check passes.
  // Mongoose order: pre("validate") → validate → pre("save") → save
  schema.pre("validate", function (next) {
    const ctx = getCtx();
    if (ctx) {
      if (!(this as any).tenantId) (this as any).tenantId = ctx.tenantId;
      if (this.isNew && !(this as any).createdBy)
        (this as any).createdBy = ctx.userId;
      (this as any).updatedBy = ctx.userId;
    }
    next();
  });

  // Belt-and-suspenders: also stamp on save in case something bypasses validate
  schema.pre("save", function (next) {
    const ctx = getCtx();
    if (ctx && !(this as any).tenantId) (this as any).tenantId = ctx.tenantId;
    next();
  });

  schema.pre("insertMany", function (next, docs: any[]) {
    const ctx = getCtx();
    if (ctx) {
      for (const d of docs) {
        if (!d.tenantId) d.tenantId = ctx.tenantId;
        if (!d.createdBy) d.createdBy = ctx.userId;
        d.updatedBy = ctx.userId;
      }
    }
    next();
  });
}

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
};
