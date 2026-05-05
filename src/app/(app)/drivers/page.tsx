"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { UserCircle2, Phone, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";

const EMP = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "CONTRACTOR_SUPPLIED", label: "Contractor supplied" },
];
const SAL = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "PER_TRIP", label: "Per trip" },
  { value: "PER_TON", label: "Per ton" },
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
    { name: "name", label: "Driver name", type: "text", required: true, span: 2 },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "bloodGroup", label: "Blood group", type: "text", placeholder: "O+" },
    { name: "address", label: "Address", type: "textarea", span: 2 },
    { name: "aadhaarNumber", label: "Aadhaar #", type: "text" },
    { name: "emergencyContactName", label: "Emergency contact", type: "text" },
    { name: "emergencyContactPhone", label: "Emergency phone", type: "tel" },
    { name: "employmentType", label: "Employment", type: "select", options: EMP, required: true },
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
    { name: "licenseNumber", label: "License #", type: "text" },
    { name: "licenseClass", label: "License class", type: "text" },
    { name: "licenseExpiryDate", label: "License expiry", type: "date" },
    {
      name: "assignedVehicleId",
      label: "Assigned vehicle",
      type: "select",
      options: [
        { value: "", label: "— None —" },
        ...((vehicles.data?.items ?? []).map((v: any) => ({ value: v._id, label: v.registrationNumber }))),
      ],
    },
    { name: "salaryAmount", label: "Salary (major)", type: "money" },
    { name: "salaryCycle", label: "Cycle", type: "select", options: SAL },
    { name: "joiningDate", label: "Joining date", type: "date" },
    { name: "notes", label: "Notes", type: "textarea", span: 2 },
    { name: "isActive", label: "Active", type: "boolean" },
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
          ...EMP.map((e) => ({ label: e.label, value: e.value, active: filter === e.value })),
        ]}
        onFilterChange={setFilter}
        onCreate={() => { setEditing(null); setOpen(true); }}
        onEdit={(row) => { setEditing(row); setOpen(true); }}
        onDelete={async (row) => del.mutateAsync({ id: String(row._id) })}
        columns={[
          { key: "name", header: t("name"), cell: (d: any) => <span className="font-medium">{d.name}</span> },
          { key: "phone", header: t("phone") },
          { key: "employmentType", header: "Employment", cell: (d: any) => EMP.find((e) => e.value === d.employmentType)?.label ?? d.employmentType },
          { key: "assignedVehicleId", header: "Vehicle", cell: (d: any) => d.assignedVehicleId?.registrationNumber ?? "—" },
          { key: "licenseExpiryDate", header: "License", cell: (d: any) => d.licenseExpiryDate ? format(new Date(d.licenseExpiryDate), "PP") : "—" },
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
              <span>{EMP.find((e) => e.value === d.employmentType)?.label}</span>
            </div>
            {expiringSoon(d.licenseExpiryDate) && (
              <Badge variant="warning" className="mt-1.5">
                <AlertTriangle className="size-3 mr-1" />License expiring
              </Badge>
            )}
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
