import { z } from "zod";
import { Types } from "mongoose";
import { router, mergeRouters, requirePermission } from "../trpc";
import { buildCrudRouter } from "../crud-helper";
import { Vehicle, VehicleMaintenance, Trip } from "@/models";

const ownerEnum = z.enum([
  "OWNED",
  "LEASED",
  "CONTRACTED_DAILY",
  "CONTRACTED_TRIP",
  "CONTRACTED_MONTHLY",
]);

const createSchema = z.object({
  registrationNumber: z.string().min(1),
  vehicleType: z.enum(["TRUCK", "TRACTOR", "MINI_TRUCK", "DUMPER", "OTHER"]),
  capacityTons: z.number().min(0).default(0),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  ownershipType: ownerEnum,
  contractorId: z.string().optional(),
  contractStartDate: z.date().optional(),
  contractEndDate: z.date().optional(),
  ratePerTrip: z.number().min(0).default(0),
  ratePerTon: z.number().min(0).default(0),
  ratePerKm: z.number().min(0).default(0),
  ratePerMonth: z.number().min(0).default(0),
  insuranceExpiryDate: z.date().optional(),
  fitnessExpiryDate: z.date().optional(),
  permitExpiryDate: z.date().optional(),
  pucExpiryDate: z.date().optional(),
  currentStatus: z
    .enum(["AVAILABLE", "ON_TRIP", "UNDER_MAINTENANCE", "OUT_OF_SERVICE"])
    .default("AVAILABLE"),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

const baseRouter = buildCrudRouter({
  model: Vehicle,
  module: "vehicle",
  entityType: "Vehicle",
  createSchema,
  updateSchema: createSchema.partial(),
  defaultSort: { registrationNumber: 1 },
  listFilter: (extra: any) => {
    const f: any = {};
    if (extra?.ownershipType) f.ownershipType = extra.ownershipType;
    if (extra?.currentStatus) f.currentStatus = extra.currentStatus;
    if (extra?.contractorId) f.contractorId = extra.contractorId;
    if (extra?.isActive !== undefined) f.isActive = extra.isActive;
    return f;
  },
  populate: [{ path: "contractorId", select: "name" }],
});

const extras = router({
  /** Document expiry overview — vehicles whose docs expire within N days. */
  expiringDocs: requirePermission("vehicle.read")
    .input(z.object({ withinDays: z.number().default(30) }))
    .query(async ({ input }) => {
      const now = new Date();
      const cutoff = new Date(now.getTime() + input.withinDays * 86_400_000);
      const items: any[] = await Vehicle.find({
        isActive: true,
        $or: [
          { insuranceExpiryDate: { $lte: cutoff, $gte: now } },
          { fitnessExpiryDate: { $lte: cutoff, $gte: now } },
          { permitExpiryDate: { $lte: cutoff, $gte: now } },
          { pucExpiryDate: { $lte: cutoff, $gte: now } },
        ],
      }).lean();
      return items;
    }),

  // Maintenance subroutes
  maintenanceList: requirePermission("maintenance.read")
    .input(z.object({ vehicleId: z.string() }))
    .query(({ input }) =>
      VehicleMaintenance.find({ vehicleId: input.vehicleId })
        .sort({ maintenanceDate: -1 })
        .lean(),
    ),

  recordMaintenance: requirePermission("maintenance.create")
    .input(
      z.object({
        vehicleId: z.string(),
        maintenanceType: z.enum([
          "SERVICE",
          "REPAIR",
          "TIRE_CHANGE",
          "INSPECTION",
          "OTHER",
        ]),
        maintenanceDate: z.date(),
        odometerReading: z.number().min(0).default(0),
        cost: z.number().min(0).default(0),
        vendorName: z.string().optional(),
        description: z.string().optional(),
        nextDueDate: z.date().optional(),
        nextDueOdometer: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const m = await VehicleMaintenance.create({
        ...input,
        recordedByUserId: ctx.user.id,
      });
      return { id: String(m._id) };
    }),

  /** Cost report per vehicle (maintenance + trip costs aggregated). */
  costReport: requirePermission("vehicle.read")
    .input(
      z.object({
        vehicleId: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
      }),
    )
    .query(async ({ input }) => {
      const tripFilter: any = { status: "COMPLETED" };
      if (input.vehicleId) tripFilter.vehicleId = input.vehicleId;
      if (input.from || input.to) {
        tripFilter.scheduledDate = {};
        if (input.from) tripFilter.scheduledDate.$gte = input.from;
        if (input.to) tripFilter.scheduledDate.$lte = input.to;
      }
      const tripAgg = await Trip.aggregate([
        { $match: tripFilter },
        {
          $group: {
            _id: "$vehicleId",
            tripCost: { $sum: "$tripCost" },
            fuelCost: { $sum: "$fuelCost" },
            otherExpenses: { $sum: "$otherExpenses" },
            tripCount: { $sum: 1 },
          },
        },
      ]);
      const maintFilter: any = {};
      if (input.vehicleId) maintFilter.vehicleId = input.vehicleId;
      if (input.from || input.to) {
        maintFilter.maintenanceDate = {};
        if (input.from) maintFilter.maintenanceDate.$gte = input.from;
        if (input.to) maintFilter.maintenanceDate.$lte = input.to;
      }
      const maintAgg = await VehicleMaintenance.aggregate([
        { $match: maintFilter },
        { $group: { _id: "$vehicleId", maintenanceCost: { $sum: "$cost" } } },
      ]);
      return { trips: tripAgg, maintenance: maintAgg };
    }),
});

export const vehicleRouter = mergeRouters(baseRouter, extras);
