"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney, formatTonnage } from "@/lib/utils";

const schema = z.object({
  customerId: z.string().min(1),
  orderNumber: z.string().min(1),
  orderDate: z.string().min(1),
  requiredByDate: z.string().optional(),
  materialGradeId: z.string().min(1),
  orderedTonnage: z.coerce.number().positive(),
  pricePerUnit: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;
const defaults: FormValues = {
  customerId: "",
  orderNumber: "",
  orderDate: new Date().toISOString().slice(0, 10),
  requiredByDate: "",
  materialGradeId: "",
  orderedTonnage: 0,
  pricePerUnit: 0,
  notes: "",
};

export default function SalesOrdersPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const list = trpc.salesOrder.list.useQuery({ status: filter === "all" ? undefined : filter });
  const customers = trpc.customer.list.useQuery({});
  const grades = trpc.materialGrade.list.useQuery({});
  const utils = trpc.useUtils();
  const create = trpc.salesOrder.create.useMutation({
    onSuccess: () => { toast.success(t("toastOrderCreated")); utils.salesOrder.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const setStatus = trpc.salesOrder.setStatus.useMutation({
    onSuccess: () => { toast.success(t("toastUpdated")); utils.salesOrder.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const fields: FieldDef[] = [
    { name: "orderNumber", label: "Order #", type: "text", required: true, placeholder: "SO-1001" },
    {
      name: "customerId", label: "Customer", type: "select", required: true,
      options: (customers.data?.items ?? []).map((c: any) => ({ value: c._id, label: c.name })),
    },
    { name: "orderDate", label: "Order date", type: "date", required: true },
    { name: "requiredByDate", label: "Required by", type: "date" },
    {
      name: "materialGradeId", label: "Material grade", type: "select", required: true, span: 2,
      options: (grades.data?.items ?? []).map((g: any) => ({ value: g._id, label: g.name })),
    },
    { name: "orderedTonnage", label: "Tonnage", type: "number", step: 0.01, required: true },
    { name: "pricePerUnit", label: "Price/unit (major)", type: "money", required: true },
    { name: "notes", label: "Notes", type: "textarea", span: 2 },
  ];

  return (
    <>
      <ResourceList
        title={t("salesOrders")}
        itemName={t("order")}
        data={list.data ?? []}
        loading={list.isLoading}
        filters={[
          { label: "All", value: "all", active: filter === "all" },
          { label: "Draft", value: "DRAFT", active: filter === "DRAFT" },
          { label: "Confirmed", value: "CONFIRMED", active: filter === "CONFIRMED" },
          { label: "Dispatching", value: "DISPATCHING", active: filter === "DISPATCHING" },
          { label: "Completed", value: "COMPLETED", active: filter === "COMPLETED" },
        ]}
        onFilterChange={setFilter}
        onCreate={() => setOpen(true)}
        canEdit={false}
        canDelete={false}
        rowActions={(row: any) => {
          const next: { from: string; to: string; label: string }[] = [
            { from: "DRAFT", to: "CONFIRMED", label: "Confirm" },
            { from: "CONFIRMED", to: "DISPATCHING", label: "Mark dispatching" },
            { from: "DISPATCHING", to: "COMPLETED", label: "Mark completed" },
          ];
          const action = next.find((n) => n.from === row.status);
          const out: { label: string; onClick: () => void; destructive?: boolean }[] = [];
          if (action)
            out.push({
              label: action.label,
              onClick: async () => setStatus.mutate({ id: row._id, status: action.to as any }),
            });
          if (!["COMPLETED", "CANCELLED"].includes(row.status))
            out.push({
              label: "Cancel order",
              destructive: true,
              onClick: () => setStatus.mutate({ id: row._id, status: "CANCELLED" }),
            });
          return out;
        }}
        columns={[
          { key: "orderNumber", header: "Order #", cell: (o: any) => <span className="font-mono font-medium">{o.orderNumber}</span> },
          { key: "customerId", header: "Customer", cell: (o: any) => o.customerId?.name },
          { key: "orderDate", header: t("date"), cell: (o: any) => format(new Date(o.orderDate), "PP") },
          { key: "items", header: "Lines", cell: (o: any) => o.items?.length ?? 0 },
          { key: "totalAmount", header: t("total"), cell: (o: any) => formatMoney(o.totalAmount ?? 0) },
          { key: "status", header: t("status"), cell: (o: any) => <StatusBadge status={o.status} /> },
        ]}
        mobileCard={(o: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingCart className="size-4 text-muted-foreground shrink-0" />
                <span className="font-mono font-semibold">{o.orderNumber}</span>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="text-sm">{o.customerId?.name}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{format(new Date(o.orderDate), "MMM d, yyyy")}</span>
              <span className="font-medium tabular text-foreground">{formatMoney(o.totalAmount ?? 0)}</span>
            </div>
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={setOpen}
        title="New sales order"
        schema={schema}
        defaultValues={defaults}
        fields={fields}
        submitting={create.isPending}
        onSubmit={async (v) => {
          await create.mutateAsync({
            customerId: v.customerId,
            orderNumber: v.orderNumber,
            orderDate: new Date(v.orderDate),
            requiredByDate: v.requiredByDate ? new Date(v.requiredByDate) : undefined,
            items: [{
              materialGradeId: v.materialGradeId,
              orderedTonnage: v.orderedTonnage,
              pricePerUnit: Math.round(v.pricePerUnit * 100),
            }],
            notes: v.notes,
          });
        }}
      />
    </>
  );
}
