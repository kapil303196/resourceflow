import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const vehicleSchema = new Schema(
  {
    registrationNumber: { type: String, required: true, trim: true },
    vehicleType: {
      type: String,
      enum: ["TRUCK", "TRACTOR", "MINI_TRUCK", "DUMPER", "OTHER"],
      required: true,
    },
    capacityTons: { type: Number, default: 0 },
    make: { type: String, default: "" },
    model: { type: String, default: "" },
    year: { type: Number },
    ownershipType: {
      type: String,
      enum: [
        "OWNED",
        "LEASED",
        "CONTRACTED_DAILY",
        "CONTRACTED_TRIP",
        "CONTRACTED_MONTHLY",
      ],
      required: true,
    },
    contractorId: { type: Schema.Types.ObjectId, ref: "Contractor" },
    contractStartDate: { type: Date },
    contractEndDate: { type: Date },
    ratePerTrip: { type: Number, default: 0 }, // minor
    ratePerTon: { type: Number, default: 0 },
    ratePerKm: { type: Number, default: 0 },
    ratePerMonth: { type: Number, default: 0 },
    insuranceExpiryDate: { type: Date },
    fitnessExpiryDate: { type: Date },
    permitExpiryDate: { type: Date },
    pucExpiryDate: { type: Date },
    currentStatus: {
      type: String,
      enum: ["AVAILABLE", "ON_TRIP", "UNDER_MAINTENANCE", "OUT_OF_SERVICE"],
      default: "AVAILABLE",
    },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(vehicleSchema);
vehicleSchema.index(
  { tenantId: 1, registrationNumber: 1 },
  { unique: true },
);
vehicleSchema.index({ tenantId: 1, ownershipType: 1 });
vehicleSchema.index({ tenantId: 1, currentStatus: 1 });
vehicleSchema.index({ tenantId: 1, contractorId: 1 });
vehicleSchema.index({ tenantId: 1, insuranceExpiryDate: 1 });
vehicleSchema.index({ tenantId: 1, fitnessExpiryDate: 1 });
export const Vehicle = models.Vehicle || model("Vehicle", vehicleSchema);

const vehicleMaintenanceSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    maintenanceType: {
      type: String,
      enum: ["SERVICE", "REPAIR", "TIRE_CHANGE", "INSPECTION", "OTHER"],
      required: true,
    },
    maintenanceDate: { type: Date, required: true },
    odometerReading: { type: Number, default: 0 },
    cost: { type: Number, default: 0 }, // minor
    vendorName: { type: String, default: "" },
    description: { type: String, default: "" },
    nextDueDate: { type: Date },
    nextDueOdometer: { type: Number },
    recordedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  baseSchemaOptions,
);
applyBasePlugin(vehicleMaintenanceSchema);
vehicleMaintenanceSchema.index({ tenantId: 1, vehicleId: 1, maintenanceDate: -1 });
vehicleMaintenanceSchema.index({ tenantId: 1, nextDueDate: 1 });
export const VehicleMaintenance =
  models.VehicleMaintenance ||
  model("VehicleMaintenance", vehicleMaintenanceSchema);
