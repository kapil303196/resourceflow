"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Phone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";

const TYPES = [
  { value: "TRANSPORT", labelKey: "ct_transport" as const },
  { value: "EXTRACTION_LABOR", labelKey: "ct_extractionLabor" as const },
  { value: "REFINERY_LABOR", labelKey: "ct_refineryLabor" as const },
  { value: "EQUIPMENT_RENTAL", labelKey: "ct_equipmentRental" as const },
  { value: "OTHER", labelKey: "type_other" as const },
];

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["TRANSPORT", "EXTRACTION_LABOR", "REFINERY_LABOR", "EQUIPMENT_RENTAL", "OTHER"]),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  agreementStartDate: z.string().optional(),
  agreementEndDate: z.string().optional(),
  agreementTerms: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  name: "",
  type: "TRANSPORT",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  agreementStartDate: "",
  agreementEndDate: "",
  agreementTerms: "",
  notes: "",
  isActive: true,
};

export default function ContractorsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const list = trpc.contractor.list.useQuery({
    search,
    extra: filter !== "all" ? { type: filter } : {},
  } as any);
  const utils = trpc.useUtils();
  const create = trpc.contractor.create.useMutation({
    onSuccess: () => { toast.success(t("toastAdded")); utils.contractor.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.contractor.update.useMutation({
    onSuccess: () => { toast.success(t("toastSaved")); utils.contractor.list.invalidate(); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.contractor.delete.useMutation({
    onSuccess: () => { toast.success(t("toastRemoved")); utils.contractor.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const fields: FieldDef[] = [
    { name: "name", label: t("name"), type: "text", required: true, span: 2 },
    { name: "type", label: t("type"), type: "select", required: true,
      options: TYPES.map((tp) => ({ value: tp.value, label: t(tp.labelKey) })),
    },
    { name: "contactName", label: t("field_contactPerson"), type: "text" },
    { name: "phone", label: t("phone"), type: "tel" },
    { name: "email", label: t("email"), type: "email" },
    { name: "address", label: t("address"), type: "textarea", span: 2 },
    { name: "gstin", label: t("field_gstin"), type: "text" },
    { name: "agreementStartDate", label: t("field_agreementStart"), type: "date" },
    { name: "agreementEndDate", label: t("field_agreementEnd"), type: "date" },
    { name: "agreementTerms", label: t("field_agreementTerms"), type: "textarea", span: 2 },
    { name: "notes", label: t("notes"), type: "textarea", span: 2 },
    { name: "isActive", label: t("field_active"), type: "boolean" },
  ];

  async function submit(v: FormValues) {
    const payload: any = { ...v };
    if (v.agreementStartDate) payload.agreementStartDate = new Date(v.agreementStartDate);
    else delete payload.agreementStartDate;
    if (v.agreementEndDate) payload.agreementEndDate = new Date(v.agreementEndDate);
    else delete payload.agreementEndDate;
    if (editing) await update.mutateAsync({ id: editing._id, ...payload });
    else await create.mutateAsync(payload);
  }

  return (
    <>
      <ResourceList
        title={t("contractors")}
        itemName={t("contractor")}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        search={search}
        onSearchChange={setSearch}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          ...TYPES.map((tp) => ({ label: t(tp.labelKey), value: tp.value, active: filter === tp.value })),
        ]}
        onFilterChange={setFilter}
        onCreate={() => { setEditing(null); setOpen(true); }}
        onEdit={(row) => { setEditing(row); setOpen(true); }}
        onDelete={async (row) => del.mutateAsync({ id: String(row._id) })}
        columns={[
          { key: "name", header: t("name"), cell: (c: any) => <span className="font-medium">{c.name}</span> },
          { key: "type", header: t("type"), cell: (c: any) => <Badge variant="outline">{t(TYPES.find((x) => x.value === c.type)?.labelKey ?? "type_other")}</Badge> },
          { key: "phone", header: t("phone") },
          { key: "agreementEndDate", header: "Agreement ends", cell: (c: any) => c.agreementEndDate ? format(new Date(c.agreementEndDate), "PP") : "—" },
          { key: "isActive", header: t("status"), cell: (c: any) => <Badge variant={c.isActive ? "success" : "secondary"}>{c.isActive ? t("active") : t("inactive")}</Badge> },
        ]}
        mobileCard={(c: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{c.name}</span>
              <Badge variant="outline" className="shrink-0 text-[10px]">{t(TYPES.find((x) => x.value === c.type)?.labelKey ?? "type_other")}</Badge>
            </div>
            {c.contactName && <p className="text-xs text-muted-foreground">{c.contactName}</p>}
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {c.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{c.phone}</span>}
              {c.agreementEndDate && <span>Agreement: {format(new Date(c.agreementEndDate), "MMM d, yyyy")}</span>}
            </div>
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        title={editing ? t("editContractorTitle") : t("addContractorTitle")}
        schema={schema}
        defaultValues={editing ? { ...defaults, ...editing,
          agreementStartDate: editing.agreementStartDate ? format(new Date(editing.agreementStartDate), "yyyy-MM-dd") : "",
          agreementEndDate: editing.agreementEndDate ? format(new Date(editing.agreementEndDate), "yyyy-MM-dd") : "",
        } : defaults}
        fields={fields}
        submitting={create.isPending || update.isPending}
        onSubmit={submit}
      />
    </>
  );
}
