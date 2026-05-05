import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const inventoryLedgerSchema = new Schema(
  {
    materialGradeId: {
      type: Schema.Types.ObjectId,
      ref: "MaterialGrade",
      required: true,
    },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    transactionType: {
      type: String,
      enum: [
        "IN",
        "OUT",
        "ADJUSTMENT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "OPENING",
      ],
      required: true,
    },
    quantity: { type: Schema.Types.Decimal128, required: true },
    referenceType: { type: String },
    referenceId: { type: Schema.Types.ObjectId },
    transactionDate: { type: Date, required: true, default: () => new Date() },
    notes: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  baseSchemaOptions,
);
applyBasePlugin(inventoryLedgerSchema);
inventoryLedgerSchema.index(
  { tenantId: 1, materialGradeId: 1, locationId: 1, transactionDate: -1 },
);
inventoryLedgerSchema.index({ tenantId: 1, transactionDate: -1 });
inventoryLedgerSchema.index({ tenantId: 1, referenceType: 1, referenceId: 1 });
export const InventoryLedger =
  models.InventoryLedger || model("InventoryLedger", inventoryLedgerSchema);
