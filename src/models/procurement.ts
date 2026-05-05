import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

/* Supplier */
const supplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    gstin: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(supplierSchema);
supplierSchema.index({ tenantId: 1, name: 1 });
export const Supplier = models.Supplier || model("Supplier", supplierSchema);

/* PurchaseOrder */
const purchaseOrderItemSchema = new Schema(
  {
    materialGradeId: {
      type: Schema.Types.ObjectId,
      ref: "MaterialGrade",
      required: true,
    },
    tonnage: { type: Schema.Types.Decimal128, required: true },
    pricePerUnit: { type: Number, required: true }, // minor units
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    poNumber: { type: String, required: true },
    orderDate: { type: Date, required: true },
    expectedDeliveryDate: { type: Date },
    status: {
      type: String,
      enum: ["DRAFT", "CONFIRMED", "DELIVERED", "PARTIAL", "CANCELLED"],
      default: "DRAFT",
    },
    items: { type: [purchaseOrderItemSchema], default: [] },
    totalAmount: { type: Number, default: 0 }, // minor units
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(purchaseOrderSchema);
purchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1, orderDate: -1 });
purchaseOrderSchema.index({ tenantId: 1, status: 1 });
export const PurchaseOrder =
  models.PurchaseOrder || model("PurchaseOrder", purchaseOrderSchema);

/* PurchaseDelivery */
const purchaseDeliveryItemSchema = new Schema(
  {
    materialGradeId: {
      type: Schema.Types.ObjectId,
      ref: "MaterialGrade",
      required: true,
    },
    actualTonnage: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false },
);

const purchaseDeliverySchema = new Schema(
  {
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },
    deliveredDate: { type: Date, required: true },
    items: { type: [purchaseDeliveryItemSchema], default: [] },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    refineryProcessed: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(purchaseDeliverySchema);
purchaseDeliverySchema.index({ tenantId: 1, purchaseOrderId: 1 });
purchaseDeliverySchema.index({ tenantId: 1, deliveredDate: -1 });
export const PurchaseDelivery =
  models.PurchaseDelivery ||
  model("PurchaseDelivery", purchaseDeliverySchema);
