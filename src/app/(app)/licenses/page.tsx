"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ScrollText, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const schema = z.object({
  licenseNumber: z.string().min(1),
  locationId: z.string().min(1),
  issuingAuthority: z.string().optional(),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
  permittedTonnage: z.coerce.number().positive(),
  royaltyRatePerUnit: z.coerce.number().min(0).default(0),
  renewalReminderDays: z.coerce.number().min(0).default(30),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "RENEWED"]).default("ACTIVE"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  licenseNumber: "",
  locationId: "",
  issuingAuthority: "",
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: "",
  permittedTonnage: 0,
  royaltyRatePerUnit: 0,
  renewalReminderDays: 30,
  status: "ACTIVE",
  notes: "",
};

export default function LicensesPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const list = trpc.license.list.useQuery({});
  const locations = trpc.location.list.useQuery({});
  const utils = trpc.useUtils();
  const create = trpc.license.create.useMutation({
    onSuccess: () => { toast.success("License added"); utils.license.list.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.license.update.useMutation({
    onSuccess: () => { toast.success("Saved"); utils.license.list.invalidate(); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.license.delete.useMutation({
    onSuccess: () => { toast.success("Removed"); utils.license.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const fields: FieldDef[] = [
    { name: "licenseNumber", label: "License #", type: "text", required: true, span: 2 },
    {
      name: "locationId", label: "Source location", type: "select", required: true,
      options: (locations.data?.items ?? [])
        .filter((l: any) => l.type === "SOURCE")
        .map((l: any) => ({ value: l._id, label: l.name })),
    },
    { name: "issuingAuthority", label: "Issuing authority", type: "text" },
    { name: "validFrom", label: "Valid from", type: "date", required: true },
    { name: "validTo", label: "Valid to", type: "date", required: true },
    { name: "permittedTonnage", label: "Permitted tonnage", type: "number", step: 0.01, required: true },
    { name: "royaltyRatePerUnit", label: "Royalty rate/unit (major)", type: "money" },
    { name: "renewalReminderDays", label: "Renewal reminder (days)", type: "number" },
    { name: "status", label: "Status", type: "select", options: [
      { value: "ACTIVE", label: "Active" },
      { value: "SUSPENDED", label: "Suspended" },
      { value: "EXPIRED", label: "Expired" },
      { value: "RENEWED", label: "Renewed" },
    ] },
    { name: "notes", label: "Notes", type: "textarea", span: 2 },
  ];

  // Buckets for the summary cards
  const items = list.data ?? [];
  const buckets = items.reduce(
    (acc: any, l: any) => {
      const days = l.daysToExpiry ?? 0;
      if (l.status === "EXPIRED") acc.expired++;
      else if (l.status === "SUSPENDED") acc.suspended++;
      else if (days < 30) acc.expiring++;
      else acc.active++;
      return acc;
    },
    { active: 0, expiring: 0, expired: 0, suspended: 0 },
  );

  const filtered = items.filter((l: any) => {
    if (filter === "all") return true;
    const days = l.daysToExpiry ?? 0;
    if (filter === "expiring") return l.status === "ACTIVE" && days < 30 && days >= 0;
    return l.status === filter;
  });

  return (
    <>
      <ResourceList
        title={t("licenses")}
        itemName="license"
        data={filtered}
        loading={list.isLoading}
        filters={[
          { label: "All", value: "all", active: filter === "all", count: items.length },
          { label: "Active", value: "ACTIVE", active: filter === "ACTIVE", count: buckets.active },
          { label: "Expiring", value: "expiring", active: filter === "expiring", count: buckets.expiring },
          { label: "Expired", value: "EXPIRED", active: filter === "EXPIRED", count: buckets.expired },
        ]}
        onFilterChange={setFilter}
        onCreate={() => { setEditing(null); setOpen(true); }}
        onEdit={(row) => { setEditing(row); setOpen(true); }}
        onDelete={async (row) => del.mutateAsync({ id: String(row._id) })}
        beforeList={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <SummaryStat label="Active" value={buckets.active} tone="emerald" />
            <SummaryStat label="Expiring" value={buckets.expiring} tone="amber" />
            <SummaryStat label="Expired" value={buckets.expired} tone="rose" />
            <SummaryStat label="Suspended" value={buckets.suspended} tone="slate" />
          </div>
        }
        columns={[
          { key: "licenseNumber", header: "License #", cell: (l: any) => <span className="font-mono font-medium">{l.licenseNumber}</span> },
          { key: "locationId", header: "Location", cell: (l: any) => l.locationId?.name },
          { key: "validTo", header: "Expires", cell: (l: any) => format(new Date(l.validTo), "PP") },
          {
            key: "utilization", header: "Utilization",
            cell: (l: any) => (
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full",
                      l.utilization > 0.9 ? "bg-rose-500" : l.utilization > 0.7 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(100, l.utilization * 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular">{(l.utilization * 100).toFixed(0)}%</span>
              </div>
            ),
          },
          { key: "status", header: t("status"), cell: (l: any) => <StatusBadge status={l.status} /> },
        ]}
        mobileCard={(l: any) => {
          const days = l.daysToExpiry ?? 0;
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ScrollText className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-mono font-semibold truncate">{l.licenseNumber}</span>
                </div>
                <StatusBadge status={l.status} />
              </div>
              <p className="text-xs text-muted-foreground">{l.locationId?.name}</p>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-medium tabular">
                    {l.usedTonnage.toFixed(0)} / {l.permittedTonnage.toFixed(0)} ·{" "}
                    {(l.utilization * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      l.utilization > 0.9 ? "bg-rose-500" : l.utilization > 0.7 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(100, l.utilization * 100)}%` }}
                  />
                </div>
              </div>

              {l.status === "ACTIVE" && days < 30 && days >= 0 && (
                <Badge variant="warning" className="mt-1">
                  <AlertTriangle className="size-3 mr-1" />
                  Expires in {days}d
                </Badge>
              )}
            </div>
          );
        }}
      />
      <ResourceForm
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        title={editing ? "Edit license" : "Add license"}
        schema={schema}
        defaultValues={editing ? {
          ...defaults, ...editing,
          locationId: editing.locationId?._id ?? editing.locationId ?? "",
          validFrom: editing.validFrom ? format(new Date(editing.validFrom), "yyyy-MM-dd") : "",
          validTo: editing.validTo ? format(new Date(editing.validTo), "yyyy-MM-dd") : "",
          permittedTonnage: Number(editing.permittedTonnage ?? 0),
          royaltyRatePerUnit: (editing.royaltyRatePerUnit ?? 0) / 100,
        } : defaults}
        fields={fields}
        submitting={create.isPending || update.isPending}
        onSubmit={async (v) => {
          const payload = {
            ...v,
            validFrom: new Date(v.validFrom),
            validTo: new Date(v.validTo),
            royaltyRatePerUnit: Math.round(v.royaltyRatePerUnit * 100),
          };
          if (editing) await update.mutateAsync({ id: editing._id, ...payload });
          else await create.mutateAsync(payload);
        }}
      />
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-300",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className={cn("p-4 bg-gradient-to-br", tones[tone])}>
        <p className="text-[11px] uppercase tracking-wider font-medium opacity-80">{label}</p>
        <p className="text-2xl font-semibold tabular">{value}</p>
      </CardContent>
    </Card>
  );
}
