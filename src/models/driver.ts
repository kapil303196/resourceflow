import { Schema, model, models } from "mongoose";
import { applyBasePlugin, baseSchemaOptions } from "@/lib/base-schema";

const driverSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    dateOfBirth: { type: Date },
    address: { type: String, default: "" },
    aadhaarNumber: { type: String, default: "" },
    bloodGroup: { type: String, default: "" },
    emergencyContactName: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },
    employmentType: {
      type: String,
      enum: ["PERMANENT", "CONTRACT", "CONTRACTOR_SUPPLIED"],
      required: true,
    },
    contractorId: { type: Schema.Types.ObjectId, ref: "Contractor" },
    licenseNumber: { type: String, default: "" },
    licenseClass: { type: String, default: "" },
    licenseExpiryDate: { type: Date },
    assignedVehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    salaryAmount: { type: Number, default: 0 }, // minor
    salaryCycle: {
      type: String,
      enum: ["MONTHLY", "PER_TRIP", "PER_TON"],
      default: "MONTHLY",
    },
    joiningDate: { type: Date },
    exitDate: { type: Date },
    currentStatus: {
      type: String,
      enum: ["ACTIVE", "ON_LEAVE", "SUSPENDED", "EXITED"],
      default: "ACTIVE",
    },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(driverSchema);
driverSchema.index({ tenantId: 1, name: 1 });
driverSchema.index({ tenantId: 1, employmentType: 1 });
driverSchema.index({ tenantId: 1, currentStatus: 1 });
driverSchema.index({ tenantId: 1, contractorId: 1 });
driverSchema.index({ tenantId: 1, licenseExpiryDate: 1 });
driverSchema.index({ tenantId: 1, assignedVehicleId: 1 });
export const Driver = models.Driver || model("Driver", driverSchema);

const driverAttendanceSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"],
      required: true,
    },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(driverAttendanceSchema);
driverAttendanceSchema.index(
  { tenantId: 1, driverId: 1, date: 1 },
  { unique: true },
);
export const DriverAttendance =
  models.DriverAttendance ||
  model("DriverAttendance", driverAttendanceSchema);

const driverSalaryRecordSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    period: { type: String, required: true }, // YYYY-MM
    baseAmount: { type: Number, default: 0 }, // minor
    tripBonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    paidDate: { type: Date },
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING",
    },
    notes: { type: String, default: "" },
  },
  baseSchemaOptions,
);
applyBasePlugin(driverSalaryRecordSchema);
driverSalaryRecordSchema.index(
  { tenantId: 1, driverId: 1, period: 1 },
  { unique: true },
);
export const DriverSalaryRecord =
  models.DriverSalaryRecord ||
  model("DriverSalaryRecord", driverSalaryRecordSchema);

const driverIncidentSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    incidentDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ["ACCIDENT", "VIOLATION", "COMPLAINT", "COMMENDATION"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
    },
    description: { type: String, default: "" },
    resolution: { type: String, default: "" },
    recordedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  baseSchemaOptions,
);
applyBasePlugin(driverIncidentSchema);
driverIncidentSchema.index({ tenantId: 1, driverId: 1, incidentDate: -1 });
export const DriverIncident =
  models.DriverIncident || model("DriverIncident", driverIncidentSchema);
