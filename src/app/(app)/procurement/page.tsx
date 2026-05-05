"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney } from "@/lib/utils";

export default function ProcurementPage() {
  const { t } = useI18n();
  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t("procurement")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("suppliers")} & {t("salesOrders").toLowerCase()}</p>
      </div>
      <Tabs defaultValue="orders">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="orders" className="flex-1 sm:flex-none">Orders</TabsTrigger>
          <TabsTrigger value="suppliers" className="flex-1 sm:flex-none">{t("suppliers")}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4"><PurchaseOrdersInline /></TabsContent>
        <TabsContent value="suppliers" className="mt-4"><SuppliersInline /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------- Suppliers -------------------------- */

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});
type SupplierForm = z.infer<typeof supplierSchema>;
const supplierDefaults: SupplierForm = {
  name: "", contactName: "", phone: "", email: "", address: "", gstin: "", notes: "", isActive: true,
};
const supplierFields: FieldDef[] = [
  { name: "name", label: "Supplier name", type: "text", required: true, span: 2 },
  { name: "contactName", label: "Contact person", type: "text" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "email", label: "Email", type: "email", span: 2 },
  { name: "gstin", label: "GSTIN", type: "text" },
  { name: "address", label: "Address", type: "textarea", span: 2 },
  { name: "notes", label: "Notes", type: "textarea", span: 2 },
  { name: "isActive", label: "Active", type: "boolean" },
];

function SuppliersInline() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const list = trpc.supplier.list.useQuery({ search });
  const utils = trpc.useUtils();
  const create = trpc.supplier.create.useMutation({
    onSuccess: () => { toast.success(t("toastAdded")); utils.supplier.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.supplier.update.useMutation({
    onSuccess: () => { toast.success(t("toastSaved")); utils.supplier.list.invalidate(); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.supplier.delete.useMutation({
    onSuccess: () => { toast.success(t("toastRemoved")); utils.supplier.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <ResourceList
        title=""
        itemName="supplier"
        data={list.data?.items ?? []}
        loading={list.isLoading}
        search={search}
        onSearchChange={setSearch}
        onCreate={() => { setEditing(null); setOpen(true); }}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={async (r) => del.mutateAsync({ id: String(r._id) })}
        columns={[
          { key: "name", header: t("name"), cell: (s: any) => <span className="font-medium">{s.name}</span> },
          { key: "contactName", header: "Contact" },
          { key: "phone", header: t("phone") },
          { key: "email", header: "Email" },
          { key: "isActive", header: t("status"), cell: (s: any) => <Badge variant={s.isActive ? "success" : "secondary"}>{s.isActive ? t("active") : t("inactive")}</Badge> },
        ]}
        mobileCard={(s: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <span className="font-semibold truncate">{s.name}</span>
              </div>
              {!s.isActive && <Badge variant="secondary">{t("inactive")}</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {s.contactName && <span>{s.contactName}</span>}
              {s.phone && <span>{s.phone}</span>}
            </div>
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        title={editing ? "Edit supplier" : "Add supplier"}
        schema={supplierSchema}
        defaultValues={editing ? { ...supplierDefaults, ...editing } : supplierDefaults}
        fields={supplierFields}
        submitting={create.isPending || update.isPending}
        onSubmit={async (v) => {
          if (editing) await update.mutateAsync({ id: editing._id, ...v });
          else await create.mutateAsync(v);
        }}
      />
    </>
  );
}

/* -------------------------- Purchase orders -------------------------- */

const poItemSchema = z.object({
  materialGradeId: z.string().min(1),
  tonnage: z.coerce.number().positive(),
  pricePerUnit: z.coerce.number().min(0),
});

const poSchema = z.object({
  supplierId: z.string().min(1),
  poNumber: z.string().min(1),
  orderDate: z.string().min(1),
  expectedDeliveryDate: z.string().optional(),
  // Single-item simplified form (most common path); can be extended later
  materialGradeId: z.string().min(1),
  tonnage: z.coerce.number().positive(),
  pricePerUnit: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type POForm = z.infer<typeof poSchema>;
const poDefaults: POForm = {
  supplierId: "",
  poNumber: "",
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDeliveryDate: "",
  materialGradeId: "",
  tonnage: 0,
  pricePerUnit: 0,
  notes: "",
};

function PurchaseOrdersInline() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const list = trpc.purchaseOrder.list.useQuery({ status: filter === "all" ? undefined : filter });
  const suppliers = trpc.supplier.list.useQuery({});
  const grades = trpc.materialGrade.list.useQuery({});
  const utils = trpc.useUtils();
  const create = trpc.purchaseOrder.create.useMutation({
    onSuccess: () => { toast.success(t("toastPOCreated")); utils.purchaseOrder.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const fields: FieldDef[] = [
    { name: "poNumber", label: "PO #", type: "text", required: true, placeholder: "PO-3001" },
    {
      name: "supplierId", label: "Supplier", type: "select", required: true,
      options: (suppliers.data?.items ?? []).map((s: any) => ({ value: s._id, label: s.name })),
    },
    { name: "orderDate", label: "Order date", type: "date", required: true },
    { name: "expectedDeliveryDate", label: "Expected delivery", type: "date" },
    {
      name: "materialGradeId", label: "Material grade", type: "select", required: true, span: 2,
      options: (grades.data?.items ?? []).map((g: any) => ({ value: g._id, label: g.name })),
    },
    { name: "tonnage", label: "Tonnage", type: "number", step: 0.01, required: true },
    { name: "pricePerUnit", label: "Price/unit (major)", type: "money", required: true },
    { name: "notes", label: "Notes", type: "textarea", span: 2 },
  ];

  return (
    <>
      <ResourceList
        title=""
        itemName="purchase order"
        data={list.data ?? []}
        loading={list.isLoading}
        filters={[
          { label: "All", value: "all", active: filter === "all" },
          { label: "Draft", value: "DRAFT", active: filter === "DRAFT" },
          { label: "Confirmed", value: "CONFIRMED", active: filter === "CONFIRMED" },
          { label: "Delivered", value: "DELIVERED", active: filter === "DELIVERED" },
        ]}
        onFilterChange={setFilter}
        onCreate={() => setOpen(true)}
        canEdit={false}
        canDelete={false}
        columns={[
          { key: "poNumber", header: "PO #", cell: (p: any) => <span className="font-mono font-medium">{p.poNumber}</span> },
          { key: "supplierId", header: "Supplier", cell: (p: any) => p.supplierId?.name },
          { key: "orderDate", header: "Date", cell: (p: any) => format(new Date(p.orderDate), "PP") },
          { key: "items", header: "Items", cell: (p: any) => `${p.items?.length ?? 0} line(s)` },
          { key: "totalAmount", header: t("total"), cell: (p: any) => formatMoney(p.totalAmount ?? 0) },
          { key: "status", header: t("status"), cell: (p: any) => <StatusBadge status={p.status} /> },
        ]}
        mobileCard={(p: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold">{p.poNumber}</span>
              <StatusBadge status={p.status} />
            </div>
            <div className="text-sm">{p.supplierId?.name}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{format(new Date(p.orderDate), "MMM d, yyyy")}</span>
              <span className="font-medium tabular text-foreground">{formatMoney(p.totalAmount ?? 0)}</span>
            </div>
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={setOpen}
        title="New purchase order"
        description="Single-line form. Multi-line POs can be added later."
        schema={poSchema}
        defaultValues={poDefaults}
        fields={fields}
        submitting={create.isPending}
        onSubmit={async (v) => {
          await create.mutateAsync({
            supplierId: v.supplierId,
            poNumber: v.poNumber,
            orderDate: new Date(v.orderDate),
            expectedDeliveryDate: v.expectedDeliveryDate ? new Date(v.expectedDeliveryDate) : undefined,
            items: [{
              materialGradeId: v.materialGradeId,
              tonnage: v.tonnage,
              pricePerUnit: Math.round(v.pricePerUnit * 100),
            }],
            notes: v.notes,
          });
        }}
      />
    </>
  );
}
