import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { Invoice, Payment, SalesOrder, Customer, Tenant } from "@/models";
import { recordAudit } from "../audit";
import { tenantStamp } from "../tenant-stamp";
import { nextNumber } from "../next-number";
import { addDays } from "date-fns";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { sendEmail, buildSender } from "@/lib/email";
import { MaterialGrade } from "@/models";
import {
  generatePresignedGetUrl,
  uploadBuffer,
  buildS3Key,
} from "@/lib/s3";

export const invoiceRouter = router({
  list: requirePermission("invoice.read")
    .input(
      z
        .object({
          customerId: z.string().optional(),
          status: z.string().optional(),
          search: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.customerId) filter.customerId = input.customerId;
      if (input?.status) filter.status = input.status;
      if (input?.search) filter.invoiceNumber = { $regex: input.search, $options: "i" };
      if (input?.from || input?.to) {
        filter.invoiceDate = {};
        if (input.from) filter.invoiceDate.$gte = input.from;
        if (input.to) filter.invoiceDate.$lte = input.to;
      }
      return Invoice.find(filter)
        .populate("customerId", "name")
        .populate("salesOrderId", "orderNumber")
        .sort({ invoiceDate: -1 })
        .lean();
    }),

  byId: requirePermission("invoice.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const inv = await Invoice.findById(input.id)
        .populate("customerId")
        .populate("salesOrderId")
        .lean();
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      const payments = await Payment.find({ invoiceId: input.id })
        .sort({ paymentDate: -1 })
        .lean();
      return { ...inv, payments };
    }),

  /**
   * Generate an invoice from a sales order. Computes totalAmount from
   * order items × prices and sets dueDate = invoiceDate + customer.creditDays.
   */
  createFromOrder: requirePermission("invoice.create")
    .input(
      z.object({
        salesOrderId: z.string(),
        invoiceNumber: z.string().optional(), // auto-generated server-side
        invoiceDate: z.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const order: any = await SalesOrder.findById(input.salesOrderId).lean();
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const customer: any = await Customer.findById(order.customerId).lean();
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      const totalAmount = (order.items ?? []).reduce(
        (s: number, it: any) =>
          s + Math.round(Number(it.orderedTonnage?.toString() ?? 0) * (it.pricePerUnit ?? 0)),
        0,
      );
      const invoiceDate = input.invoiceDate ?? new Date();
      const dueDate = addDays(invoiceDate, customer.creditDays ?? 30);
      const invoiceNumber = input.invoiceNumber || (await nextNumber("INVOICE"));
      const inv = await Invoice.create({
        ...tenantStamp(),
        salesOrderId: input.salesOrderId,
        customerId: order.customerId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        totalAmount,
        paidAmount: 0,
        status: "DRAFT",
      });
      await recordAudit({
        action: "invoice.create",
        entityType: "Invoice",
        entityId: String(inv._id),
        newValue: { ...input, totalAmount },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(inv._id) };
    }),

  send: requirePermission("invoice.update")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await Invoice.findByIdAndUpdate(input.id, {
        $set: { status: "SENT", sentAt: new Date() },
      });
      return { ok: true };
    }),

  /**
   * Edit invoice metadata. Total/paid owned by recordPayment;
   * status by send/cancel/recordPayment.
   */
  update: requirePermission("invoice.update")
    .input(
      z.object({
        id: z.string(),
        invoiceDate: z.date().optional(),
        dueDate: z.date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      const inv: any = await Invoice.findById(id);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      if (inv.status === "CANCELLED" || inv.status === "PAID") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot edit a cancelled or fully paid invoice.",
        });
      }
      await Invoice.findByIdAndUpdate(id, {
        $set: { ...rest, updatedBy: ctx.user.id, pdfS3Key: undefined },
      });
      return { ok: true };
    }),

  recordPayment: requirePermission("payment.create")
    .input(
      z.object({
        invoiceId: z.string(),
        paymentDate: z.date(),
        amount: z.number().positive(),
        method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"]),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const inv: any = await Invoice.findById(input.invoiceId);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      const newPaid = (inv.paidAmount ?? 0) + input.amount;
      if (newPaid > inv.totalAmount + 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment amount exceeds invoice total.",
        });
      }
      const payment = await Payment.create({
        ...tenantStamp(),
        invoiceId: input.invoiceId,
        paymentDate: input.paymentDate,
        amount: input.amount,
        method: input.method,
        referenceNumber: input.referenceNumber ?? "",
        notes: input.notes ?? "",
        recordedByUserId: ctx.user.id,
      });
      inv.paidAmount = newPaid;
      inv.status =
        newPaid >= inv.totalAmount
          ? "PAID"
          : newPaid > 0
            ? "PARTIAL"
            : inv.status;
      await inv.save();
      await recordAudit({
        action: "invoice.payment",
        entityType: "Invoice",
        entityId: input.invoiceId,
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(payment._id), invoiceStatus: inv.status };
    }),

  /**
   * Render the invoice PDF (Indian GST tax-invoice layout), cache it on
   * S3, return a presigned download URL.
   */
  generatePdfUrl: requirePermission("invoice.read")
    .input(z.object({ id: z.string(), force: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const { url } = await renderAndCacheInvoicePdf(input.id, ctx.user.tenantId, input.force);
      return { url };
    }),

  /**
   * Email the invoice PDF to a recipient (defaults to the customer's
   * email on file). Sender is "<TenantName> <verified-from-address>"
   * via Amazon SES SendRawEmail (so the attachment goes through).
   */
  sendEmail: requirePermission("invoice.update")
    .input(
      z.object({
        id: z.string(),
        to: z.string().email().optional(),
        cc: z.array(z.string().email()).optional(),
        message: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const inv: any = await Invoice.findById(input.id).populate("customerId").lean();
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      const recipient = input.to || inv.customerId?.email;
      if (!recipient) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No recipient — set the customer's email or pass `to`.",
        });
      }
      const tenant: any = await Tenant.findById(ctx.user.tenantId).lean();
      const order: any = inv.salesOrderId
        ? await SalesOrder.findById(inv.salesOrderId).lean()
        : null;
      const itemsResolved = await resolveItems(order, tenant);
      const buffer = await renderInvoicePdf({ invoice: inv, order, tenant, itemsResolved });

      const settings = (tenant?.settings ?? {}) as any;
      const tenantEmail = settings.email as string | undefined;
      const html = buildInvoiceEmailHtml({
        tenant,
        invoice: inv,
        customer: inv.customerId,
        message: input.message,
      });
      const result = await sendEmail({
        from: buildSender(tenant?.name),
        replyTo: tenantEmail,
        to: recipient,
        cc: input.cc,
        subject: `Invoice ${inv.invoiceNumber} from ${tenant?.name ?? "ResourceFlow"}`,
        html,
        attachments: [
          {
            filename: `${inv.invoiceNumber}.pdf`,
            content: buffer,
            contentType: "application/pdf",
          },
        ],
      });

      // Cache PDF in S3 for download too
      const key = buildS3Key({
        tenantId: ctx.user.tenantId,
        entityType: "INVOICE",
        entityId: String(inv._id),
        fileName: `${inv.invoiceNumber}.pdf`,
      });
      await uploadBuffer({ key, body: buffer, mimeType: "application/pdf" });
      await Invoice.findByIdAndUpdate(input.id, {
        $set: {
          pdfS3Key: key,
          status: inv.status === "DRAFT" ? "SENT" : inv.status,
          sentAt: new Date(),
        },
      });

      await recordAudit({
        action: "invoice.sendEmail",
        entityType: "Invoice",
        entityId: input.id,
        newValue: { to: recipient, backend: result.backend },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return {
        ok: true,
        skipped: result.skipped,
        backend: result.backend,
        to: recipient,
      };
    }),

  cancel: requirePermission("invoice.delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await Invoice.findByIdAndUpdate(input.id, { $set: { status: "CANCELLED" } });
      return { ok: true };
    }),
});

/* ----------------------------- helpers ----------------------------- */

async function renderAndCacheInvoicePdf(
  id: string,
  tenantId: string,
  force?: boolean,
): Promise<{ url: string; key: string }> {
  const inv: any = await Invoice.findById(id).populate("customerId").lean();
  if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
  if (!force && inv.pdfS3Key) {
    const url = await generatePresignedGetUrl(inv.pdfS3Key, {
      downloadName: `${inv.invoiceNumber}.pdf`,
    });
    return { url, key: inv.pdfS3Key };
  }
  const tenant: any = await Tenant.findById(tenantId).lean();
  const order: any = inv.salesOrderId
    ? await SalesOrder.findById(inv.salesOrderId).lean()
    : null;
  const itemsResolved = await resolveItems(order, tenant);
  const buffer = await renderInvoicePdf({ invoice: inv, order, tenant, itemsResolved });
  const key = buildS3Key({
    tenantId,
    entityType: "INVOICE",
    entityId: String(inv._id),
    fileName: `${inv.invoiceNumber}.pdf`,
  });
  await uploadBuffer({ key, body: buffer, mimeType: "application/pdf" });
  await Invoice.findByIdAndUpdate(id, { $set: { pdfS3Key: key } });
  const url = await generatePresignedGetUrl(key, {
    downloadName: `${inv.invoiceNumber}.pdf`,
  });
  return { url, key };
}

/** Resolve item names from the sales order (look up grade names). */
async function resolveItems(order: any, tenant: any) {
  if (!order?.items) return undefined;
  const unit = tenant?.unitOfMeasure ?? "Tons";
  const settings = tenant?.settings ?? {};
  return Promise.all(
    order.items.map(async (it: any, i: number) => {
      const grade: any = it.materialGradeId
        ? await MaterialGrade.findById(it.materialGradeId).lean()
        : null;
      const qty = Number(it.orderedTonnage?.toString?.() ?? it.orderedTonnage ?? 0);
      const rate = Number(it.pricePerUnit ?? 0) / 100;
      return {
        name: grade?.name ?? `Item ${i + 1}`,
        hsn: settings.defaultHsn ?? "2505", // Sand HSN code
        qty,
        unit,
        rate,
        amount: qty * rate,
      };
    }),
  );
}

function buildInvoiceEmailHtml(opts: {
  tenant: any;
  invoice: any;
  customer: any;
  message?: string;
}) {
  const tenantName = opts.tenant?.name ?? "ResourceFlow";
  const invNumber = opts.invoice.invoiceNumber ?? "—";
  const dueDate = opts.invoice.dueDate
    ? new Date(opts.invoice.dueDate).toLocaleDateString("en-IN")
    : "—";
  const totalDisplay = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: opts.tenant?.currency ?? "INR",
    maximumFractionDigits: 2,
  }).format((opts.invoice.totalAmount ?? 0) / 100);
  const greeting = opts.customer?.contactName ?? opts.customer?.name ?? "Customer";
  const note = opts.message
    ? `<p style="white-space:pre-wrap;color:#475569;">${opts.message.replace(/</g, "&lt;")}</p>`
    : "";
  return `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;color:#0f172a;">
    <h2 style="margin:0 0 8px;">Invoice ${invNumber}</h2>
    <p style="margin:0 0 16px;color:#475569;">From ${tenantName}</p>
    <p>Hi ${greeting.replace(/</g, "&lt;")},</p>
    <p>Please find attached invoice <strong>${invNumber}</strong> for <strong>${totalDisplay}</strong>, due on <strong>${dueDate}</strong>.</p>
    ${note}
    <p style="color:#475569;font-size:12px;margin-top:24px;">If you have any questions about this invoice, just reply to this email — it goes straight to ${tenantName}.</p>
    <p style="color:#94a3b8;font-size:11px;margin-top:16px;">Sent from ResourceFlow</p>
  </div>`;
}

