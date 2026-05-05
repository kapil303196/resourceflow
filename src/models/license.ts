import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const licenseSchema = new Schema(
  {
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    licenseNumber: { type: String, required: true, trim: true },
    issuingAuthority: { type: String, default: "" },
    issuedBy: { type: String, default: "" },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    permittedTonnage: { type: Schema.Types.Decimal128, required: true },
    usedTonnage: { type: Schema.Types.Decimal128, default: 0 },
    royaltyRatePerUnit: { type: Number, default: 0 }, // minor units per unit
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "SUSPENDED", "RENEWED"],
      default: "ACTIVE",
    },
    renewalReminderDays: { type: Number, default: 30 },
    restrictions: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(licenseSchema);
licenseSchema.index({ tenantId: 1, validTo: 1 });
licenseSchema.index({ tenantId: 1, status: 1 });
licenseSchema.index({ tenantId: 1, licenseNumber: 1 }, { unique: true });
licenseSchema.index({ tenantId: 1, locationId: 1 });
export const License = models.License || model("License", licenseSchema);

const licenseConditionLogSchema = new Schema(
  {
    licenseId: { type: Schema.Types.ObjectId, ref: "License", required: true },
    checkDate: { type: Date, required: true, default: () => new Date() },
    conditionType: {
      type: String,
      enum: [
        "TONNAGE_REPORT",
        "INSPECTION",
        "ROYALTY_PAYMENT",
        "RENEWAL",
        "VIOLATION",
      ],
      required: true,
    },
    status: { type: String, default: "OK" },
    notes: { type: String, default: "" },
    recordedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  baseSchemaOptions,
);
applyBasePlugin(licenseConditionLogSchema);
licenseConditionLogSchema.index({ tenantId: 1, licenseId: 1, checkDate: -1 });
export const LicenseConditionLog =
  models.LicenseConditionLog ||
  model("LicenseConditionLog", licenseConditionLogSchema);
