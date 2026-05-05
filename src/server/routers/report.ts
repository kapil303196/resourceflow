import { z } from "zod";
import { Types } from "mongoose";
import { router, requirePermission } from "../trpc";
import {
  ExtractionBatch,
  InventoryLedger,
  Invoice,
  Trip,
  RefineryBatch,
  License,
  ContractorPayment,
  VehicleMaintenance,
} from "@/models";

const dateRange = z.object({
  from: z.date(),
  to: z.date(),
});

export const reportRouter = router({
  tonnageSummary: requirePermission("report.read")
    .input(
      dateRange.extend({
        groupBy: z.enum(["day", "week", "month"]).default("month"),
      }),
    )
    .query(async ({ input }) => {
      const fmt =
        input.groupBy === "day"
          ? "%Y-%m-%d"
          : input.groupBy === "week"
            ? "%Y-W%V"
            : "%Y-%m";
      const inAgg = await InventoryLedger.aggregate([
        {
          $match: {
            transactionDate: { $gte: input.from, $lte: input.to },
            transactionType: { $in: ["IN", "OPENING"] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: fmt, date: "$transactionDate" } },
            qty: { $sum: { $toDouble: "$quantity" } },
          },
        },
      ]);
      const outAgg = await InventoryLedger.aggregate([
        {
          $match: {
            transactionDate: { $gte: input.from, $lte: input.to },
            transactionType: "OUT",
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: fmt, date: "$transactionDate" } },
            qty: { $sum: { $toDouble: "$quantity" } },
          },
        },
      ]);
      const periods = new Set([
        ...inAgg.map((a) => a._id),
        ...outAgg.map((a) => a._id),
      ]);
      const rows = Array.from(periods)
        .sort()
        .map((p) => ({
          period: p,
          in: inAgg.find((a) => a._id === p)?.qty ?? 0,
          out: outAgg.find((a) => a._id === p)?.qty ?? 0,
        }));
      return rows;
    }),

  gradeAnalysis: requirePermission("report.read")
    .input(dateRange)
    .query(async ({ input }) => {
      const result = await InventoryLedger.aggregate([
        {
          $match: { transactionDate: { $gte: input.from, $lte: input.to } },
        },
        {
          $group: {
            _id: { grade: "$materialGradeId", type: "$transactionType" },
            qty: { $sum: { $toDouble: "$quantity" } },
          },
        },
        {
          $group: {
            _id: "$_id.grade",
            byType: { $push: { type: "$_id.type", qty: "$qty" } },
          },
        },
        {
          $lookup: {
            from: "materialgrades",
            localField: "_id",
            foreignField: "_id",
            as: "grade",
          },
        },
        {
          $project: {
            _id: 0,
            materialGradeId: "$_id",
            name: { $arrayElemAt: ["$grade.name", 0] },
            color: { $arrayElemAt: ["$grade.color", 0] },
            byType: 1,
          },
        },
      ]);
      return result;
    }),

  sales: requirePermission("report.read")
    .input(dateRange)
    .query(async ({ input }) => {
      return Invoice.aggregate([
        {
          $match: {
            invoiceDate: { $gte: input.from, $lte: input.to },
            status: { $ne: "CANCELLED" },
          },
        },
        {
          $group: {
            _id: "$customerId",
            invoices: { $sum: 1 },
            revenue: { $sum: "$totalAmount" },
            paid: { $sum: { $ifNull: ["$paidAmount", 0] } },
          },
        },
        {
          $lookup: {
            from: "customers",
            localField: "_id",
            foreignField: "_id",
            as: "customer",
          },
        },
        {
          $project: {
            customerId: "$_id",
            invoices: 1,
            revenue: 1,
            paid: 1,
            outstanding: { $subtract: ["$revenue", "$paid"] },
            name: { $arrayElemAt: ["$customer.name", 0] },
          },
        },
        { $sort: { revenue: -1 } },
      ]);
    }),

  fleet: requirePermission("report.read")
    .input(dateRange)
    .query(async ({ input }) => {
      return Trip.aggregate([
        {
          $match: {
            status: "COMPLETED",
            scheduledDate: { $gte: input.from, $lte: input.to },
          },
        },
        {
          $group: {
            _id: "$vehicleId",
            trips: { $sum: 1 },
            tonnage: { $sum: { $toDouble: "$actualTonnage" } },
            distance: { $sum: "$distanceKm" },
            cost: { $sum: "$tripCost" },
          },
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "_id",
            foreignField: "_id",
            as: "v",
          },
        },
        {
          $project: {
            vehicleId: "$_id",
            trips: 1,
            tonnage: 1,
            distance: 1,
            cost: 1,
            registrationNumber: { $arrayElemAt: ["$v.registrationNumber", 0] },
            ownershipType: { $arrayElemAt: ["$v.ownershipType", 0] },
          },
        },
        { $sort: { tonnage: -1 } },
      ]);
    }),

  routeReport: requirePermission("report.read")
    .input(dateRange)
    .query(async ({ input }) => {
      return Trip.aggregate([
        {
          $match: {
            status: "COMPLETED",
            scheduledDate: { $gte: input.from, $lte: input.to },
          },
        },
        {
          $group: {
            _id: { from: "$fromLocationId", to: "$toLocationId" },
            trips: { $sum: 1 },
            tonnage: { $sum: { $toDouble: "$actualTonnage" } },
          },
        },
        {
          $lookup: {
            from: "locations",
            localField: "_id.from",
            foreignField: "_id",
            as: "fromLoc",
          },
        },
        {
          $lookup: {
            from: "locations",
            localField: "_id.to",
            foreignField: "_id",
            as: "toLoc",
          },
        },
        {
          $project: {
            from: { $arrayElemAt: ["$fromLoc.name", 0] },
            to: { $arrayElemAt: ["$toLoc.name", 0] },
            trips: 1,
            tonnage: 1,
          },
        },
        { $sort: { tonnage: -1 } },
      ]);
    }),

  refineryOutput: requirePermission("report.read")
    .input(dateRange)
    .query(async ({ input }) => {
      return RefineryBatch.aggregate([
        {
          $match: {
            status: "COMPLETED",
            processedDate: { $gte: input.from, $lte: input.to },
          },
        },
        { $unwind: "$outputs" },
        {
          $group: {
            _id: { refinery: "$refineryId", grade: "$outputs.materialGradeId" },
            tonnage: { $sum: { $toDouble: "$outputs.tonnage" } },
            input: { $sum: { $toDouble: "$inputTonnage" } },
            loss: { $sum: { $toDouble: "$processingLoss" } },
          },
        },
        {
          $lookup: {
            from: "refineries",
            localField: "_id.refinery",
            foreignField: "_id",
            as: "ref",
          },
        },
        {
          $lookup: {
            from: "materialgrades",
            localField: "_id.grade",
            foreignField: "_id",
            as: "g",
          },
        },
        {
          $project: {
            refinery: { $arrayElemAt: ["$ref.name", 0] },
            grade: { $arrayElemAt: ["$g.name", 0] },
            tonnage: 1,
            input: 1,
            loss: 1,
          },
        },
      ]);
    }),

  licenseUtilization: requirePermission("report.read").query(async () => {
    const items = await License.find({}).populate("locationId", "name").lean();
    return items.map((l: any) => ({
      ...l,
      permittedTonnage: Number(l.permittedTonnage?.toString() ?? 0),
      usedTonnage: Number(l.usedTonnage?.toString() ?? 0),
      utilization:
        Number(l.usedTonnage?.toString() ?? 0) /
        Math.max(Number(l.permittedTonnage?.toString() ?? 1), 1),
    }));
  }),

  inventoryValuation: requirePermission("report.read").query(async () => {
    return InventoryLedger.aggregate([
      {
        $project: {
          materialGradeId: 1,
          locationId: 1,
          transactionType: 1,
          qty: { $toDouble: "$quantity" },
        },
      },
      {
        $group: {
          _id: { grade: "$materialGradeId", location: "$locationId" },
          inSum: {
            $sum: {
              $cond: [
                { $in: ["$transactionType", ["IN", "OPENING", "TRANSFER_IN"]] },
                "$qty",
                0,
              ],
            },
          },
          outSum: {
            $sum: {
              $cond: [
                { $in: ["$transactionType", ["OUT", "TRANSFER_OUT"]] },
                "$qty",
                0,
              ],
            },
          },
          adj: {
            $sum: {
              $cond: [{ $eq: ["$transactionType", "ADJUSTMENT"] }, "$qty", 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "materialgrades",
          localField: "_id.grade",
          foreignField: "_id",
          as: "g",
        },
      },
      {
        $lookup: {
          from: "locations",
          localField: "_id.location",
          foreignField: "_id",
          as: "loc",
        },
      },
      {
        $project: {
          grade: { $arrayElemAt: ["$g.name", 0] },
          pricePerUnit: { $arrayElemAt: ["$g.pricePerUnit", 0] },
          location: { $arrayElemAt: ["$loc.name", 0] },
          quantity: {
            $add: ["$inSum", "$adj", { $multiply: ["$outSum", -1] }],
          },
        },
      },
      {
        $project: {
          grade: 1,
          location: 1,
          quantity: 1,
          pricePerUnit: 1,
          value: { $multiply: ["$quantity", "$pricePerUnit"] },
        },
      },
    ]);
  }),

  contractorSettlement: requirePermission("report.read")
    .input(z.object({ period: z.string().optional() }))
    .query(async ({ input }) => {
      const filter: any = {};
      if (input.period) filter.period = input.period;
      return ContractorPayment.find(filter)
        .populate("contractorId", "name type")
        .sort({ period: -1 })
        .lean();
    }),

  maintenanceReport: requirePermission("report.read")
    .input(dateRange)
    .query(async ({ input }) => {
      return VehicleMaintenance.aggregate([
        {
          $match: {
            maintenanceDate: { $gte: input.from, $lte: input.to },
          },
        },
        {
          $group: {
            _id: "$vehicleId",
            entries: { $sum: 1 },
            cost: { $sum: "$cost" },
          },
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "_id",
            foreignField: "_id",
            as: "v",
          },
        },
        {
          $project: {
            vehicleId: "$_id",
            entries: 1,
            cost: 1,
            registrationNumber: { $arrayElemAt: ["$v.registrationNumber", 0] },
          },
        },
        { $sort: { cost: -1 } },
      ]);
    }),
});
