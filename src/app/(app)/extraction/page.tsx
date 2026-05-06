"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pickaxe } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney, formatTonnage } from "@/lib/utils";

const schema = z.object({
  licenseId: z.string().min(1),
  locationId: z.string().min(1),
  extractedDate: z.string().min(1),
  grossTonnage: z.coerce.number().positive(),
  vehicleId: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;
const defaults: FormValues = {
  licenseId: "",
  locationId: "",
  extractedDate: new Date().toISOString().slice(0, 10),
  grossTonnage: 0,
  vehicleId: "",
  notes: "",
};

export default function ExtractionPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const list = trpc.extraction.list.useQuery({ status: filter === "all" ? undefined : filter });
  const licenses = trpc.license.list.useQuery({ status: "ACTIVE" });
  const locations = trpc.location.list.useQuery({});
  const vehicles = trpc.vehicle.list.useQuery({});
  const utils = trpc.useUtils();
  const create = trpc.extraction.create.useMutation({
    onSuccess: () => { toast.success(t("toastExtractionRecorded")); utils.extraction.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.extraction.cancel.useMutation({
    onSuccess: () => { toast.success(t("toastUpdated")); utils.extraction.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const fields: FieldDef[] = [
    {
      name: "licenseId", label: t("license"), type: "select", required: true, span: 2,
      options: (licenses.data ?? []).map((l: any) => ({
        value: l._id,
        label: `${l.licenseNumber} (${l.usedTonnage.toFixed(0)}/${l.permittedTonnage.toFixed(0)} used)`,
      })),
    },
    {
      name: "locationId", label: t("loc_warehouse"), type: "select", required: true,
      options: (locations.data?.items ?? []).filter((l: any) => l.type === "SOURCE").map((l: any) => ({ value: l._id, label: l.name })),
    },
    { name: "extractedDate", label: t("field_extractedDate"), type: "date", required: true },
    { name: "grossTonnage", label: t("field_grossTonnage"), type: "number", step: 0.01, required: true, hint: "Will auto-decrement license usage" },
    {
      name: "vehicleId", label: t("field_vehicleOptional"), type: "select",
      options: [
        { value: "", label: "— None —" },
        ...((vehicles.data?.items ?? []).map((v: any) => ({ value: v._id, label: v.registrationNumber }))),
      ],
    },
    { name: "notes", label: t("notes"), type: "textarea", span: 2 },
  ];

  return (
    <>
      <ResourceList
        title={t("extraction")}
        itemName={t("extraction")}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          { label: t("filterPending"), value: "PENDING", active: filter === "PENDING" },
          { label: t("filterAtRefinery"), value: "AT_REFINERY", active: filter === "AT_REFINERY" },
          { label: t("filterRefined"), value: "REFINED", active: filter === "REFINED" },
        ]}
        onFilterChange={setFilter}
        onCreate={() => setOpen(true)}
        canEdit={false}
        canDelete={false}
        rowActions={(row: any) =>
          row.status !== "CANCELLED" && row.status !== "REFINED"
            ? [{
                label: t("cancelBatchAction"),
                destructive: true,
                onClick: async () => {
                  const reason = window.prompt("Cancellation reason?");
                  if (!reason) return;
                  await cancel.mutateAsync({ id: row._id, reason });
                },
              }]
            : []
        }
        columns={[
          { key: "batchNumber", header: "#", cell: (e: any) => <span className="font-mono font-medium text-xs">{e.batchNumber ?? "—"}</span> },
          { key: "extractedDate", header: t("date"), cell: (e: any) => format(new Date(e.extractedDate), "PP") },
          { key: "licenseId", header: t("license"), cell: (e: any) => e.licenseId?.licenseNumber },
          { key: "locationId", header: t("loc_source"), cell: (e: any) => e.locationId?.name },
          { key: "grossTonnage", header: "Tonnage", cell: (e: any) => formatTonnage(e.grossTonnage) },
          { key: "royaltyAmount", header: "Royalty", cell: (e: any) => formatMoney(e.royaltyAmount ?? 0) },
          { key: "status", header: t("status"), cell: (e: any) => <StatusBadge status={e.status} /> },
        ]}
        mobileCard={(e: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Pickaxe className="size-4 text-muted-foreground shrink-0" />
                <span className="font-mono font-semibold text-xs">{e.batchNumber ?? ""}</span>
                <span className="font-medium">{formatTonnage(e.grossTonnage)}</span>
              </div>
              <StatusBadge status={e.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              {e.licenseId?.licenseNumber} · {e.locationId?.name}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{format(new Date(e.extractedDate), "MMM d, yyyy")}</span>
              <span className="font-medium tabular">{formatMoney(e.royaltyAmount ?? 0)} royalty</span>
            </div>
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={setOpen}
        title={t("recordExtractionTitle")}
        description={t("recordExtractionDesc")}
        schema={schema}
        defaultValues={defaults}
        fields={fields}
        submitting={create.isPending}
        onSubmit={async (v) => {
          const payload: any = { ...v, extractedDate: new Date(v.extractedDate) };
          if (!payload.vehicleId) delete payload.vehicleId;
          await create.mutateAsync(payload);
        }}
      />
    </>
  );
}
