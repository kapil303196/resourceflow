"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Phone, Mail, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, DetailField } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
  creditDays: z.coerce.number().min(0).default(30),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

const fields: FieldDef[] = [
  { name: "name", label: "Customer name", type: "text", required: true, span: 2, placeholder: "BuildRight Construction" },
  { name: "contactName", label: "Contact person", type: "text" },
  { name: "phone", label: "Phone", type: "tel", placeholder: "+91…" },
  { name: "email", label: "Email", type: "email", span: 2 },
  { name: "address", label: "Address", type: "textarea", span: 2 },
  { name: "gstin", label: "GSTIN", type: "text" },
  { name: "creditLimit", label: "Credit limit (major units)", type: "money", hint: "Rupees / cents — stored as minor units" },
  { name: "creditDays", label: "Credit days", type: "number", placeholder: "30" },
  { name: "notes", label: "Notes", type: "textarea", span: 2 },
  { name: "isActive", label: "Active", type: "boolean" },
];

const defaults: FormValues = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  creditLimit: 0,
  creditDays: 30,
  notes: "",
  isActive: true,
};

export default function CustomersPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const list = trpc.customer.list.useQuery({ search });
  const utils = trpc.useUtils();
  const create = trpc.customer.create.useMutation({
    onSuccess: () => {
      toast.success(t("toastAdded"));
      utils.customer.list.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.customer.update.useMutation({
    onSuccess: () => {
      toast.success(t("toastSaved"));
      utils.customer.list.invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.customer.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toastRemoved"));
      utils.customer.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function startCreate() {
    setEditing(null);
    setOpen(true);
  }
  function startEdit(row: any) {
    setEditing(row);
    setOpen(true);
  }

  async function submit(v: FormValues) {
    // creditLimit comes in as major units; convert to minor for storage
    const payload = {
      ...v,
      creditLimit: Math.round((v.creditLimit ?? 0) * 100),
    };
    if (editing) await update.mutateAsync({ id: editing._id, ...payload });
    else await create.mutateAsync(payload);
  }

  return (
    <>
      <ResourceList
        title={t("customers")}
        itemName={t("customer")}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        search={search}
        onSearchChange={setSearch}
        onCreate={startCreate}
        onEdit={startEdit}
        onDelete={async (row) => {
          await del.mutateAsync({ id: String(row._id) });
        }}
        columns={[
          { key: "name", header: t("name"), cell: (c: any) => <span className="font-medium">{c.name}</span> },
          { key: "contactName", header: "Contact", cell: (c: any) => c.contactName || "—" },
          { key: "phone", header: t("phone") },
          { key: "creditLimit", header: "Credit", cell: (c: any) => formatMoney(c.creditLimit ?? 0) },
          { key: "creditDays", header: "Days", cell: (c: any) => `${c.creditDays}d` },
          {
            key: "isActive",
            header: t("status"),
            cell: (c: any) => (
              <Badge variant={c.isActive ? "success" : "secondary"}>
                {c.isActive ? t("active") : t("inactive")}
              </Badge>
            ),
          },
        ]}
        mobileCard={(c: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{c.name}</span>
              {!c.isActive && <Badge variant="secondary">{t("inactive")}</Badge>}
            </div>
            {c.contactName && (
              <p className="text-xs text-muted-foreground">{c.contactName}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5">
              {c.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" />
                  {c.phone}
                </span>
              )}
              {c.email && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="size-3" />
                  {c.email}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
              <span className="text-muted-foreground">Credit</span>
              <span className="font-medium tabular">
                {formatMoney(c.creditLimit ?? 0)} · {c.creditDays}d
              </span>
            </div>
          </div>
        )}
        detailTitle={(c: any) => c.name}
        detailRender={(c: any) => (
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailField span={2} label={t("name")} value={c.name} />
            <DetailField label="Contact" value={c.contactName} />
            <DetailField label={t("phone")} value={c.phone} />
            <DetailField span={2} label="Email" value={c.email} />
            <DetailField span={2} label={t("address")} value={c.address} />
            <DetailField label="GSTIN" value={c.gstin} />
            <DetailField label={t("status")} value={
              <Badge variant={c.isActive ? "success" : "secondary"}>
                {c.isActive ? t("active") : t("inactive")}
              </Badge>
            } />
            <DetailField label="Credit limit" value={formatMoney(c.creditLimit ?? 0)} />
            <DetailField label="Credit days" value={`${c.creditDays}d`} />
            {c.notes && <DetailField span={2} label={t("notes")} value={c.notes} />}
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        title={editing ? t("editCustomerTitle") : t("addCustomerTitle")}
        schema={schema}
        defaultValues={
          editing
            ? {
                ...defaults,
                ...editing,
                creditLimit: (editing.creditLimit ?? 0) / 100,
              }
            : defaults
        }
        fields={fields}
        submitting={create.isPending || update.isPending}
        onSubmit={submit}
      />
    </>
  );
}
