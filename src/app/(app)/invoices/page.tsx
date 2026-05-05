"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Receipt, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney } from "@/lib/utils";

const createSchema = z.object({
  salesOrderId: z.string().min(1),
  invoiceNumber: z.string().min(1),
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
    onSuccess: () => { toast.success("Invoice created"); utils.invoice.list.invalidate(); setCreateOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const recordPayment = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => { toast.success("Payment recorded"); utils.invoice.list.invalidate(); setPaymentFor(null); },
    onError: (e) => toast.error(e.message),
  });
  const send = trpc.invoice.send.useMutation({
    onSuccess: () => { toast.success("Marked as sent"); utils.invoice.list.invalidate(); },
  });

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
        itemName="invoice"
        data={list.data ?? []}
        loading={list.isLoading}
        filters={[
          { label: "All", value: "all", active: filter === "all" },
          { label: "Draft", value: "DRAFT", active: filter === "DRAFT" },
          { label: "Sent", value: "SENT", active: filter === "SENT" },
          { label: "Partial", value: "PARTIAL", active: filter === "PARTIAL" },
          { label: "Overdue", value: "OVERDUE", active: filter === "OVERDUE" },
          { label: "Paid", value: "PAID", active: filter === "PAID" },
        ]}
        onFilterChange={setFilter}
        onCreate={() => setCreateOpen(true)}
        canEdit={false}
        canDelete={false}
        rowActions={(row: any) => {
          const out: { label: string; onClick: () => void }[] = [];
          if (row.status === "DRAFT") out.push({ label: "Mark sent", onClick: () => send.mutate({ id: row._id }) });
          if (!["PAID", "CANCELLED"].includes(row.status))
            out.push({ label: "Record payment", onClick: () => setPaymentFor(row) });
          out.push({ label: "Download PDF", onClick: () => downloadPdf(row._id) });
          return out;
        }}
        columns={[
          { key: "invoiceNumber", header: "Invoice #", cell: (i: any) => <span className="font-mono font-medium">{i.invoiceNumber}</span> },
          { key: "customerId", header: "Customer", cell: (i: any) => i.customerId?.name },
          { key: "invoiceDate", header: t("date"), cell: (i: any) => format(new Date(i.invoiceDate), "PP") },
          { key: "dueDate", header: "Due", cell: (i: any) => format(new Date(i.dueDate), "PP") },
          { key: "totalAmount", header: t("total"), cell: (i: any) => formatMoney(i.totalAmount) },
          {
            key: "outstanding", header: "Outstanding",
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
      />

      {/* Create invoice */}
      <ResourceForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create invoice"
        description="Generates from a completed sales order. Total auto-calculated."
        schema={createSchema}
        defaultValues={{
          salesOrderId: "",
          invoiceNumber: "",
          invoiceDate: new Date().toISOString().slice(0, 10),
        }}
        fields={[
          {
            name: "salesOrderId", label: "Source order", type: "select", required: true, span: 2,
            options: (orders.data ?? []).map((o: any) => ({
              value: o._id,
              label: `${o.orderNumber} · ${o.customerId?.name ?? ""} · ${formatMoney(o.totalAmount ?? 0)}`,
            })),
          },
          { name: "invoiceNumber", label: "Invoice #", type: "text", required: true, placeholder: "INV-2001" },
          { name: "invoiceDate", label: "Invoice date", type: "date", required: true },
        ]}
        submitting={createInv.isPending}
        onSubmit={async (v) => {
          await createInv.mutateAsync({
            salesOrderId: v.salesOrderId,
            invoiceNumber: v.invoiceNumber,
            invoiceDate: new Date(v.invoiceDate),
          });
        }}
      />

      {/* Record payment */}
      <ResourceForm
        open={!!paymentFor}
        onOpenChange={(o) => { if (!o) setPaymentFor(null); }}
        title="Record payment"
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
          { name: "paymentDate", label: "Payment date", type: "date", required: true },
          { name: "amount", label: "Amount (minor)", type: "number", required: true, hint: "Stored value (paise/cents)" },
          { name: "method", label: "Method", type: "select", required: true, options: [
            { value: "CASH", label: "Cash" },
            { value: "BANK_TRANSFER", label: "Bank transfer" },
            { value: "UPI", label: "UPI" },
            { value: "CHEQUE", label: "Cheque" },
            { value: "OTHER", label: "Other" },
          ] },
          { name: "referenceNumber", label: "Reference #", type: "text" },
          { name: "notes", label: "Notes", type: "textarea", span: 2 },
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
