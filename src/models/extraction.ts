import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const extractionBatchSchema = new Schema(
  {
    batchNumber: { type: String }, // auto-generated, e.g. "E-50001"
    licenseId: { type: Schema.Types.ObjectId, ref: "License", required: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    extractedDate: { type: Date, required: true },
    grossTonnage: { type: Schema.Types.Decimal128, required: true },
    operatorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    status: {
      type: String,
      enum: ["PENDING", "AT_REFINERY", "REFINED", "CANCELLED"],
      default: "PENDING",
    },
    royaltyAmount: { type: Number, default: 0 }, // minor units
    cancellationReason: { type: String },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(extractionBatchSchema);
extractionBatchSchema.index({ tenantId: 1, licenseId: 1, extractedDate: -1 });
extractionBatchSchema.index({ tenantId: 1, status: 1, extractedDate: -1 });
extractionBatchSchema.index({ tenantId: 1, locationId: 1 });
extractionBatchSchema.index({ tenantId: 1, batchNumber: 1 }, { sparse: true });
export const ExtractionBatch =
  models.ExtractionBatch || model("ExtractionBatch", extractionBatchSchema);
