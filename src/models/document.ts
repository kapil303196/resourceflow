import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

export const DOCUMENT_ENTITY_TYPES = [
  "LICENSE",
  "VEHICLE",
  "DRIVER",
  "CONTRACTOR",
  "CUSTOMER",
  "SUPPLIER",
  "INVOICE",
  "TRIP",
  "TENANT",
  "EXTRACTION",
  "REFINERY_BATCH",
  "PURCHASE_ORDER",
  "OTHER",
] as const;

const documentSchema = new Schema(
  {
    entityType: { type: String, enum: DOCUMENT_ENTITY_TYPES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    documentType: { type: String, required: true, trim: true },
    documentNumber: { type: String, default: "" },
    s3Key: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, required: true },
    originalFileName: { type: String, required: true },
    expiryDate: { type: Date },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    isVerified: { type: Boolean, default: false },
    verifiedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(documentSchema);
documentSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
documentSchema.index({ tenantId: 1, expiryDate: 1 });
documentSchema.index({ tenantId: 1, documentType: 1 });
documentSchema.index({ tenantId: 1, isVerified: 1 });
export const Document_ = models.Document_ || model("Document_", documentSchema);
// Note: model name is Document_ to avoid clash with global Document type in TS DOM lib
