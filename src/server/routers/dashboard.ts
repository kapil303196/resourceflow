import { z } from "zod";
import { Types } from "mongoose";
import { router, protectedProcedure } from "../trpc";
import {
  ExtractionBatch,
  Trip,
  SalesOrder,
  Invoice,
  ContractorPayment,
  Alert,
  InventoryLedger,
} from "@/models";
import { startOfMonth, subMonths, endOfMonth } from "date-fns";

export const dashboardRouter = router({
  kpis: protectedProcedure.query(async () => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const [
      activeOrders,
      tripsInProgress,
      revenueThisMonthAgg,
      outstandingAgg,
      pendingContractorAgg,
      criticalAlerts,
      thisMonthExtractAgg,
      lastMonthExtractAgg,
    ] = await Promise.all([
      SalesOrder.countDocuments({
        status: { $in: ["CONFIRMED", "DISPATCHING"] },
      }),
      Trip.countDocuments({ status: "IN_TRANSIT" }),
      Invoice.aggregate([
        {
          $match: {
            invoiceDate: { $gte: thisMonthStart },
            status: { $ne: "CANCELLED" },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            status: { $in: ["SENT", "PARTIAL", "OVERDUE"] },
          },
        },
        {
          $group: {
            _id: null,
            outstanding: {
              $sum: { $subtract: ["$totalAmount", { $ifNull: ["$paidAmount", 0] }] },
            },
          },
        },
      ]),
      ContractorPayment.aggregate([
        { $match: { status: { $in: ["PENDING", "PARTIAL"] } } },
        {
          $group: {
            _id: null,
            outstanding: {
              $sum: { $subtract: ["$totalAmount", { $ifNull: ["$paidAmount", 0] }] },
            },
          },
        },
      ]),
      Alert.countDocuments({ severity: "CRITICAL", isRead: false }),
      ExtractionBatch.aggregate([
        {
          $match: {
            status: { $ne: "CANCELLED" },
            extractedDate: { $gte: thisMonthStart },
          },
        },
        {
          $group: {
            _id: null,
            tons: { $sum: { $toDouble: "$grossTonnage" } },
          },
        },
      ]),
      ExtractionBatch.aggregate([
        {
          $match: {
            status: { $ne: "CANCELLED" },
            extractedDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
          },
        },
        {
          $group: {
            _id: null,
            tons: { $sum: { $toDouble: "$grossTonnage" } },
          },
        },
      ]),
    ]);

    const thisMonth = thisMonthExtractAgg[0]?.tons ?? 0;
    const lastMonth = lastMonthExtractAgg[0]?.tons ?? 0;
    const tonnageChange = lastMonth > 0 ? (thisMonth - lastMonth) / lastMonth : 0;

    return {
      activeOrders,
      tripsInProgress,
      revenueThisMonth: revenueThisMonthAgg[0]?.total ?? 0,
      outstandingReceivables: outstandingAgg[0]?.outstanding ?? 0,
      pendingContractorPayments: pendingContractorAgg[0]?.outstanding ?? 0,
      criticalAlerts,
      tonnageThisMonth: thisMonth,
      tonnageLastMonth: lastMonth,
      tonnageChange,
    };
  }),

  /** Monthly tonnage in vs out for last 12 months */
  monthlyInOut: protectedProcedure.query(async () => {
    const start = startOfMonth(subMonths(new Date(), 11));
    const inAgg = await InventoryLedger.aggregate([
      {
        $match: {
          transactionDate: { $gte: start },
          transactionType: { $in: ["IN", "OPENING"] },
        },
      },
      {
        $group: {
          _id: {
            y: { $year: "$transactionDate" },
            m: { $month: "$transactionDate" },
          },
          qty: { $sum: { $toDouble: "$quantity" } },
        },
      },
    ]);
    const outAgg = await InventoryLedger.aggregate([
      {
        $match: {
          transactionDate: { $gte: start },
          transactionType: "OUT",
        },
      },
      {
        $group: {
          _id: {
            y: { $year: "$transactionDate" },
            m: { $month: "$transactionDate" },
          },
          qty: { $sum: { $toDouble: "$quantity" } },
        },
      },
    ]);

    const months: { period: string; in: number; out: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const inMatch = inAgg.find((a) => a._id.y === y && a._id.m === m);
      const outMatch = outAgg.find((a) => a._id.y === y && a._id.m === m);
      months.push({
        period: `${y}-${String(m).padStart(2, "0")}`,
        in: inMatch?.qty ?? 0,
        out: outMatch?.qty ?? 0,
      });
    }
    return months;
  }),

  salesByGrade: protectedProcedure.query(async () => {
    const start = startOfMonth(new Date());
    return InventoryLedger.aggregate([
      {
        $match: {
          transactionDate: { $gte: start },
          transactionType: "OUT",
          referenceType: "TRIP",
        },
      },
      {
        $group: {
          _id: "$materialGradeId",
          tonnage: { $sum: { $toDouble: "$quantity" } },
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
          tonnage: 1,
          name: { $arrayElemAt: ["$grade.name", 0] },
          color: { $arrayElemAt: ["$grade.color", 0] },
        },
      },
    ]);
  }),

  topCustomers: protectedProcedure.query(async () => {
    const start = startOfMonth(new Date());
    return Invoice.aggregate([
      { $match: { invoiceDate: { $gte: start }, status: { $ne: "CANCELLED" } } },
      { $group: { _id: "$customerId", revenue: { $sum: "$totalAmount" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
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
          _id: 0,
          customerId: "$_id",
          revenue: 1,
          name: { $arrayElemAt: ["$customer.name", 0] },
        },
      },
    ]);
  }),

  topVehicles: protectedProcedure.query(async () => {
    const start = startOfMonth(new Date());
    return Trip.aggregate([
      {
        $match: {
          status: "COMPLETED",
          scheduledDate: { $gte: start },
        },
      },
      {
        $group: {
          _id: "$vehicleId",
          tonnage: { $sum: { $toDouble: "$actualTonnage" } },
          tripCount: { $sum: 1 },
        },
      },
      { $sort: { tonnage: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "vehicles",
          localField: "_id",
          foreignField: "_id",
          as: "vehicle",
        },
      },
      {
        $project: {
          _id: 0,
          vehicleId: "$_id",
          tonnage: 1,
          tripCount: 1,
          registrationNumber: { $arrayElemAt: ["$vehicle.registrationNumber", 0] },
        },
      },
    ]);
  }),
});
