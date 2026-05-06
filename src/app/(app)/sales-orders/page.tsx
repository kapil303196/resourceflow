"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, DetailField } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney, formatTonnage } from "@/lib/utils";

const schema = z.object({
  customerId: z.string().min(1),
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
    {
      name: "customerId", label: t("customer"), type: "select", required: true, span: 2,
      options: (customers.data?.items ?? []).map((c: any) => ({ value: c._id, label: c.name })),
    },
    { name: "orderDate", label: t("field_orderDate"), type: "date", required: true },
    { name: "requiredByDate", label: t("field_requiredBy"), type: "date" },
    {
      name: "materialGradeId", label: t("field_materialGrade"), type: "select", required: true, span: 2,
      options: (grades.data?.items ?? []).map((g: any) => ({ value: g._id, label: g.name })),
    },
    { name: "orderedTonnage", label: t("tonnage"), type: "number", step: 0.01, required: true },
    { name: "pricePerUnit", label: t("field_pricePerUnit"), type: "money", required: true },
    { name: "notes", label: t("notes"), type: "textarea", span: 2 },
  ];

  return (
    <>
      <ResourceList
        title={t("salesOrders")}
        itemName={t("order")}
        data={list.data ?? []}
        loading={list.isLoading}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          { label: t("filterDraft"), value: "DRAFT", active: filter === "DRAFT" },
          { label: t("filterConfirmed"), value: "CONFIRMED", active: filter === "CONFIRMED" },
          { label: t("dispatching"), value: "DISPATCHING", active: filter === "DISPATCHING" },
          { label: t("filterCompleted"), value: "COMPLETED", active: filter === "COMPLETED" },
        ]}
        onFilterChange={setFilter}
        onCreate={() => setOpen(true)}
        canEdit={false}
        canDelete={false}
        rowActions={(row: any) => {
          const next: { from: string; to: string; label: string }[] = [
            { from: "DRAFT", to: "CONFIRMED", label: t("confirm") },
            { from: "CONFIRMED", to: "DISPATCHING", label: t("markDispatchingAction") },
            { from: "DISPATCHING", to: "COMPLETED", label: t("markCompletedAction") },
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
              label: t("cancelOrderAction"),
              destructive: true,
              onClick: () => setStatus.mutate({ id: row._id, status: "CANCELLED" }),
            });
          return out;
        }}
        columns={[
          { key: "orderNumber", header: t("orderNumber"), cell: (o: any) => <span className="font-mono font-medium">{o.orderNumber}</span> },
          { key: "customerId", header: t("customer"), cell: (o: any) => o.customerId?.name },
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
        detailTitle={(o: any) => o.orderNumber}
        detailRender={(o: any) => (
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailField label={t("status")} value={<StatusBadge status={o.status} />} />
            <DetailField label={t("customer")} value={o.customerId?.name} />
            <DetailField label={t("date")} value={format(new Date(o.orderDate), "PP")} />
            <DetailField label="Required by" value={o.requiredByDate ? format(new Date(o.requiredByDate), "PP") : null} />
            <DetailField span={2} label="Items" value={
              (o.items ?? []).length === 0 ? "—" : (
                <ul className="space-y-1 mt-1">
                  {(o.items ?? []).map((it: any, i: number) => (
                    <li key={i} className="flex justify-between border-t pt-1 first:border-t-0 first:pt-0">
                      <span>Grade {i + 1} · <span className="tabular">{Number(it.orderedTonnage ?? 0).toFixed(2)} t</span></span>
                      <span className="tabular">{formatMoney(Math.round(Number(it.orderedTonnage ?? 0) * (it.pricePerUnit ?? 0)))}</span>
                    </li>
                  ))}
                </ul>
              )
            } />
            <DetailField span={2} label={t("total")} value={formatMoney(o.totalAmount ?? 0)} />
            {o.notes && <DetailField span={2} label={t("notes")} value={o.notes} />}
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={setOpen}
        title={t("newSalesOrderTitle")}
        schema={schema}
        defaultValues={defaults}
        fields={fields}
        submitting={create.isPending}
        onSubmit={async (v) => {
          await create.mutateAsync({
            customerId: v.customerId,
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
