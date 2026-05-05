import { z } from "zod";
import { Types } from "mongoose";
import { buildCrudRouter } from "../crud-helper";
import { router, mergeRouters, requirePermission } from "../trpc";
import { Customer, SalesOrder, Invoice, Payment } from "@/models";

const createSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
  creditDays: z.number().min(0).default(30),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

const baseRouter = buildCrudRouter({
  model: Customer,
  module: "customer",
  entityType: "Customer",
  createSchema,
  updateSchema: createSchema.partial(),
  defaultSort: { name: 1 },
});

const extras = router({
  statement: requirePermission("customer.read")
    .input(
      z.object({
        customerId: z.string(),
        from: z.date().optional(),
        to: z.date().optional(),
      }),
    )
    .query(async ({ input }) => {
      const customer = await Customer.findById(input.customerId).lean();
      if (!customer) return null;
      const filter: any = { customerId: new Types.ObjectId(input.customerId) };
      if (input.from || input.to) {
        filter.invoiceDate = {};
        if (input.from) filter.invoiceDate.$gte = input.from;
        if (input.to) filter.invoiceDate.$lte = input.to;
      }
      const invoices = await Invoice.find(filter).sort({ invoiceDate: -1 }).lean();
      const invoiceIds = invoices.map((i: any) => i._id);
      const payments = await Payment.find({
        invoiceId: { $in: invoiceIds },
      })
        .sort({ paymentDate: -1 })
        .lean();
      const orders = await SalesOrder.find({ customerId: input.customerId })
        .sort({ orderDate: -1 })
        .limit(50)
        .lean();
      const totals = invoices.reduce(
        (acc: any, inv: any) => {
          acc.invoiced += inv.totalAmount || 0;
          acc.paid += inv.paidAmount || 0;
          return acc;
        },
        { invoiced: 0, paid: 0 },
      );
      return {
        customer,
        invoices,
        payments,
        orders,
        totals: { ...totals, outstanding: totals.invoiced - totals.paid },
      };
    }),
});

export const customerRouter = mergeRouters(baseRouter, extras);
