"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Truck, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";

const TYPES = [
  { value: "TRUCK", labelKey: "type_truck" as const },
  { value: "TRACTOR", labelKey: "type_tractor" as const },
  { value: "MINI_TRUCK", labelKey: "type_miniTruck" as const },
  { value: "DUMPER", labelKey: "type_dumper" as const },
  { value: "OTHER", labelKey: "type_other" as const },
];
const OWNERSHIP = [
  { value: "OWNED", labelKey: "own_owned" as const },
  { value: "LEASED", labelKey: "own_leased" as const },
  { value: "CONTRACTED_TRIP", labelKey: "own_contractedTrip" as const },
  { value: "CONTRACTED_DAILY", labelKey: "own_contractedDaily" as const },
  { value: "CONTRACTED_MONTHLY", labelKey: "own_contractedMonthly" as const },
];

const schema = z.object({
  registrationNumber: z.string().min(1),
  vehicleType: z.enum(["TRUCK", "TRACTOR", "MINI_TRUCK", "DUMPER", "OTHER"]),
  capacityTons: z.coerce.number().min(0).default(0),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().optional(),
  ownershipType: z.enum(["OWNED", "LEASED", "CONTRACTED_DAILY", "CONTRACTED_TRIP", "CONTRACTED_MONTHLY"]),
  contractorId: z.string().optional(),
  ratePerTrip: z.coerce.number().min(0).default(0),
  ratePerTon: z.coerce.number().min(0).default(0),
  insuranceExpiryDate: z.string().optional(),
  fitnessExpiryDate: z.string().optional(),
  permitExpiryDate: z.string().optional(),
  pucExpiryDate: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  registrationNumber: "",
  vehicleType: "TRUCK",
  capacityTons: 0,
  make: "",
  model: "",
  year: undefined as any,
  ownershipType: "OWNED",
  contractorId: "",
  ratePerTrip: 0,
  ratePerTon: 0,
  insuranceExpiryDate: "",
  fitnessExpiryDate: "",
  permitExpiryDate: "",
  pucExpiryDate: "",
  isActive: true,
  notes: "",
};

function expiringSoon(date?: string | Date) {
  if (!date) return false;
  const d = new Date(date);
  const days = (d.getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 30;
}

export default function FleetPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const list = trpc.vehicle.list.useQuery({
    search,
    extra: filter !== "all" ? { ownershipType: filter } : {},
  } as any);
  const contractors = trpc.contractor.list.useQuery({});
  const utils = trpc.useUtils();
  const create = trpc.vehicle.create.useMutation({
    onSuccess: () => { toast.success(t("toastAdded")); utils.vehicle.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.vehicle.update.useMutation({
    onSuccess: () => { toast.success(t("toastSaved")); utils.vehicle.list.invalidate(); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.vehicle.delete.useMutation({
    onSuccess: () => { toast.success(t("toastRemoved")); utils.vehicle.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const fields: FieldDef[] = [
    { name: "registrationNumber", label: t("field_registrationNumber"), type: "text", required: true, placeholder: "GJ-01-AA-1001", span: 2 },
    { name: "vehicleType", label: t("type"), type: "select", required: true,
      options: TYPES.map((x) => ({ value: x.value, label: t(x.labelKey) })),
    },
    { name: "capacityTons", label: t("field_capacity"), type: "number", step: 0.5 },
    { name: "make", label: t("field_make"), type: "text" },
    { name: "model", label: t("field_model"), type: "text" },
    { name: "year", label: t("field_year"), type: "number" },
    { name: "ownershipType", label: t("field_ownership"), type: "select", required: true,
      options: OWNERSHIP.map((x) => ({ value: x.value, label: t(x.labelKey) })),
    },
    {
      name: "contractorId",
      label: t("contractor"),
      type: "select",
      options: [
        { value: "", label: "— None —" },
        ...((contractors.data?.items ?? []).map((c: any) => ({ value: c._id, label: c.name }))),
      ],
      showIf: (v) => v.ownershipType?.startsWith("CONTRACTED"),
      span: 2,
    },
    { name: "ratePerTrip", label: t("field_ratePerTrip"), type: "money", showIf: (v) => v.ownershipType === "CONTRACTED_TRIP" },
    { name: "ratePerTon", label: t("field_ratePerTon"), type: "money", showIf: (v) => v.ownershipType?.startsWith("CONTRACTED") },
    { name: "insuranceExpiryDate", label: t("field_insuranceExpiry"), type: "date" },
    { name: "fitnessExpiryDate", label: t("field_fitnessExpiry"), type: "date" },
    { name: "permitExpiryDate", label: t("field_permitExpiry"), type: "date" },
    { name: "pucExpiryDate", label: t("field_pucExpiry"), type: "date" },
    { name: "notes", label: t("notes"), type: "textarea", span: 2 },
    { name: "isActive", label: t("field_active"), type: "boolean" },
  ];

  async function submit(v: FormValues) {
    const payload: any = { ...v };
    // money to minor
    payload.ratePerTrip = Math.round((v.ratePerTrip ?? 0) * 100);
    payload.ratePerTon = Math.round((v.ratePerTon ?? 0) * 100);
    for (const k of ["insuranceExpiryDate", "fitnessExpiryDate", "permitExpiryDate", "pucExpiryDate"] as const) {
      if (v[k]) payload[k] = new Date(v[k]!);
      else delete payload[k];
    }
    if (!payload.contractorId) delete payload.contractorId;
    if (editing) await update.mutateAsync({ id: editing._id, ...payload });
    else await create.mutateAsync(payload);
  }

  return (
    <>
      <ResourceList
        title={t("fleet")}
        itemName={t("vehicle")}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        search={search}
        onSearchChange={setSearch}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          { label: t("owned"), value: "OWNED", active: filter === "OWNED" },
          { label: t("perTrip"), value: "CONTRACTED_TRIP", active: filter === "CONTRACTED_TRIP" },
          { label: t("contractedDaily"), value: "CONTRACTED_DAILY", active: filter === "CONTRACTED_DAILY" },
        ]}
        onFilterChange={setFilter}
        onCreate={() => { setEditing(null); setOpen(true); }}
        onEdit={(row) => { setEditing(row); setOpen(true); }}
        onDelete={async (row) => del.mutateAsync({ id: String(row._id) })}
        columns={[
          { key: "registrationNumber", header: "Reg #", cell: (v: any) => <span className="font-mono font-medium">{v.registrationNumber}</span> },
          { key: "vehicleType", header: t("type"), cell: (v: any) => <Badge variant="outline">{t(TYPES.find((x) => x.value === v.vehicleType)?.labelKey ?? "type_other")}</Badge> },
          { key: "ownershipType", header: t("field_ownership"), cell: (v: any) => t(OWNERSHIP.find((x) => x.value === v.ownershipType)?.labelKey ?? "own_owned") },
          { key: "capacityTons", header: "Capacity", cell: (v: any) => `${v.capacityTons}t` },
          { key: "currentStatus", header: t("status"), cell: (v: any) => <StatusBadge status={v.currentStatus} /> },
          {
            key: "expiry", header: "Doc expiry",
            cell: (v: any) => {
              const soon = ["insuranceExpiryDate", "fitnessExpiryDate", "permitExpiryDate", "pucExpiryDate"]
                .some((k) => expiringSoon(v[k]));
              return soon ? <Badge variant="warning"><AlertTriangle className="size-3 mr-1" />Expiring</Badge> : "—";
            },
          },
        ]}
        mobileCard={(v: any) => {
          const docSoon = ["insuranceExpiryDate", "fitnessExpiryDate", "permitExpiryDate", "pucExpiryDate"]
            .some((k) => expiringSoon(v[k]));
          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-mono font-semibold truncate">{v.registrationNumber}</span>
                </div>
                <StatusBadge status={v.currentStatus} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{t(TYPES.find((x) => x.value === v.vehicleType)?.labelKey ?? "type_other")}</span>
                <span>·</span>
                <span>{t(OWNERSHIP.find((x) => x.value === v.ownershipType)?.labelKey ?? "own_owned")}</span>
                <span>·</span>
                <span>{v.capacityTons}t</span>
              </div>
              {docSoon && (
                <Badge variant="warning" className="mt-1.5">
                  <AlertTriangle className="size-3 mr-1" />
                  Document expiring soon
                </Badge>
              )}
            </div>
          );
        }}
      />
      <ResourceForm
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        title={editing ? t("editVehicleTitle") : t("addVehicleTitle")}
        schema={schema}
        defaultValues={editing ? {
          ...defaults, ...editing,
          ratePerTrip: (editing.ratePerTrip ?? 0) / 100,
          ratePerTon: (editing.ratePerTon ?? 0) / 100,
          insuranceExpiryDate: editing.insuranceExpiryDate ? format(new Date(editing.insuranceExpiryDate), "yyyy-MM-dd") : "",
          fitnessExpiryDate: editing.fitnessExpiryDate ? format(new Date(editing.fitnessExpiryDate), "yyyy-MM-dd") : "",
          permitExpiryDate: editing.permitExpiryDate ? format(new Date(editing.permitExpiryDate), "yyyy-MM-dd") : "",
          pucExpiryDate: editing.pucExpiryDate ? format(new Date(editing.pucExpiryDate), "yyyy-MM-dd") : "",
          contractorId: editing.contractorId?._id ?? editing.contractorId ?? "",
        } : defaults}
        fields={fields}
        submitting={create.isPending || update.isPending}
        onSubmit={submit}
      />
    </>
  );
}
