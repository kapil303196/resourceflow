import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const refineryBatchOutputSchema = new Schema(
  {
    materialGradeId: {
      type: Schema.Types.ObjectId,
      ref: "MaterialGrade",
      required: true,
    },
    tonnage: { type: Schema.Types.Decimal128, required: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
  },
  { _id: false },
);

const refineryBatchSchema = new Schema(
  {
    refineryId: { type: Schema.Types.ObjectId, ref: "Refinery", required: true },
    sourceType: {
      type: String,
      enum: ["EXTRACTION", "PURCHASE"],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    processedDate: { type: Date, required: true },
    inputTonnage: { type: Schema.Types.Decimal128, required: true },
    processingLoss: { type: Schema.Types.Decimal128, default: 0 },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "IN_PROGRESS",
    },
    operatorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    outputs: { type: [refineryBatchOutputSchema], default: [] },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(refineryBatchSchema);
refineryBatchSchema.index({ tenantId: 1, refineryId: 1, processedDate: -1 });
refineryBatchSchema.index({ tenantId: 1, status: 1 });
refineryBatchSchema.index({ tenantId: 1, sourceType: 1, sourceId: 1 });
export const RefineryBatch =
  models.RefineryBatch || model("RefineryBatch", refineryBatchSchema);
