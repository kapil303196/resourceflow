import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const contractorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "TRANSPORT",
        "EXTRACTION_LABOR",
        "REFINERY_LABOR",
        "EQUIPMENT_RENTAL",
        "OTHER",
      ],
      required: true,
    },
    contactName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    gstin: { type: String, default: "" },
    agreementStartDate: { type: Date },
    agreementEndDate: { type: Date },
    agreementTerms: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(contractorSchema);
contractorSchema.index({ tenantId: 1, type: 1 });
contractorSchema.index({ tenantId: 1, name: 1 });
contractorSchema.index({ tenantId: 1, agreementEndDate: 1 });
export const Contractor =
  models.Contractor || model("Contractor", contractorSchema);

const contractorPaymentSchema = new Schema(
  {
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: "Contractor",
      required: true,
    },
    period: { type: String, required: true }, // YYYY-MM
    tripsCount: { type: Number, default: 0 },
    totalTonnage: { type: Schema.Types.Decimal128, default: 0 },
    totalAmount: { type: Number, default: 0 }, // minor
    paidAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING",
    },
    paidAt: { type: Date },
    paymentMethod: { type: String },
    paymentReference: { type: String },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(contractorPaymentSchema);
contractorPaymentSchema.index(
  { tenantId: 1, contractorId: 1, period: 1 },
  { unique: true },
);
contractorPaymentSchema.index({ tenantId: 1, status: 1, period: -1 });
export const ContractorPayment =
  models.ContractorPayment ||
  model("ContractorPayment", contractorPaymentSchema);
