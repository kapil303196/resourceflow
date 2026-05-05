import { Schema, SchemaOptions } from "mongoose";
import { tenantContext } from "./tenant-context";

/**
 * Mongoose schema plugin that enforces multi-tenancy and soft delete.
 *
 * - Adds tenantId, isDeleted, createdBy, updatedBy
 * - Auto-injects tenantId on find/findOne/count/aggregate
 * - Auto-filters out isDeleted: true
 * - On save/insert: stamps tenantId and createdBy from context
 * - On update: stamps updatedBy from context
 */
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
      const ctx = tenantContext.get();
      if (ctx?.systemBypass) return;
      if (!ctx) return; // public/no-context queries (e.g. login lookup) handle scoping themselves
      const filter = this.getFilter ? this.getFilter() : this.getQuery();
      if (filter && filter.tenantId === undefined) {
        this.where({ tenantId: ctx.tenantId });
      }
      // Hide soft-deleted unless explicitly asked
      if (
        filter &&
        filter.isDeleted === undefined &&
        !this.getOptions?.()?.includeDeleted
      ) {
        this.where({ isDeleted: { $ne: true } });
      }
    });
  }

  // aggregate
  schema.pre("aggregate", function (this: any) {
    const ctx = tenantContext.get();
    if (ctx?.systemBypass) return;
    if (!ctx) return;
    const pipeline = this.pipeline();
    const first = pipeline[0];
    const match: Record<string, unknown> = {
      tenantId: new (require("mongoose").Types.ObjectId)(ctx.tenantId),
      isDeleted: { $ne: true },
    };
    if (first && Object.keys(first)[0] === "$match") {
      Object.assign(first.$match, match, first.$match);
    } else {
      pipeline.unshift({ $match: match });
    }
  });

  // Stamp tenantId + createdBy on save / insert
  schema.pre("save", function (next) {
    const ctx = tenantContext.get();
    if (ctx && !this.tenantId) (this as any).tenantId = ctx.tenantId;
    if (ctx && this.isNew && !(this as any).createdBy) (this as any).createdBy = ctx.userId;
    if (ctx) (this as any).updatedBy = ctx.userId;
    next();
  });

  schema.pre("insertMany", function (next, docs: any[]) {
    const ctx = tenantContext.get();
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
