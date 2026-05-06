"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Truck, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, DetailField, type DateRange } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";

const TRIP_TYPE_KEYS: Record<string, string> = {
  DELIVERY: "tripTypeDelivery",
  EXTRACTION: "tripTypeExtraction",
  INTERNAL_TRANSFER: "tripTypeTransfer",
  PURCHASE_PICKUP: "tripTypePickup",
};

const schema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().optional(),
  tripType: z.enum(["DELIVERY", "EXTRACTION", "INTERNAL_TRANSFER", "PURCHASE_PICKUP"]),
  scheduledDate: z.string().min(1),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  salesOrderId: z.string().optional(),
  plannedTonnage: z.coerce.number().min(0).default(0),
  materialGradeId: z.string().optional(),
  distanceKm: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;
const defaults: FormValues = {
  vehicleId: "",
  driverId: "",
  tripType: "DELIVERY",
  scheduledDate: new Date().toISOString().slice(0, 10),
  fromLocationId: "",
  toLocationId: "",
  salesOrderId: "",
  plannedTonnage: 0,
  materialGradeId: "",
  distanceKm: 0,
  notes: "",
};

export default function TripsPage() {
  const { t, fmtTonnage, fmtMoney, fmtDate } = useI18n();
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [open, setOpen] = useState(false);
  const [completing, setCompleting] = useState<any | null>(null);

  const list = trpc.trip.list.useQuery({
    status: filter === "all" ? undefined : filter,
    from: dateRange.from ?? undefined,
    to: dateRange.to ?? undefined,
  });
  const vehicles = trpc.vehicle.list.useQuery({});
  const drivers = trpc.driver.list.useQuery({});
  const locations = trpc.location.list.useQuery({});
  const orders = trpc.salesOrder.list.useQuery({});
  const grades = trpc.materialGrade.list.useQuery({});
  const utils = trpc.useUtils();

  const create = trpc.trip.create.useMutation({
    onSuccess: () => { toast.success(t("toastAdded")); utils.trip.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const start = trpc.trip.start.useMutation({
    onSuccess: () => { toast.success(t("toastTripStarted") ?? t("toastUpdated")); utils.trip.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const complete = trpc.trip.complete.useMutation({
    onSuccess: () => { toast.success(t("toastTripCompleted") ?? t("toastUpdated")); utils.trip.list.invalidate(); setCompleting(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.trip.cancel.useMutation({
    onSuccess: () => { toast.success(t("toastUpdated")); utils.trip.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const tripTypeOptions = Object.entries(TRIP_TYPE_KEYS).map(([value, k]) => ({
    value,
    label: t(k as any),
  }));

  const fields: FieldDef[] = [
    { name: "tripType", label: t("type"), type: "select", required: true, options: tripTypeOptions, span: 2 },
    {
      name: "vehicleId", label: t("vehicle"), type: "select", required: true,
      options: (vehicles.data?.items ?? []).map((v: any) => ({ value: v._id, label: v.registrationNumber })),
    },
    {
      name: "driverId", label: t("driver"), type: "select",
      options: [
        { value: "", label: t("emptyNone") },
        ...((drivers.data?.items ?? []).map((d: any) => ({ value: d._id, label: d.name }))),
      ],
    },
    { name: "scheduledDate", label: t("scheduled") + " " + t("date"), type: "date", required: true },
    { name: "plannedTonnage", label: t("tonnage"), type: "number", step: 0.01 },
    {
      name: "fromLocationId", label: "From", type: "select",
      options: [
        { value: "", label: t("emptySelect") },
        ...((locations.data?.items ?? []).map((l: any) => ({ value: l._id, label: `${l.name} (${l.type})` }))),
      ],
    },
    {
      name: "toLocationId", label: "To", type: "select",
      options: [
        { value: "", label: t("emptySelect") },
        ...((locations.data?.items ?? []).map((l: any) => ({ value: l._id, label: `${l.name} (${l.type})` }))),
      ],
    },
    {
      name: "salesOrderId", label: t("order"), type: "select",
      options: [
        { value: "", label: t("emptyNone") },
        ...((orders.data ?? []).filter((o: any) => o.status !== "COMPLETED" && o.status !== "CANCELLED")
          .map((o: any) => ({ value: o._id, label: `${o.orderNumber} · ${o.customerId?.name ?? ""}` }))),
      ],
      showIf: (v) => v.tripType === "DELIVERY",
      span: 2,
    },
    {
      name: "materialGradeId", label: "Grade", type: "select",
      options: [
        { value: "", label: t("emptyNone") },
        ...((grades.data?.items ?? []).map((g: any) => ({ value: g._id, label: g.name }))),
      ],
    },
    { name: "distanceKm", label: t("field_distanceKm"), type: "number" },
    { name: "notes", label: t("notes"), type: "textarea", span: 2 },
  ];

  return (
    <>
      <ResourceList
        title={t("trips")}
        itemName={t("trip")}
        data={list.data ?? []}
        loading={list.isLoading}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          { label: t("filterScheduled"), value: "SCHEDULED", active: filter === "SCHEDULED" },
          { label: t("filterInTransit"), value: "IN_TRANSIT", active: filter === "IN_TRANSIT" },
          { label: t("filterCompleted"), value: "COMPLETED", active: filter === "COMPLETED" },
          { label: t("filterCancelled"), value: "CANCELLED", active: filter === "CANCELLED" },
        ]}
        onFilterChange={setFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onCreate={() => setOpen(true)}
        canEdit={false}
        canDelete={false}
        rowActions={(row: any) => {
          const out: { label: string; onClick: () => void; destructive?: boolean }[] = [];
          if (row.status === "SCHEDULED") {
            out.push({ label: t("startTripAction"), onClick: () => start.mutate({ id: row._id }) });
          }
          if (row.status === "IN_TRANSIT") {
            out.push({
              label: t("completeTripAction"),
              onClick: () => setCompleting(row),
            });
          }
          if (!["COMPLETED", "CANCELLED"].includes(row.status)) {
            out.push({
              label: t("cancelTripAction"),
              destructive: true,
              onClick: () => {
                const r = window.prompt(t("cancelReason"));
                if (r) cancel.mutate({ id: row._id, reason: r });
              },
            });
          }
          return out;
        }}
        columns={[
          { key: "tripNumber", header: t("tripNumber"), cell: (tr: any) => <span className="font-mono font-medium">{tr.tripNumber}</span> },
          { key: "scheduledDate", header: t("scheduled"), cell: (tr: any) => fmtDate(tr.scheduledDate) },
          { key: "tripType", header: t("type"), cell: (tr: any) => <Badge variant="outline">{t(TRIP_TYPE_KEYS[tr.tripType] as any)}</Badge> },
          { key: "vehicleId", header: t("vehicle"), cell: (tr: any) => tr.vehicleId?.registrationNumber },
          { key: "driverId", header: t("driver"), cell: (tr: any) => tr.driverId?.name ?? "—" },
          {
            key: "route", header: t("routeArrow"),
            cell: (tr: any) => `${tr.fromLocationId?.name ?? "—"} → ${tr.toLocationId?.name ?? "—"}`,
          },
          { key: "actualTonnage", header: t("tonnage"), cell: (tr: any) => fmtTonnage(tr.actualTonnage ?? tr.plannedTonnage ?? 0) },
          { key: "status", header: t("status"), cell: (tr: any) => <StatusBadge status={tr.status} /> },
        ]}
        mobileCard={(tr: any) => (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Truck className="size-4 text-muted-foreground shrink-0" />
                <span className="font-mono font-semibold">{tr.tripNumber}</span>
                <Badge variant="outline" className="text-[10px]">{t(TRIP_TYPE_KEYS[tr.tripType] as any)}</Badge>
              </div>
              <StatusBadge status={tr.status} />
            </div>
            <div className="text-sm">
              <span className="font-mono">{tr.vehicleId?.registrationNumber}</span>
              {tr.driverId?.name && <span className="text-muted-foreground"> · {tr.driverId.name}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {tr.fromLocationId?.name ?? "—"} → {tr.toLocationId?.name ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{fmtDate(tr.scheduledDate)}</span>
              <span className="font-medium tabular">
                {fmtTonnage(tr.actualTonnage ?? tr.plannedTonnage ?? 0)}
              </span>
            </div>
          </div>
        )}
        detailTitle={(tr: any) => `${tr.tripNumber} · ${t(TRIP_TYPE_KEYS[tr.tripType] as any)}`}
        detailRender={(tr: any) => (
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailField label={t("status")} value={<StatusBadge status={tr.status} />} />
            <DetailField label={t("type")} value={t(TRIP_TYPE_KEYS[tr.tripType] as any)} />
            <DetailField label={t("vehicle")} value={tr.vehicleId?.registrationNumber} />
            <DetailField label={t("driver")} value={tr.driverId?.name} />
            <DetailField label={t("scheduled")} value={fmtDate(tr.scheduledDate)} />
            <DetailField label={t("tonnage")} value={fmtTonnage(tr.actualTonnage ?? tr.plannedTonnage ?? 0)} />
            <DetailField label="From" value={tr.fromLocationId?.name} />
            <DetailField label="To" value={tr.toLocationId?.name} />
            {tr.salesOrderId?.orderNumber && (
              <DetailField span={2} label={t("order")} value={tr.salesOrderId.orderNumber} />
            )}
            <DetailField label="Distance" value={tr.distanceKm ? `${tr.distanceKm} km` : null} />
            <DetailField label="Trip cost" value={fmtMoney(tr.tripCost ?? 0)} />
            <DetailField label="Fuel cost" value={fmtMoney(tr.fuelCost ?? 0)} />
            <DetailField label="Other expenses" value={fmtMoney(tr.otherExpenses ?? 0)} />
            {tr.notes && <DetailField span={2} label={t("notes")} value={tr.notes} />}
          </div>
        )}
      />

      <ResourceForm
        open={open}
        onOpenChange={setOpen}
        title={t("newTripTitle")}
        schema={schema}
        defaultValues={defaults}
        fields={fields}
        submitting={create.isPending}
        onSubmit={async (v) => {
          const payload: any = {
            vehicleId: v.vehicleId,
            tripType: v.tripType,
            scheduledDate: new Date(v.scheduledDate),
            plannedTonnage: v.plannedTonnage,
            distanceKm: v.distanceKm,
            notes: v.notes,
          };
          if (v.driverId) payload.driverId = v.driverId;
          if (v.fromLocationId) payload.fromLocationId = v.fromLocationId;
          if (v.toLocationId) payload.toLocationId = v.toLocationId;
          if (v.salesOrderId) payload.salesOrderId = v.salesOrderId;
          if (v.materialGradeId) {
            payload.materials = [{ materialGradeId: v.materialGradeId, tonnage: v.plannedTonnage ?? 0 }];
          }
          await create.mutateAsync(payload);
        }}
      />

      <ResourceForm
        open={!!completing}
        onOpenChange={(o) => { if (!o) setCompleting(null); }}
        title={t("completeTripAction")}
        description={completing?.tripNumber}
        schema={z.object({
          actualTonnage: z.coerce.number().min(0),
          fuelCost: z.coerce.number().min(0).default(0),
        })}
        defaultValues={{ actualTonnage: completing?.plannedTonnage ?? 0, fuelCost: 0 }}
        fields={[
          { name: "actualTonnage", label: t("tonnage"), type: "number", step: 0.01, required: true },
          { name: "fuelCost", label: t("field_fuelCost"), type: "money" },
        ]}
        submitting={complete.isPending}
        onSubmit={async (v: any) => {
          await complete.mutateAsync({
            id: completing._id,
            actualTonnage: v.actualTonnage,
            fuelCost: Math.round((v.fuelCost ?? 0) * 100),
          });
        }}
      />
    </>
  );
}
