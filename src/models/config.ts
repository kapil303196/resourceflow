import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

/* MaterialGrade */
const materialGradeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    qualityScore: { type: Number, default: 0 },
    pricePerUnit: { type: Number, default: 0 }, // minor units (paise)
    color: { type: String, default: "#3B82F6" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  baseSchemaOptions,
);
applyBasePlugin(materialGradeSchema);
materialGradeSchema.index({ tenantId: 1, name: 1 }, { unique: true });
materialGradeSchema.index({ tenantId: 1, isDeleted: 1, sortOrder: 1 });
export const MaterialGrade =
  models.MaterialGrade || model("MaterialGrade", materialGradeSchema);

/* Location */
const locationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["SOURCE", "REFINERY", "WAREHOUSE", "CUSTOMER_SITE", "EXTERNAL"],
      required: true,
    },
    address: { type: String, default: "" },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    managerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(locationSchema);
locationSchema.index({ tenantId: 1, type: 1 });
locationSchema.index({ tenantId: 1, name: 1 });
export const Location = models.Location || model("Location", locationSchema);

/* Refinery */
const refinerySchema = new Schema(
  {
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    name: { type: String, required: true, trim: true },
    dailyCapacityTons: { type: Number, default: 0 },
    operationalSince: { type: Date },
    managerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    supportedGradeIds: [{ type: Schema.Types.ObjectId, ref: "MaterialGrade" }],
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(refinerySchema);
refinerySchema.index({ tenantId: 1, name: 1 });
refinerySchema.index({ tenantId: 1, locationId: 1 });
export const Refinery = models.Refinery || model("Refinery", refinerySchema);

/* AlertRule */
const alertRuleSchema = new Schema(
  {
    alertType: {
      type: String,
      required: true,
      enum: [
        "LICENSE_EXPIRY",
        "LICENSE_TONNAGE",
        "VEHICLE_DOC_EXPIRY",
        "DRIVER_LICENSE_EXPIRY",
        "DOCUMENT_EXPIRY",
        "LOW_STOCK",
        "OVERDUE_INVOICE",
        "VEHICLE_MAINTENANCE_DUE",
        "CONTRACTOR_AGREEMENT_EXPIRY",
        "REFINERY_BATCH_STUCK",
      ],
    },
    isEnabled: { type: Boolean, default: true },
    thresholdValue: { type: Number, default: 30 },
    thresholdUnit: { type: String, default: "DAYS" },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
  },
  baseSchemaOptions,
);
applyBasePlugin(alertRuleSchema);
alertRuleSchema.index({ tenantId: 1, alertType: 1 }, { unique: true });
export const AlertRule = models.AlertRule || model("AlertRule", alertRuleSchema);

/* Alert (the actual notifications) */
const alertSchema = new Schema(
  {
    alertType: { type: String, required: true },
    severity: {
      type: String,
      enum: ["INFO", "WARNING", "CRITICAL"],
      default: "WARNING",
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    actionUrl: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    resolvedAt: { type: Date },
    targetUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    dedupeKey: { type: String, index: true },
  },
  baseSchemaOptions,
);
applyBasePlugin(alertSchema);
alertSchema.index({ tenantId: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ tenantId: 1, dedupeKey: 1 });
export const Alert = models.Alert || model("Alert", alertSchema);
