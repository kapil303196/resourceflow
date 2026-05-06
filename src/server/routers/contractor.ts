import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, mergeRouters, requirePermission } from "../trpc";
import { buildCrudRouter } from "../crud-helper";
import { Contractor, ContractorPayment, Trip, Vehicle } from "@/models";
import { recordAudit } from "../audit";
import { tenantStamp } from "../tenant-stamp";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "TRANSPORT",
    "EXTRACTION_LABOR",
    "REFINERY_LABOR",
    "EQUIPMENT_RENTAL",
    "OTHER",
  ]),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  agreementStartDate: z.date().optional(),
  agreementEndDate: z.date().optional(),
  agreementTerms: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

const baseRouter = buildCrudRouter({
  model: Contractor,
  module: "contractor",
  entityType: "Contractor",
  createSchema,
  updateSchema: createSchema.partial(),
  defaultSort: { name: 1 },
  listFilter: (extra: any) => {
    const f: any = {};
    if (extra?.type) f.type = extra.type;
    if (extra?.isActive !== undefined) f.isActive = extra.isActive;
    return f;
  },
});

const extras = router({
  vehicles: requirePermission("contractor.read")
    .input(z.object({ contractorId: z.string() }))
    .query(({ input }) => Vehicle.find({ contractorId: input.contractorId }).lean()),

  monthlySettlement: requirePermission("contractor.read")
    .input(
      z.object({
        contractorId: z.string(),
        period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
      }),
    )
    .query(async ({ input }) => {
      const [y, m] = input.period.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));

      const trips = await Trip.find({
        contractorId: input.contractorId,
        scheduledDate: { $gte: start, $lt: end },
        status: "COMPLETED",
      })
        .populate("vehicleId", "registrationNumber ratePerTrip ratePerTon ratePerMonth")
        .lean();

      let totalAmount = 0;
      let totalTonnage = 0;
      const breakdown = trips.map((t: any) => {
        const tonnage = Number(t.actualTonnage?.toString() ?? 0);
        totalTonnage += tonnage;
        const cost = t.tripCost ?? 0;
        totalAmount += cost;
        return {
          tripId: t._id,
          tripNumber: t.tripNumber,
          date: t.scheduledDate,
          vehicle: t.vehicleId?.registrationNumber,
          tonnage,
          cost,
        };
      });

      const payment: any = await ContractorPayment.findOne({
        contractorId: input.contractorId,
        period: input.period,
      }).lean();

      return {
        period: input.period,
        tripsCount: trips.length,
        totalTonnage,
        totalAmount,
        breakdown,
        payment,
      };
    }),

  recordPayment: requirePermission("contractor.update")
    .input(
      z.object({
        contractorId: z.string(),
        period: z.string(),
        amount: z.number().positive(),
        method: z.string(),
        reference: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing: any = await ContractorPayment.findOne({
        contractorId: input.contractorId,
        period: input.period,
      });
      if (!existing) {
        // Create with computed totals
        await ContractorPayment.create({
          ...tenantStamp(),
          contractorId: input.contractorId,
          period: input.period,
          paidAmount: input.amount,
          totalAmount: input.amount,
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: input.method,
          paymentReference: input.reference,
          notes: input.notes ?? "",
        });
      } else {
        existing.paidAmount = (existing.paidAmount ?? 0) + input.amount;
        existing.status =
          existing.paidAmount >= existing.totalAmount ? "PAID" : "PARTIAL";
        existing.paidAt = new Date();
        existing.paymentMethod = input.method;
        existing.paymentReference = input.reference ?? existing.paymentReference;
        existing.notes = input.notes ?? existing.notes;
        await existing.save();
      }
      await recordAudit({
        action: "contractor.payment",
        entityType: "ContractorPayment",
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),
});

export const contractorRouter = mergeRouters(baseRouter, extras);
