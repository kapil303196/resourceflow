"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Receipt, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, DetailField } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney } from "@/lib/utils";

const createSchema = z.object({
  salesOrderId: z.string().min(1),
  invoiceDate: z.string().min(1),
});
type CreateForm = z.infer<typeof createSchema>;

const paymentSchema = z.object({
  paymentDate: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"]),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

export default function InvoicesPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<any | null>(null);
  const list = trpc.invoice.list.useQuery({ status: filter === "all" ? undefined : filter });
  const orders = trpc.salesOrder.list.useQuery({ status: "COMPLETED" });
  const utils = trpc.useUtils();

  const createInv = trpc.invoice.createFromOrder.useMutation({
    onSuccess: () => { toast.success(t("toastInvoiceCreated")); utils.invoice.list.invalidate(); setCreateOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const recordPayment = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => { toast.success(t("toastPaymentRecorded")); utils.invoice.list.invalidate(); setPaymentFor(null); },
    onError: (e) => toast.error(e.message),
  });
  const send = trpc.invoice.send.useMutation({
    onSuccess: () => { toast.success(t("toastUpdated")); utils.invoice.list.invalidate(); },
  });
  const sendEmail = trpc.invoice.sendEmail.useMutation({
    onSuccess: (r: any) => {
      if (r.skipped) toast.warning("Email backend not configured");
      else toast.success(`Sent to ${r.to}`);
      utils.invoice.list.invalidate();
      setSendFor(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const [sendFor, setSendFor] = useState<any | null>(null);

  const downloadPdf = async (id: string) => {
    const inputEncoded = encodeURIComponent(JSON.stringify({ "0": { json: { id } } }));
    const res = await fetch(`/api/trpc/invoice.generatePdfUrl?batch=1&input=${inputEncoded}`);
    if (!res.ok) {
      toast.error("Failed to generate PDF");
      return;
    }
    const json = await res.json();
    const url = json?.[0]?.result?.data?.json?.url;
    if (url) window.open(url, "_blank");
  };

  return (
    <>
      <ResourceList
        title={t("invoices")}
        itemName={t("invoice")}
        data={list.data ?? []}
        loading={list.isLoading}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          { label: t("filterDraft"), value: "DRAFT", active: filter === "DRAFT" },
          { label: t("filterSent"), value: "SENT", active: filter === "SENT" },
          { label: t("filterPartial"), value: "PARTIAL", active: filter === "PARTIAL" },
          { label: t("filterOverdue"), value: "OVERDUE", active: filter === "OVERDUE" },
          { label: t("filterPaid"), value: "PAID", active: filter === "PAID" },
        ]}
        onFilterChange={setFilter}
        onCreate={() => setCreateOpen(true)}
        canEdit={false}
        canDelete={false}
        rowActions={(row: any) => {
          const out: { label: string; onClick: () => void }[] = [];
          out.push({ label: "Send by email", onClick: () => setSendFor(row) });
          if (row.status === "DRAFT") out.push({ label: t("markSentAction"), onClick: () => send.mutate({ id: row._id }) });
          if (!["PAID", "CANCELLED"].includes(row.status))
            out.push({ label: t("recordPaymentAction"), onClick: () => setPaymentFor(row) });
          out.push({ label: t("downloadPdfAction"), onClick: () => downloadPdf(row._id) });
          return out;
        }}
        columns={[
          { key: "invoiceNumber", header: t("invoiceNumber"), cell: (i: any) => <span className="font-mono font-medium">{i.invoiceNumber}</span> },
          { key: "customerId", header: t("customer"), cell: (i: any) => i.customerId?.name },
          { key: "invoiceDate", header: t("date"), cell: (i: any) => format(new Date(i.invoiceDate), "PP") },
          { key: "dueDate", header: t("due"), cell: (i: any) => format(new Date(i.dueDate), "PP") },
          { key: "totalAmount", header: t("total"), cell: (i: any) => formatMoney(i.totalAmount) },
          {
            key: "outstanding", header: t("outstandingLabel"),
            cell: (i: any) => formatMoney(Math.max(0, (i.totalAmount ?? 0) - (i.paidAmount ?? 0))),
          },
          { key: "status", header: t("status"), cell: (i: any) => <StatusBadge status={i.status} /> },
        ]}
        mobileCard={(i: any) => {
          const outstanding = Math.max(0, (i.totalAmount ?? 0) - (i.paidAmount ?? 0));
          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Receipt className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-mono font-semibold">{i.invoiceNumber}</span>
                </div>
                <StatusBadge status={i.status} />
              </div>
              <div className="text-sm truncate">{i.customerId?.name}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Due {format(new Date(i.dueDate), "MMM d")}</span>
                <div className="text-right">
                  <div className="font-medium tabular">{formatMoney(i.totalAmount ?? 0)}</div>
                  {outstanding > 0 && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400">
                      {formatMoney(outstanding)} due
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }}
        detailTitle={(i: any) => i.invoiceNumber}
        detailRender={(i: any) => {
          const outstanding = Math.max(0, (i.totalAmount ?? 0) - (i.paidAmount ?? 0));
          return (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <DetailField label={t("status")} value={<StatusBadge status={i.status} />} />
              <DetailField label={t("customer")} value={i.customerId?.name} />
              <DetailField label={t("date")} value={format(new Date(i.invoiceDate), "PP")} />
              <DetailField label={t("due")} value={format(new Date(i.dueDate), "PP")} />
              <DetailField label={t("total")} value={formatMoney(i.totalAmount ?? 0)} />
              <DetailField label="Paid" value={formatMoney(i.paidAmount ?? 0)} />
              <DetailField span={2} label={t("outstandingLabel")} value={
                <span className={outstanding > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                  {formatMoney(outstanding)}
                </span>
              } />
              {i.notes && <DetailField span={2} label={t("notes")} value={i.notes} />}
            </div>
          );
        }}
      />

      {/* Create invoice */}
      <ResourceForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("createInvoiceTitle")}
        description={t("createInvoiceDesc")}
        schema={createSchema}
        defaultValues={{
          salesOrderId: "",
          invoiceDate: new Date().toISOString().slice(0, 10),
        }}
        fields={[
          {
            name: "salesOrderId", label: t("field_sourceOrder"), type: "select", required: true, span: 2,
            options: (orders.data ?? []).map((o: any) => ({
              value: o._id,
              label: `${o.orderNumber} · ${o.customerId?.name ?? ""} · ${formatMoney(o.totalAmount ?? 0)}`,
            })),
          },
          { name: "invoiceDate", label: t("field_invoiceDate"), type: "date", required: true, span: 2 },
        ]}
        submitting={createInv.isPending}
        onSubmit={async (v) => {
          await createInv.mutateAsync({
            salesOrderId: v.salesOrderId,
            invoiceDate: new Date(v.invoiceDate),
          });
        }}
      />

      {/* Send by email */}
      <ResourceForm
        open={!!sendFor}
        onOpenChange={(o) => { if (!o) setSendFor(null); }}
        title={`Email invoice ${sendFor?.invoiceNumber ?? ""}`}
        description="Sends a Tax Invoice PDF via Amazon SES. Sender name = your tenant name."
        schema={z.object({
          to: z.string().email(),
          message: z.string().optional(),
        })}
        defaultValues={{
          to: sendFor?.customerId?.email ?? "",
          message: "",
        }}
        fields={[
          { name: "to", label: "Recipient email", type: "email", required: true, span: 2 },
          { name: "message", label: "Personal note (optional)", type: "textarea", span: 2 },
        ]}
        submitting={sendEmail.isPending}
        onSubmit={async (v: any) => {
          if (!sendFor) return;
          await sendEmail.mutateAsync({
            id: sendFor._id,
            to: v.to,
            message: v.message || undefined,
          });
        }}
      />

      {/* Record payment */}
      <ResourceForm
        open={!!paymentFor}
        onOpenChange={(o) => { if (!o) setPaymentFor(null); }}
        title={t("recordPaymentTitle")}
        description={paymentFor ? `${paymentFor.invoiceNumber} · ${formatMoney(Math.max(0, (paymentFor.totalAmount ?? 0) - (paymentFor.paidAmount ?? 0)))} outstanding` : ""}
        schema={paymentSchema}
        defaultValues={{
          paymentDate: new Date().toISOString().slice(0, 10),
          amount: paymentFor ? (paymentFor.totalAmount ?? 0) - (paymentFor.paidAmount ?? 0) : 0,
          method: "BANK_TRANSFER",
          referenceNumber: "",
          notes: "",
        }}
        fields={[
          { name: "paymentDate", label: t("field_paymentDate"), type: "date", required: true },
          { name: "amount", label: t("field_amount"), type: "number", required: true, hint: "Stored value (paise/cents)" },
          { name: "method", label: t("field_method"), type: "select", required: true, options: [
            { value: "CASH", label: "Cash" },
            { value: "BANK_TRANSFER", label: "Bank transfer" },
            { value: "UPI", label: "UPI" },
            { value: "CHEQUE", label: "Cheque" },
            { value: "OTHER", label: "Other" },
          ] },
          { name: "referenceNumber", label: t("field_referenceNumber"), type: "text" },
          { name: "notes", label: t("notes"), type: "textarea", span: 2 },
        ]}
        submitting={recordPayment.isPending}
        onSubmit={async (v: PaymentForm) => {
          if (!paymentFor) return;
          await recordPayment.mutateAsync({
            invoiceId: paymentFor._id,
            paymentDate: new Date(v.paymentDate),
            amount: v.amount,
            method: v.method,
            referenceNumber: v.referenceNumber,
            notes: v.notes,
          });
        }}
      />
    </>
  );
}
