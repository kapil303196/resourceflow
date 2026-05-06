import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

/**
 * Per-tenant atomic counter used to mint human-readable IDs for trips,
 * sales orders, purchase orders, invoices, loading slips, etc.
 *
 * Usage: see `server/next-number.ts` — never read/write directly from
 * routers.
 */
const counterSchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  baseSchemaOptions,
);
applyBasePlugin(counterSchema);
counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const Counter = models.Counter || model("Counter", counterSchema);
