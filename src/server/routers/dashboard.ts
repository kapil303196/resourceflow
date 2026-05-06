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
  License,
  Document_,
  Vehicle,
} from "@/models";
import { startOfMonth, subMonths, endOfMonth } from "date-fns";

export const dashboardRouter = router({
  /**
   * Owner action queue — what needs attention right now.
   * Each section returns a count + a small sample for inline display.
   */
  actionQueue: protectedProcedure.query(async () => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);

    // 1. Trips ready to invoice = COMPLETED delivery trips whose sales order has no SENT/PAID invoice yet.
    const completedTrips: any[] = await Trip.find({
      status: "COMPLETED",
      tripType: "DELIVERY",
      salesOrderId: { $exists: true, $ne: null },
    })
      .populate("salesOrderId", "orderNumber customerId")
      .sort({ scheduledDate: -1 })
      .limit(50)
      .lean();
    const orderIds = [...new Set(completedTrips.map((t) => String(t.salesOrderId?._id)).filter(Boolean))];
    const invoicedOrders: any[] = orderIds.length
      ? await Invoice.find({ salesOrderId: { $in: orderIds } }, { salesOrderId: 1 }).lean()
      : [];
    const invoicedSet = new Set(invoicedOrders.map((i) => String(i.salesOrderId)));
    const tripsToInvoice = completedTrips.filter(
      (t) => !invoicedSet.has(String(t.salesOrderId?._id)),
    );

    // 2. Overdue invoices
    const overdueInvoices: any[] = await Invoice.find({
      status: { $in: ["SENT", "PARTIAL", "OVERDUE"] },
      dueDate: { $lt: now },
    })
      .populate("customerId", "name")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();
    const overdueCount = await Invoice.countDocuments({
      status: { $in: ["SENT", "PARTIAL", "OVERDUE"] },
      dueDate: { $lt: now },
    });

    // 3. Sales orders pending dispatch (CONFIRMED but no IN_TRANSIT/COMPLETED trip)
    const pendingOrders: any[] = await SalesOrder.find({
      status: { $in: ["CONFIRMED", "DISPATCHING"] },
    })
      .populate("customerId", "name")
      .sort({ requiredByDate: 1, orderDate: 1 })
      .limit(10)
      .lean();

    // 4. Trips currently in transit
    const inTransitTrips: any[] = await Trip.find({ status: "IN_TRANSIT" })
      .populate("vehicleId", "registrationNumber")
      .populate("driverId", "name")
      .sort({ departureTime: -1 })
      .limit(10)
      .lean();

    // 5. Licenses expiring within 30 days
    const expiringLicenses: any[] = await License.find({
      status: "ACTIVE",
      validTo: { $gte: now, $lte: in30 },
    })
      .populate("locationId", "name")
      .sort({ validTo: 1 })
      .limit(10)
      .lean();

    // 6. Documents expiring within 30 days
    const expiringDocs: any[] = await Document_.find({
      expiryDate: { $gte: now, $lte: in30 },
    })
      .sort({ expiryDate: 1 })
      .limit(10)
      .lean();

    // 7. Pending extraction batches (logged but not refined)
    const pendingExtractionsCount = await ExtractionBatch.countDocuments({
      status: { $in: ["PENDING", "AT_REFINERY"] },
    });

    // 8. Critical alerts
    const criticalAlerts: any[] = await Alert.find({ severity: "CRITICAL", isRead: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return {
      tripsToInvoice: {
        count: tripsToInvoice.length,
        sample: tripsToInvoice.slice(0, 5).map((t: any) => ({
          tripId: String(t._id),
          tripNumber: t.tripNumber,
          orderNumber: t.salesOrderId?.orderNumber,
          actualTonnage: Number(t.actualTonnage?.toString() ?? 0),
          orderId: String(t.salesOrderId?._id ?? ""),
        })),
      },
      overdueInvoices: {
        count: overdueCount,
        sample: overdueInvoices.slice(0, 5).map((i: any) => ({
          id: String(i._id),
          invoiceNumber: i.invoiceNumber,
          customer: i.customerId?.name,
          dueDate: i.dueDate,
          outstanding: Math.max(0, (i.totalAmount ?? 0) - (i.paidAmount ?? 0)),
        })),
      },
      pendingDispatches: {
        count: pendingOrders.length,
        sample: pendingOrders.slice(0, 5).map((o: any) => ({
          id: String(o._id),
          orderNumber: o.orderNumber,
          customer: o.customerId?.name,
          requiredByDate: o.requiredByDate,
        })),
      },
      inTransit: {
        count: inTransitTrips.length,
        sample: inTransitTrips.slice(0, 5).map((t: any) => ({
          id: String(t._id),
          tripNumber: t.tripNumber,
          vehicle: t.vehicleId?.registrationNumber,
          driver: t.driverId?.name,
        })),
      },
      expiringLicenses: {
        count: expiringLicenses.length,
        sample: expiringLicenses.map((l: any) => ({
          id: String(l._id),
          licenseNumber: l.licenseNumber,
          location: l.locationId?.name,
          validTo: l.validTo,
          daysLeft: Math.ceil((new Date(l.validTo).getTime() - now.getTime()) / 86_400_000),
        })),
      },
      expiringDocs: {
        count: expiringDocs.length,
        sample: expiringDocs.slice(0, 5).map((d: any) => ({
          id: String(d._id),
          documentType: d.documentType,
          entityType: d.entityType,
          expiryDate: d.expiryDate,
        })),
      },
      pendingExtractionsCount,
      criticalAlerts: {
        count: criticalAlerts.length,
        sample: criticalAlerts.slice(0, 5).map((a: any) => ({
          id: String(a._id),
          title: a.title,
          severity: a.severity,
        })),
      },
    };
  }),


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
