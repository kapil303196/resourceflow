import { Schema, model, models, Types } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

/* ----------------------------- Tenant ----------------------------- */

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    industryType: { type: String, required: true, default: "Sand Mining" },
    materialName: { type: String, required: true, default: "Sand" },
    unitOfMeasure: { type: String, required: true, default: "Tons" },
    currency: { type: String, required: true, default: "INR" },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    logoS3Key: { type: String },
    settings: { type: Schema.Types.Mixed, default: {} },
    subscriptionStatus: {
      type: String,
      enum: ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"],
      default: "TRIAL",
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  baseSchemaOptions,
);
tenantSchema.index({ name: 1 });

export type TenantDoc = {
  _id: Types.ObjectId;
  name: string;
  industryType: string;
  materialName: string;
  unitOfMeasure: string;
  currency: string;
  timezone: string;
  logoS3Key?: string;
  settings: Record<string, unknown>;
  subscriptionStatus: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const Tenant = models.Tenant || model("Tenant", tenantSchema);

/* ----------------------------- User ----------------------------- */

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    profilePhotoS3Key: { type: String },
    emailDigestPreference: {
      type: String,
      enum: ["NONE", "DAILY", "WEEKLY"],
      default: "DAILY",
    },
    passwordResetToken: { type: String },
    passwordResetExpiresAt: { type: Date },
  },
  baseSchemaOptions,
);
applyBasePlugin(userSchema);
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, roleId: 1 });
userSchema.index({ passwordResetToken: 1 });

export const User = models.User || model("User", userSchema);

/* ----------------------------- Role ----------------------------- */

const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);
applyBasePlugin(roleSchema);
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Role = models.Role || model("Role", roleSchema);

/* ----------------------------- AuditLog ----------------------------- */

const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  baseSchemaOptions,
);
applyBasePlugin(auditLogSchema);
auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const AuditLog = models.AuditLog || model("AuditLog", auditLogSchema);
