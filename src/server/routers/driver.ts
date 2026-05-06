import { z } from "zod";
import { router, mergeRouters, requirePermission } from "../trpc";
import { tenantStamp } from "../tenant-stamp";
import { buildCrudRouter } from "../crud-helper";
import {
  Driver,
  DriverAttendance,
  DriverSalaryRecord,
  DriverIncident,
  Trip,
} from "@/models";

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  dateOfBirth: z.date().optional(),
  address: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  employmentType: z.enum(["PERMANENT", "CONTRACT", "CONTRACTOR_SUPPLIED"]),
  contractorId: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseClass: z.string().optional(),
  licenseExpiryDate: z.date().optional(),
  assignedVehicleId: z.string().optional(),
  salaryAmount: z.number().min(0).default(0),
  salaryCycle: z.enum(["MONTHLY", "PER_TRIP", "PER_TON"]).default("MONTHLY"),
  joiningDate: z.date().optional(),
  exitDate: z.date().optional(),
  currentStatus: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "EXITED"]).default("ACTIVE"),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

const baseRouter = buildCrudRouter({
  model: Driver,
  module: "driver",
  entityType: "Driver",
  createSchema,
  updateSchema: createSchema.partial(),
  defaultSort: { name: 1 },
  listFilter: (extra: any) => {
    const f: any = {};
    if (extra?.employmentType) f.employmentType = extra.employmentType;
    if (extra?.currentStatus) f.currentStatus = extra.currentStatus;
    if (extra?.contractorId) f.contractorId = extra.contractorId;
    return f;
  },
  populate: [
    { path: "contractorId", select: "name" },
    { path: "assignedVehicleId", select: "registrationNumber" },
  ],
});

const extras = router({
  // Attendance
  attendance: requirePermission("attendance.read")
    .input(
      z.object({
        driverId: z.string(),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(({ input }) =>
      DriverAttendance.find({
        driverId: input.driverId,
        date: { $gte: input.from, $lte: input.to },
      })
        .sort({ date: 1 })
        .lean(),
    ),

  upsertAttendance: requirePermission("attendance.create")
    .input(
      z.object({
        driverId: z.string(),
        date: z.date(),
        status: z.enum(["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await DriverAttendance.findOneAndUpdate(
        { driverId: input.driverId, date: input.date },
        { $set: input },
        { upsert: true },
      );
      return { ok: true };
    }),

  // Salary
  salaryRecords: requirePermission("salary.read")
    .input(z.object({ driverId: z.string() }))
    .query(({ input }) =>
      DriverSalaryRecord.find({ driverId: input.driverId })
        .sort({ period: -1 })
        .lean(),
    ),

  generateSalary: requirePermission("salary.create")
    .input(
      z.object({
        driverId: z.string(),
        period: z.string().regex(/^\d{4}-\d{2}$/),
      }),
    )
    .mutation(async ({ input }) => {
      const driver: any = await Driver.findById(input.driverId).lean();
      if (!driver) throw new Error("Driver not found");
      const [y, m] = input.period.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));

      let baseAmount = driver.salaryAmount ?? 0;
      let tripBonus = 0;

      if (driver.salaryCycle !== "MONTHLY") {
        const trips = await Trip.find({
          driverId: input.driverId,
          scheduledDate: { $gte: start, $lt: end },
          status: "COMPLETED",
        }).lean();
        if (driver.salaryCycle === "PER_TRIP") {
          baseAmount = trips.length * (driver.salaryAmount ?? 0);
        } else if (driver.salaryCycle === "PER_TON") {
          const totalTons = trips.reduce(
            (s: number, t: any) => s + Number(t.actualTonnage?.toString() ?? 0),
            0,
          );
          baseAmount = Math.round(totalTons * (driver.salaryAmount ?? 0));
        }
      }

      const totalAmount = baseAmount + tripBonus;
      const record = await DriverSalaryRecord.findOneAndUpdate(
        { driverId: input.driverId, period: input.period },
        {
          $set: {
            baseAmount,
            tripBonus,
            deductions: 0,
            totalAmount,
            paidAmount: 0,
            status: "PENDING",
          },
        },
        { upsert: true, new: true },
      );
      return { id: String(record._id), totalAmount };
    }),

  recordSalaryPayment: requirePermission("salary.update")
    .input(
      z.object({
        id: z.string(),
        paidAmount: z.number().min(0),
        paidDate: z.date(),
      }),
    )
    .mutation(async ({ input }) => {
      const r: any = await DriverSalaryRecord.findById(input.id);
      if (!r) throw new Error("Not found");
      r.paidAmount = (r.paidAmount ?? 0) + input.paidAmount;
      r.paidDate = input.paidDate;
      r.status = r.paidAmount >= r.totalAmount ? "PAID" : "PARTIAL";
      await r.save();
      return { ok: true };
    }),

  // Incidents
  incidents: requirePermission("incident.read")
    .input(z.object({ driverId: z.string() }))
    .query(({ input }) =>
      DriverIncident.find({ driverId: input.driverId })
        .sort({ incidentDate: -1 })
        .lean(),
    ),

  recordIncident: requirePermission("incident.create")
    .input(
      z.object({
        driverId: z.string(),
        incidentDate: z.date(),
        type: z.enum(["ACCIDENT", "VIOLATION", "COMPLAINT", "COMMENDATION"]),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
        description: z.string().optional(),
        resolution: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const inc = await DriverIncident.create({
        ...input,
        ...tenantStamp(),
        recordedByUserId: ctx.user.id,
      });
      return { id: String(inc._id) };
    }),

  // Performance metrics
  performance: requirePermission("driver.read")
    .input(
      z.object({
        driverId: z.string(),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ input }) => {
      const trips = await Trip.find({
        driverId: input.driverId,
        scheduledDate: { $gte: input.from, $lte: input.to },
      }).lean();
      const completed = trips.filter((t: any) => t.status === "COMPLETED");
      const onTime = completed.filter(
        (t: any) =>
          t.arrivalTime &&
          t.scheduledDate &&
          new Date(t.arrivalTime).getTime() <=
            new Date(t.scheduledDate).getTime() + 86_400_000,
      ).length;
      const totalTons = completed.reduce(
        (s: number, t: any) => s + Number(t.actualTonnage?.toString() ?? 0),
        0,
      );
      const incidents = await DriverIncident.countDocuments({
        driverId: input.driverId,
        incidentDate: { $gte: input.from, $lte: input.to },
      });
      return {
        tripCount: trips.length,
        completed: completed.length,
        cancelled: trips.filter((t: any) => t.status === "CANCELLED").length,
        onTimeRate: completed.length ? onTime / completed.length : 0,
        totalTonnage: totalTons,
        incidents,
      };
    }),
});

export const driverRouter = mergeRouters(baseRouter, extras);
