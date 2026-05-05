import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

/* Customer */
const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    gstin: { type: String, default: "" },
    creditLimit: { type: Number, default: 0 }, // minor units
    creditDays: { type: Number, default: 30 },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(customerSchema);
customerSchema.index({ tenantId: 1, name: 1 });
export const Customer = models.Customer || model("Customer", customerSchema);

/* SalesOrder */
const salesOrderItemSchema = new Schema(
  {
    materialGradeId: {
      type: Schema.Types.ObjectId,
      ref: "MaterialGrade",
      required: true,
    },
    orderedTonnage: { type: Schema.Types.Decimal128, required: true },
    pricePerUnit: { type: Number, required: true }, // minor
    fulfilledTonnage: { type: Schema.Types.Decimal128, default: 0 },
  },
  { _id: false },
);

const salesOrderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    orderNumber: { type: String, required: true },
    orderDate: { type: Date, required: true },
    requiredByDate: { type: Date },
    status: {
      type: String,
      enum: ["DRAFT", "CONFIRMED", "DISPATCHING", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
    },
    items: { type: [salesOrderItemSchema], default: [] },
    totalAmount: { type: Number, default: 0 }, // minor
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(salesOrderSchema);
salesOrderSchema.index({ tenantId: 1, customerId: 1, orderDate: -1 });
salesOrderSchema.index({ tenantId: 1, status: 1 });
salesOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
export const SalesOrder =
  models.SalesOrder || model("SalesOrder", salesOrderSchema);

/* Invoice */
const invoiceSchema = new Schema(
  {
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: Date, required: true, default: () => new Date() },
    dueDate: { type: Date, required: true },
    totalAmount: { type: Number, required: true }, // minor
    paidAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"],
      default: "DRAFT",
    },
    pdfS3Key: { type: String },
    sentAt: { type: Date },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(invoiceSchema);
invoiceSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ tenantId: 1, customerId: 1, invoiceDate: -1 });
invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
export const Invoice = models.Invoice || model("Invoice", invoiceSchema);

/* Payment */
const paymentSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    paymentDate: { type: Date, required: true, default: () => new Date() },
    amount: { type: Number, required: true }, // minor
    method: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"],
      required: true,
    },
    referenceNumber: { type: String, default: "" },
    notes: { type: String, default: "" },
    recordedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  baseSchemaOptions,
);
applyBasePlugin(paymentSchema);
paymentSchema.index({ tenantId: 1, invoiceId: 1 });
paymentSchema.index({ tenantId: 1, paymentDate: -1 });
export const Payment = models.Payment || model("Payment", paymentSchema);
