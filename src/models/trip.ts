import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const tripMaterialSchema = new Schema(
  {
    materialGradeId: {
      type: Schema.Types.ObjectId,
      ref: "MaterialGrade",
      required: true,
    },
    tonnage: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false },
);

const tripSchema = new Schema(
  {
    tripNumber: { type: String, required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver" },
    vehicleOwnershipSnapshot: {
      type: String,
      enum: ["OWNED", "CONTRACTED"],
      required: true,
    },
    contractorId: { type: Schema.Types.ObjectId, ref: "Contractor" },
    salesOrderId: { type: Schema.Types.ObjectId, ref: "SalesOrder" },
    extractionBatchId: { type: Schema.Types.ObjectId, ref: "ExtractionBatch" },
    purchaseDeliveryId: { type: Schema.Types.ObjectId, ref: "PurchaseDelivery" },
    tripType: {
      type: String,
      enum: ["DELIVERY", "EXTRACTION", "INTERNAL_TRANSFER", "PURCHASE_PICKUP"],
      required: true,
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "IN_TRANSIT", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
    },
    scheduledDate: { type: Date, required: true },
    departureTime: { type: Date },
    arrivalTime: { type: Date },
    fromLocationId: { type: Schema.Types.ObjectId, ref: "Location" },
    toLocationId: { type: Schema.Types.ObjectId, ref: "Location" },
    plannedTonnage: { type: Schema.Types.Decimal128, default: 0 },
    actualTonnage: { type: Schema.Types.Decimal128, default: 0 },
    distanceKm: { type: Number, default: 0 },
    materials: { type: [tripMaterialSchema], default: [] },
    tripCost: { type: Number, default: 0 }, // minor
    fuelCost: { type: Number, default: 0 },
    otherExpenses: { type: Number, default: 0 },
    cancellationReason: { type: String },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(tripSchema);
tripSchema.index({ tenantId: 1, status: 1, scheduledDate: -1 });
tripSchema.index({ tenantId: 1, vehicleId: 1, scheduledDate: -1 });
tripSchema.index({ tenantId: 1, driverId: 1, scheduledDate: -1 });
tripSchema.index({ tenantId: 1, salesOrderId: 1 });
tripSchema.index({ tenantId: 1, tripType: 1 });
tripSchema.index({ tenantId: 1, contractorId: 1, scheduledDate: -1 });
tripSchema.index({ tenantId: 1, tripNumber: 1 }, { unique: true });
export const Trip = models.Trip || model("Trip", tripSchema);

const loadingSlipSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", required: true },
    slipNumber: { type: String, required: true },
    issuedAt: { type: Date, required: true, default: () => new Date() },
    issuedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    materialGradeId: {
      type: Schema.Types.ObjectId,
      ref: "MaterialGrade",
      required: true,
    },
    weightIn: { type: Schema.Types.Decimal128, default: 0 },
    weightOut: { type: Schema.Types.Decimal128, default: 0 },
    netTonnage: { type: Schema.Types.Decimal128, default: 0 },
    pdfS3Key: { type: String },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(loadingSlipSchema);
loadingSlipSchema.index({ tenantId: 1, tripId: 1 });
loadingSlipSchema.index({ tenantId: 1, slipNumber: 1 }, { unique: true });
loadingSlipSchema.index({ tenantId: 1, issuedAt: -1 });
export const LoadingSlip =
  models.LoadingSlip || model("LoadingSlip", loadingSlipSchema);
