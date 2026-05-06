import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import {
  Trip,
  Vehicle,
  Driver,
  LoadingSlip,
  InventoryLedger,
  SalesOrder,
  ContractorPayment,
  Tenant,
} from "@/models";
import { recordAudit } from "../audit";
import { nextNumber } from "../next-number";
import { tenantStamp } from "../tenant-stamp";
import { connectMongo, mongoose } from "@/lib/mongo";
import {
  buildS3Key,
  uploadBuffer,
  generatePresignedGetUrl,
} from "@/lib/s3";

const tripMaterial = z.object({
  materialGradeId: z.string(),
  tonnage: z.number().min(0),
});

const createInput = z.object({
  // tripNumber is auto-generated server-side; ignored if provided.
  tripNumber: z.string().optional(),
  vehicleId: z.string(),
  driverId: z.string().optional(),
  salesOrderId: z.string().optional(),
  extractionBatchId: z.string().optional(),
  purchaseDeliveryId: z.string().optional(),
  tripType: z.enum(["DELIVERY", "EXTRACTION", "INTERNAL_TRANSFER", "PURCHASE_PICKUP"]),
  scheduledDate: z.date(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  plannedTonnage: z.number().min(0).default(0),
  materials: z.array(tripMaterial).default([]),
  distanceKm: z.number().min(0).default(0),
  notes: z.string().optional(),
});

function computeTripCost(
  vehicle: any,
  actualTonnage: number,
  distanceKm: number,
): number {
  if (vehicle.ownershipType === "OWNED" || vehicle.ownershipType === "LEASED") return 0;
  switch (vehicle.ownershipType) {
    case "CONTRACTED_TRIP":
      return vehicle.ratePerTrip ?? 0;
    case "CONTRACTED_DAILY":
      return vehicle.ratePerTrip ?? 0;
    case "CONTRACTED_MONTHLY":
      return 0; // billed monthly separately
    default:
      // Custom: ratePerTon * tonnage + ratePerKm * km
      return Math.round(
        (vehicle.ratePerTon ?? 0) * actualTonnage +
          (vehicle.ratePerKm ?? 0) * distanceKm,
      );
  }
}

export const tripRouter = router({
  list: requirePermission("trip.read")
    .input(
      z
        .object({
          status: z.string().optional(),
          tripType: z.string().optional(),
          vehicleId: z.string().optional(),
          driverId: z.string().optional(),
          contractorId: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          fromLocationId: z.string().optional(),
          toLocationId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.status) filter.status = input.status;
      if (input?.tripType) filter.tripType = input.tripType;
      if (input?.vehicleId) filter.vehicleId = input.vehicleId;
      if (input?.driverId) filter.driverId = input.driverId;
      if (input?.contractorId) filter.contractorId = input.contractorId;
      if (input?.fromLocationId) filter.fromLocationId = input.fromLocationId;
      if (input?.toLocationId) filter.toLocationId = input.toLocationId;
      if (input?.from || input?.to) {
        filter.scheduledDate = {};
        if (input.from) filter.scheduledDate.$gte = input.from;
        if (input.to) filter.scheduledDate.$lte = input.to;
      }
      const items = await Trip.find(filter)
        .populate("vehicleId", "registrationNumber")
        .populate("driverId", "name")
        .populate("salesOrderId", "orderNumber")
        .populate("fromLocationId", "name")
        .populate("toLocationId", "name")
        .sort({ scheduledDate: -1 })
        .limit(500)
        .lean();
      return items.map((t: any) => ({
        ...t,
        plannedTonnage: Number(t.plannedTonnage?.toString() ?? 0),
        actualTonnage: Number(t.actualTonnage?.toString() ?? 0),
      }));
    }),

  byId: requirePermission("trip.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const t: any = await Trip.findById(input.id)
        .populate("vehicleId")
        .populate("driverId", "name phone licenseNumber")
        .populate("salesOrderId", "orderNumber customerId")
        .populate("contractorId", "name")
        .populate("fromLocationId", "name type")
        .populate("toLocationId", "name type")
        .lean();
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      const slips = await LoadingSlip.find({ tripId: input.id })
        .populate("materialGradeId", "name")
        .sort({ issuedAt: -1 })
        .lean();
      return {
        ...t,
        plannedTonnage: Number(t.plannedTonnage?.toString() ?? 0),
        actualTonnage: Number(t.actualTonnage?.toString() ?? 0),
        slips: slips.map((s: any) => ({
          ...s,
          weightIn: Number(s.weightIn?.toString() ?? 0),
          weightOut: Number(s.weightOut?.toString() ?? 0),
          netTonnage: Number(s.netTonnage?.toString() ?? 0),
        })),
      };
    }),

  create: requirePermission("trip.create")
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const vehicle: any = await Vehicle.findById(input.vehicleId);
      if (!vehicle) throw new TRPCError({ code: "BAD_REQUEST", message: "Vehicle not found" });
      const ownershipSnapshot =
        vehicle.ownershipType === "OWNED" || vehicle.ownershipType === "LEASED"
          ? "OWNED"
          : "CONTRACTED";
      const tripNumber = input.tripNumber || (await nextNumber("TRIP"));
      const trip = await Trip.create({
        ...input,
        ...tenantStamp(),
        tripNumber,
        vehicleOwnershipSnapshot: ownershipSnapshot,
        contractorId: vehicle.contractorId,
        driverId: input.driverId ?? vehicle.assignedDriverId,
        status: "SCHEDULED",
      });
      await recordAudit({
        action: "trip.create",
        entityType: "Trip",
        entityId: String(trip._id),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(trip._id) };
    }),

  start: requirePermission("trip.update")
    .input(z.object({ id: z.string(), departureTime: z.date().optional() }))
    .mutation(async ({ input }) => {
      const trip: any = await Trip.findById(input.id);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      trip.status = "IN_TRANSIT";
      trip.departureTime = input.departureTime ?? new Date();
      await trip.save();
      await Vehicle.findByIdAndUpdate(trip.vehicleId, {
        $set: { currentStatus: "ON_TRIP" },
      });
      return { ok: true };
    }),

  /**
   * Complete trip — atomic: post inventory OUT (for DELIVERY), update sales order
   * fulfillment, accumulate contractor payment for the period, set vehicle AVAILABLE.
   */
  complete: requirePermission("trip.update")
    .input(
      z.object({
        id: z.string(),
        arrivalTime: z.date().optional(),
        actualTonnage: z.number().min(0),
        distanceKm: z.number().min(0).optional(),
        fuelCost: z.number().min(0).default(0),
        otherExpenses: z.number().min(0).default(0),
        materials: z.array(tripMaterial).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const trip: any = await Trip.findById(input.id);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      if (trip.status === "COMPLETED")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already completed." });

      const vehicle: any = await Vehicle.findById(trip.vehicleId);
      const tripCost = computeTripCost(
        vehicle,
        input.actualTonnage,
        input.distanceKm ?? trip.distanceKm ?? 0,
      );

      await connectMongo();
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Update trip
          trip.status = "COMPLETED";
          trip.arrivalTime = input.arrivalTime ?? new Date();
          trip.actualTonnage = input.actualTonnage;
          if (input.distanceKm !== undefined) trip.distanceKm = input.distanceKm;
          if (input.materials) trip.materials = input.materials;
          trip.fuelCost = input.fuelCost;
          trip.otherExpenses = input.otherExpenses;
          trip.tripCost = tripCost;
          await trip.save({ session });

          // Inventory OUT for delivery / TRANSFER pair for internal_transfer
          if (
            trip.tripType === "DELIVERY" &&
            trip.fromLocationId &&
            (input.materials ?? trip.materials)?.length
          ) {
            const docs = (input.materials ?? trip.materials).map((m: any) => ({
              tenantId: ctx.user.tenantId,
              materialGradeId: m.materialGradeId,
              locationId: trip.fromLocationId,
              transactionType: "OUT",
              quantity:
                typeof m.tonnage === "number"
                  ? m.tonnage
                  : Number(m.tonnage?.toString() ?? 0),
              referenceType: "TRIP",
              referenceId: trip._id,
              transactionDate: trip.arrivalTime ?? new Date(),
              userId: ctx.user.id,
              createdBy: ctx.user.id,
              updatedBy: ctx.user.id,
              notes: `Trip ${trip.tripNumber}`,
            }));
            await InventoryLedger.insertMany(docs, { session });
          } else if (
            trip.tripType === "INTERNAL_TRANSFER" &&
            trip.fromLocationId &&
            trip.toLocationId &&
            (input.materials ?? trip.materials)?.length
          ) {
            const matsList = input.materials ?? trip.materials;
            const docs = matsList.flatMap((m: any) => {
              const qty =
                typeof m.tonnage === "number"
                  ? m.tonnage
                  : Number(m.tonnage?.toString() ?? 0);
              return [
                {
                  tenantId: ctx.user.tenantId,
                  materialGradeId: m.materialGradeId,
                  locationId: trip.fromLocationId,
                  transactionType: "TRANSFER_OUT",
                  quantity: qty,
                  referenceType: "TRIP",
                  referenceId: trip._id,
                  transactionDate: trip.arrivalTime ?? new Date(),
                  userId: ctx.user.id,
                  createdBy: ctx.user.id,
                  updatedBy: ctx.user.id,
                  notes: `Trip ${trip.tripNumber}`,
                },
                {
                  tenantId: ctx.user.tenantId,
                  materialGradeId: m.materialGradeId,
                  locationId: trip.toLocationId,
                  transactionType: "TRANSFER_IN",
                  quantity: qty,
                  referenceType: "TRIP",
                  referenceId: trip._id,
                  transactionDate: trip.arrivalTime ?? new Date(),
                  userId: ctx.user.id,
                  createdBy: ctx.user.id,
                  updatedBy: ctx.user.id,
                  notes: `Trip ${trip.tripNumber}`,
                },
              ];
            });
            await InventoryLedger.insertMany(docs, { session });
          }

          // Update sales order fulfillment
          if (trip.salesOrderId && (input.materials ?? trip.materials)?.length) {
            const order: any = await SalesOrder.findById(trip.salesOrderId).session(
              session,
            );
            if (order) {
              const mats = input.materials ?? trip.materials;
              for (const it of order.items ?? []) {
                const matched = (mats as any[]).find(
                  (m: any) =>
                    String(m.materialGradeId) === String(it.materialGradeId),
                );
                if (matched) {
                  const add =
                    typeof matched.tonnage === "number"
                      ? matched.tonnage
                      : Number(matched.tonnage?.toString() ?? 0);
                  it.fulfilledTonnage =
                    Number(it.fulfilledTonnage?.toString() ?? 0) + add;
                }
              }
              const allFulfilled = (order.items ?? []).every(
                (it: any) =>
                  Number(it.fulfilledTonnage?.toString() ?? 0) >=
                  Number(it.orderedTonnage?.toString() ?? 0),
              );
              if (allFulfilled) order.status = "COMPLETED";
              else if (order.status === "CONFIRMED") order.status = "DISPATCHING";
              await order.save({ session });
            }
          }

          // Contractor payment accumulation (for contracted vehicles)
          if (
            trip.vehicleOwnershipSnapshot === "CONTRACTED" &&
            trip.contractorId &&
            tripCost > 0
          ) {
            const period = `${trip.scheduledDate.getUTCFullYear()}-${String(
              trip.scheduledDate.getUTCMonth() + 1,
            ).padStart(2, "0")}`;
            await ContractorPayment.findOneAndUpdate(
              { contractorId: trip.contractorId, period },
              {
                $inc: {
                  tripsCount: 1,
                  totalTonnage: input.actualTonnage,
                  totalAmount: tripCost,
                },
                $setOnInsert: {
                  tenantId: ctx.user.tenantId,
                  status: "PENDING",
                  paidAmount: 0,
                  createdBy: ctx.user.id,
                  updatedBy: ctx.user.id,
                },
              },
              { upsert: true, session },
            );
          }
        });
      } finally {
        await session.endSession();
      }

      await Vehicle.findByIdAndUpdate(trip.vehicleId, {
        $set: { currentStatus: "AVAILABLE" },
      });

      await recordAudit({
        action: "trip.complete",
        entityType: "Trip",
        entityId: String(trip._id),
        newValue: { actualTonnage: input.actualTonnage, tripCost },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return { ok: true, tripCost };
    }),

  cancel: requirePermission("trip.update")
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const trip: any = await Trip.findById(input.id);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      trip.status = "CANCELLED";
      trip.cancellationReason = input.reason;
      await trip.save();
      await Vehicle.findByIdAndUpdate(trip.vehicleId, {
        $set: { currentStatus: "AVAILABLE" },
      });
      return { ok: true };
    }),

  // Loading slip
  issueLoadingSlip: requirePermission("loadingSlip.create")
    .input(
      z.object({
        tripId: z.string(),
        slipNumber: z.string().optional(), // auto-generated when omitted
        materialGradeId: z.string(),
        weightIn: z.number().min(0),
        weightOut: z.number().min(0),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const netTonnage = Math.max(0, input.weightOut - input.weightIn);
      const slipNumber = input.slipNumber || (await nextNumber("SLIP"));
      const slip = await LoadingSlip.create({
        ...tenantStamp(),
        tripId: input.tripId,
        slipNumber,
        issuedAt: new Date(),
        issuedByUserId: ctx.user.id,
        materialGradeId: input.materialGradeId,
        weightIn: input.weightIn,
        weightOut: input.weightOut,
        netTonnage,
        notes: input.notes ?? "",
      });
      // Render PDF, upload to S3
      const tenant: any = await Tenant.findById(ctx.user.tenantId).lean();
      const buf = await renderLoadingSlipPdf(slip.toObject(), tenant);
      const key = buildS3Key({
        tenantId: ctx.user.tenantId,
        entityType: "LOADING_SLIP",
        entityId: String(slip._id),
        fileName: `slip-${slip.slipNumber}.pdf`,
      });
      await uploadBuffer({ key, body: buf, mimeType: "application/pdf" });
      slip.pdfS3Key = key;
      await slip.save();
      const url = await generatePresignedGetUrl(key, {
        downloadName: `${slip.slipNumber}.pdf`,
      });
      return { id: String(slip._id), netTonnage, pdfUrl: url };
    }),
});

async function renderLoadingSlipPdf(slip: any, tenant: any): Promise<Buffer> {
  const React = (await import("react")).default;
  const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import(
    "@react-pdf/renderer"
  );
  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 11 },
    title: { fontSize: 18, marginBottom: 12 },
    row: { flexDirection: "row", marginBottom: 4 },
  });
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, `${tenant?.name ?? "Loading Slip"}`),
      React.createElement(Text, null, `Slip Number: ${slip.slipNumber}`),
      React.createElement(Text, null, `Issued: ${new Date(slip.issuedAt).toLocaleString()}`),
      React.createElement(View, { style: { marginTop: 20 } },
        React.createElement(Text, null, `Weight In: ${Number(slip.weightIn?.toString() ?? 0)} ${tenant?.unitOfMeasure ?? "Tons"}`),
        React.createElement(Text, null, `Weight Out: ${Number(slip.weightOut?.toString() ?? 0)} ${tenant?.unitOfMeasure ?? "Tons"}`),
        React.createElement(Text, null, `Net: ${Number(slip.netTonnage?.toString() ?? 0)} ${tenant?.unitOfMeasure ?? "Tons"}`),
      ),
    ),
  );
  return renderToBuffer(doc as any);
}
