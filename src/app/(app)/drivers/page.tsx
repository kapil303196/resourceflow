"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { UserCircle2, Phone, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, DetailField } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";

const EMP = [
  { value: "PERMANENT", labelKey: "emp_permanent" as const },
  { value: "CONTRACT", labelKey: "emp_contract" as const },
  { value: "CONTRACTOR_SUPPLIED", labelKey: "emp_contractorSupplied" as const },
];
const SAL = [
  { value: "MONTHLY", labelKey: "sal_monthly" as const },
  { value: "PER_TRIP", labelKey: "sal_perTrip" as const },
  { value: "PER_TON", labelKey: "sal_perTon" as const },
];

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  employmentType: z.enum(["PERMANENT", "CONTRACT", "CONTRACTOR_SUPPLIED"]),
  contractorId: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseClass: z.string().optional(),
  licenseExpiryDate: z.string().optional(),
  assignedVehicleId: z.string().optional(),
  salaryAmount: z.coerce.number().min(0).default(0),
  salaryCycle: z.enum(["MONTHLY", "PER_TRIP", "PER_TON"]).default("MONTHLY"),
  joiningDate: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  name: "",
  phone: "",
  address: "",
  aadhaarNumber: "",
  bloodGroup: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  employmentType: "PERMANENT",
  contractorId: "",
  licenseNumber: "",
  licenseClass: "",
  licenseExpiryDate: "",
  assignedVehicleId: "",
  salaryAmount: 0,
  salaryCycle: "MONTHLY",
  joiningDate: "",
  isActive: true,
  notes: "",
};

function expiringSoon(date?: string | Date) {
  if (!date) return false;
  const days = (new Date(date).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 30;
}

export default function DriversPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const list = trpc.driver.list.useQuery({
    search,
    extra: filter !== "all" ? { employmentType: filter } : {},
  } as any);
  const contractors = trpc.contractor.list.useQuery({});
  const vehicles = trpc.vehicle.list.useQuery({});
  const utils = trpc.useUtils();

  const create = trpc.driver.create.useMutation({
    onSuccess: () => { toast.success(t("toastAdded")); utils.driver.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.driver.update.useMutation({
    onSuccess: () => { toast.success(t("toastSaved")); utils.driver.list.invalidate(); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.driver.delete.useMutation({
    onSuccess: () => { toast.success(t("toastRemoved")); utils.driver.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const fields: FieldDef[] = [
    { name: "name", label: t("name"), type: "text", required: true, span: 2 },
    { name: "phone", label: t("phone"), type: "tel" },
    { name: "bloodGroup", label: t("field_bloodGroup"), type: "text", placeholder: "O+" },
    { name: "address", label: t("address"), type: "textarea", span: 2 },
    { name: "aadhaarNumber", label: t("field_aadhaar"), type: "text" },
    { name: "emergencyContactName", label: t("field_emergencyContact"), type: "text" },
    { name: "emergencyContactPhone", label: t("field_emergencyPhone"), type: "tel" },
    { name: "employmentType", label: t("field_employment"), type: "select", required: true,
      options: EMP.map((e) => ({ value: e.value, label: t(e.labelKey) })),
    },
    {
      name: "contractorId",
      label: "Contractor",
      type: "select",
      options: [
        { value: "", label: "— None —" },
        ...((contractors.data?.items ?? []).map((c: any) => ({ value: c._id, label: c.name }))),
      ],
      showIf: (v) => v.employmentType === "CONTRACTOR_SUPPLIED",
    },
    { name: "licenseNumber", label: t("field_licenseNumber"), type: "text" },
    { name: "licenseClass", label: t("field_licenseClass"), type: "text" },
    { name: "licenseExpiryDate", label: t("field_licenseExpiry"), type: "date" },
    {
      name: "assignedVehicleId",
      label: t("field_assignedVehicle"),
      type: "select",
      options: [
        { value: "", label: "— None —" },
        ...((vehicles.data?.items ?? []).map((v: any) => ({ value: v._id, label: v.registrationNumber }))),
      ],
    },
    { name: "salaryAmount", label: t("field_salary"), type: "money" },
    { name: "salaryCycle", label: t("field_salaryCycle"), type: "select",
      options: SAL.map((s) => ({ value: s.value, label: t(s.labelKey) })),
    },
    { name: "joiningDate", label: t("field_joiningDate"), type: "date" },
    { name: "notes", label: t("notes"), type: "textarea", span: 2 },
    { name: "isActive", label: t("field_active"), type: "boolean" },
  ];

  async function submit(v: FormValues) {
    const payload: any = { ...v };
    payload.salaryAmount = Math.round((v.salaryAmount ?? 0) * 100);
    for (const k of ["licenseExpiryDate", "joiningDate"] as const) {
      if (v[k]) payload[k] = new Date(v[k]!);
      else delete payload[k];
    }
    if (!payload.contractorId) delete payload.contractorId;
    if (!payload.assignedVehicleId) delete payload.assignedVehicleId;
    if (editing) await update.mutateAsync({ id: editing._id, ...payload });
    else await create.mutateAsync(payload);
  }

  return (
    <>
      <ResourceList
        title={t("drivers")}
        itemName={t("driver")}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        search={search}
        onSearchChange={setSearch}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          ...EMP.map((e) => ({ label: t(e.labelKey), value: e.value, active: filter === e.value })),
        ]}
        onFilterChange={setFilter}
        onCreate={() => { setEditing(null); setOpen(true); }}
        onEdit={(row) => { setEditing(row); setOpen(true); }}
        onDelete={async (row) => del.mutateAsync({ id: String(row._id) })}
        columns={[
          { key: "name", header: t("name"), cell: (d: any) => <span className="font-medium">{d.name}</span> },
          { key: "phone", header: t("phone") },
          { key: "employmentType", header: t("field_employment"), cell: (d: any) => t(EMP.find((e) => e.value === d.employmentType)?.labelKey ?? "emp_permanent") },
          { key: "assignedVehicleId", header: t("vehicle"), cell: (d: any) => d.assignedVehicleId?.registrationNumber ?? "—" },
          { key: "licenseExpiryDate", header: t("license"), cell: (d: any) => d.licenseExpiryDate ? format(new Date(d.licenseExpiryDate), "PP") : "—" },
          { key: "currentStatus", header: t("status"), cell: (d: any) => <StatusBadge status={d.currentStatus} /> },
        ]}
        mobileCard={(d: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserCircle2 className="size-4 text-muted-foreground shrink-0" />
                <span className="font-semibold truncate">{d.name}</span>
              </div>
              <StatusBadge status={d.currentStatus} />
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {d.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{d.phone}</span>}
              {d.assignedVehicleId?.registrationNumber && <span className="font-mono">{d.assignedVehicleId.registrationNumber}</span>}
              <span>{t(EMP.find((e) => e.value === d.employmentType)?.labelKey ?? "emp_permanent")}</span>
            </div>
            {expiringSoon(d.licenseExpiryDate) && (
              <Badge variant="warning" className="mt-1.5">
                <AlertTriangle className="size-3 mr-1" />License expiring
              </Badge>
            )}
          </div>
        )}
        detailTitle={(d: any) => d.name}
        detailRender={(d: any) => (
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailField label={t("status")} value={<StatusBadge status={d.currentStatus} />} />
            <DetailField label={t("phone")} value={d.phone} />
            <DetailField label="Employment" value={t(EMP.find((e) => e.value === d.employmentType)?.labelKey ?? "emp_permanent")} />
            <DetailField label="Contractor" value={d.contractorId?.name} />
            <DetailField label="Vehicle" value={d.assignedVehicleId?.registrationNumber} />
            <DetailField label="License #" value={d.licenseNumber} />
            <DetailField label="License class" value={d.licenseClass} />
            <DetailField label="License expiry" value={d.licenseExpiryDate ? format(new Date(d.licenseExpiryDate), "PP") : null} />
            <DetailField label="Aadhaar" value={d.aadhaarNumber} />
            <DetailField label="Blood group" value={d.bloodGroup} />
            <DetailField label="Joining" value={d.joiningDate ? format(new Date(d.joiningDate), "PP") : null} />
            <DetailField label="Salary" value={`₹${((d.salaryAmount ?? 0) / 100).toLocaleString("en-IN")} (${t(SAL.find((s) => s.value === d.salaryCycle)?.labelKey ?? "sal_monthly")})`} />
            <DetailField span={2} label="Emergency contact" value={d.emergencyContactName ? `${d.emergencyContactName} · ${d.emergencyContactPhone ?? ""}` : null} />
            <DetailField span={2} label={t("address")} value={d.address} />
            {d.notes && <DetailField span={2} label={t("notes")} value={d.notes} />}
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        title={editing ? t("editDriverTitle") : t("addDriverTitle")}
        schema={schema}
        defaultValues={editing ? {
          ...defaults, ...editing,
          salaryAmount: (editing.salaryAmount ?? 0) / 100,
          contractorId: editing.contractorId?._id ?? editing.contractorId ?? "",
          assignedVehicleId: editing.assignedVehicleId?._id ?? editing.assignedVehicleId ?? "",
          licenseExpiryDate: editing.licenseExpiryDate ? format(new Date(editing.licenseExpiryDate), "yyyy-MM-dd") : "",
          joiningDate: editing.joiningDate ? format(new Date(editing.joiningDate), "yyyy-MM-dd") : "",
        } : defaults}
        fields={fields}
        submitting={create.isPending || update.isPending}
        onSubmit={submit}
      />
    </>
  );
}
