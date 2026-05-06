"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Factory, Layers, Plus, X as XIcon, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, type DateRange } from "@/components/resource-list";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export default function RefineriesPage() {
  const { t, fmtTonnage, fmtDate } = useI18n();
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [createOpen, setCreateOpen] = useState(false);

  const list = trpc.refineryBatch.list.useQuery({
    status: filter === "all" ? undefined : filter,
    from: dateRange.from ?? undefined,
    to: dateRange.to ?? undefined,
  });
  const queue = trpc.refineryBatch.unrefinedQueue.useQuery();
  const utils = trpc.useUtils();

  const complete = trpc.refineryBatch.complete.useMutation({
    onSuccess: () => {
      toast.success("Batch posted to inventory");
      utils.refineryBatch.list.invalidate();
      utils.refineryBatch.unrefinedQueue.invalidate();
      utils.inventory.currentStock.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.refineryBatch.cancel.useMutation({
    onSuccess: () => {
      toast.success("Cancelled");
      utils.refineryBatch.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const stats = (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-medium uppercase tracking-wider">
            <Layers className="size-3.5" />
            Extractions queued
          </div>
          <p className="text-2xl font-semibold tabular mt-1">
            {queue.data?.extractions.length ?? 0}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-xs font-medium uppercase tracking-wider">
            <Layers className="size-3.5" />
            Purchases queued
          </div>
          <p className="text-2xl font-semibold tabular mt-1">
            {queue.data?.deliveries.length ?? 0}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <ResourceList
        title={t("refineries")}
        itemName="refinery batch"
        data={list.data ?? []}
        loading={list.isLoading}
        filters={[
          { label: t("filterAll"), value: "all", active: filter === "all" },
          { label: t("inProgress"), value: "IN_PROGRESS", active: filter === "IN_PROGRESS" },
          { label: t("filterCompleted"), value: "COMPLETED", active: filter === "COMPLETED" },
        ]}
        onFilterChange={setFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onCreate={() => setCreateOpen(true)}
        canEdit={false}
        canDelete={false}
        beforeList={stats}
        rowActions={(b: any) => {
          const out: { label: string; onClick: () => void; destructive?: boolean }[] = [];
          if (b.status === "IN_PROGRESS") {
            out.push({
              label: "Complete & post to inventory",
              onClick: () => complete.mutate({ id: String(b._id) }),
            });
            out.push({
              label: "Cancel batch",
              destructive: true,
              onClick: () => {
                const r = window.prompt("Cancellation reason?");
                if (r) cancel.mutate({ id: String(b._id), reason: r });
              },
            });
          }
          return out;
        }}
        columns={[
          { key: "processedDate", header: t("date"), cell: (b: any) => fmtDate(b.processedDate) },
          { key: "refineryId", header: t("refineries"), cell: (b: any) => b.refineryId?.name },
          { key: "sourceType", header: "Source", cell: (b: any) => <Badge variant="outline">{b.sourceType}</Badge> },
          { key: "inputTonnage", header: "Input", cell: (b: any) => fmtTonnage(b.inputTonnage) },
          { key: "processingLoss", header: "Loss", cell: (b: any) => fmtTonnage(b.processingLoss) },
          { key: "outputs", header: "Outputs", cell: (b: any) => `${b.outputs?.length ?? 0}` },
          { key: "status", header: t("status"), cell: (b: any) => <StatusBadge status={b.status} /> },
        ]}
        mobileCard={(b: any) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Factory className="size-4 text-muted-foreground shrink-0" />
                <span className="font-semibold truncate">{b.refineryId?.name}</span>
              </div>
              <StatusBadge status={b.status} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fmtDate(b.processedDate)}</span>
              <Badge variant="outline" className="text-[10px]">{b.sourceType}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs pt-1.5 mt-1 border-t">
              <span className="text-muted-foreground">In → Out</span>
              <span className="font-medium tabular">
                {fmtTonnage(b.inputTonnage)} → {b.outputs?.length ?? 0} grades
              </span>
            </div>
          </div>
        )}
      />
      <CreateBatchSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        queue={queue.data}
      />
    </>
  );
}

/* -------------------- Create batch sheet -------------------- */

type SourceRef = {
  sourceType: "EXTRACTION" | "PURCHASE";
  sourceId: string;
  tonnage: number;
  label: string;
};

function CreateBatchSheet({
  open,
  onOpenChange,
  queue,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  queue: any;
}) {
  const utils = trpc.useUtils();
  const refineries = trpc.refinery.list.useQuery({});
  const grades = trpc.materialGrade.list.useQuery({});
  const locations = trpc.location.list.useQuery({});

  const create = trpc.refineryBatch.create.useMutation({
    onSuccess: async (res: any) => {
      toast.success("Batch created — completing and posting to inventory…");
      // Auto-complete so the inventory IN entries fire
      try {
        await complete.mutateAsync({ id: res.id });
      } catch {/* surfaces below */}
      utils.refineryBatch.list.invalidate();
      utils.refineryBatch.unrefinedQueue.invalidate();
      utils.inventory.currentStock.invalidate();
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });
  const complete = trpc.refineryBatch.complete.useMutation({
    onError: (e) => toast.error(e.message),
  });

  // Build the source dropdown options from the queue
  const sourceOptions: SourceRef[] = useMemo(() => {
    if (!queue) return [];
    const ext: SourceRef[] = (queue.extractions ?? []).map((e: any) => ({
      sourceType: "EXTRACTION" as const,
      sourceId: String(e._id),
      tonnage: Number(e.tonnage ?? 0),
      label: `Extraction · ${e.location ?? "—"} · ${e.tonnage} t · ${e.ref ?? ""}`,
    }));
    const pur: SourceRef[] = (queue.deliveries ?? []).map((d: any) => ({
      sourceType: "PURCHASE" as const,
      sourceId: String(d._id),
      tonnage: Number(d.tonnage ?? 0),
      label: `Purchase · ${d.location ?? "—"} · ${d.tonnage} t · ${d.ref ?? ""}`,
    }));
    return [...ext, ...pur];
  }, [queue]);

  // Form state
  const [refineryId, setRefineryId] = useState("");
  const [sourceKey, setSourceKey] = useState(""); // sourceType:sourceId
  const [processedDate, setProcessedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lossPct, setLossPct] = useState(2); // default 2% loss
  type OutRow = { id: string; materialGradeId: string; tonnage: number; locationId: string };
  const [outputs, setOutputs] = useState<OutRow[]>([]);

  function reset() {
    setRefineryId("");
    setSourceKey("");
    setProcessedDate(new Date().toISOString().slice(0, 10));
    setLossPct(2);
    setOutputs([]);
  }

  const selectedSource =
    sourceOptions.find((s) => `${s.sourceType}:${s.sourceId}` === sourceKey) ?? null;

  const inputTonnage = selectedSource?.tonnage ?? 0;
  const lossTonnage = +(inputTonnage * (lossPct / 100)).toFixed(3);
  const expectedOutput = +(inputTonnage - lossTonnage).toFixed(3);
  const outputSum = outputs.reduce((s, o) => s + (Number(o.tonnage) || 0), 0);
  const tolerance = expectedOutput * 0.001;
  const balanceOk = Math.abs(outputSum - expectedOutput) <= Math.max(tolerance, 0.001);
  const remaining = +(expectedOutput - outputSum).toFixed(3);

  function addRow() {
    setOutputs((p) => [
      ...p,
      {
        id: Math.random().toString(36).slice(2),
        materialGradeId: "",
        tonnage: remaining > 0 ? +remaining.toFixed(2) : 0,
        locationId: "",
      },
    ]);
  }
  function updateRow(id: string, patch: Partial<OutRow>) {
    setOutputs((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setOutputs((p) => p.filter((r) => r.id !== id));
  }

  // Auto-seed one row when source is picked and outputs is empty
  useMemo(() => {
    if (selectedSource && outputs.length === 0) addRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  function canSubmit() {
    return (
      !!refineryId &&
      !!selectedSource &&
      outputs.length > 0 &&
      outputs.every((o) => o.materialGradeId && o.locationId && o.tonnage > 0) &&
      balanceOk
    );
  }

  async function submit() {
    if (!canSubmit() || !selectedSource) return;
    await create.mutateAsync({
      refineryId,
      sourceType: selectedSource.sourceType,
      sourceId: selectedSource.sourceId,
      processedDate: new Date(processedDate),
      inputTonnage,
      processingLoss: lossTonnage,
      outputs: outputs.map((o) => ({
        materialGradeId: o.materialGradeId,
        tonnage: Number(o.tonnage),
        locationId: o.locationId,
      })),
    });
  }

  const refineryOpts = refineries.data?.items ?? [];
  const gradeOpts = grades.data?.items ?? [];
  const locationOpts = (locations.data?.items ?? []).filter(
    (l: any) => l.type === "WAREHOUSE" || l.type === "REFINERY",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader>
          <SheetTitle>Process refinery batch</SheetTitle>
          <SheetDescription>
            Pick a queued source, set the loss %, and split the output into graded inventory.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex-1 space-y-4">
          {/* Refinery + source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Refinery</Label>
              <Select value={refineryId || "__none__"} onValueChange={(v) => setRefineryId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select refinery" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {refineryOpts.map((r: any) => (
                    <SelectItem key={r._id} value={String(r._id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source (from queue)</Label>
              <Select value={sourceKey || "__none__"} onValueChange={(v) => setSourceKey(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select queued source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {sourceOptions.map((s) => (
                    <SelectItem key={`${s.sourceType}:${s.sourceId}`} value={`${s.sourceType}:${s.sourceId}`}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nothing in the queue. Record an extraction or take a purchase delivery first.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Processed date</Label>
              <Input type="date" value={processedDate} onChange={(e) => setProcessedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Processing loss (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={lossPct}
                onChange={(e) => setLossPct(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Tonnage summary */}
          {selectedSource && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Input</p>
                  <p className="text-lg font-semibold tabular">{inputTonnage.toFixed(2)} t</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loss</p>
                  <p className="text-lg font-semibold tabular text-amber-600 dark:text-amber-400">
                    -{lossTonnage.toFixed(2)} t
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Output target</p>
                  <p className="text-lg font-semibold tabular text-emerald-600 dark:text-emerald-400">
                    {expectedOutput.toFixed(2)} t
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Output split rows */}
          {selectedSource && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Output split</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="size-3.5 mr-1" />
                  Add grade
                </Button>
              </div>
              <div className="space-y-2">
                {outputs.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-[10px]">Grade</Label>
                      <Select value={row.materialGradeId || "__none__"} onValueChange={(v) => updateRow(row.id, { materialGradeId: v === "__none__" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select —</SelectItem>
                          {gradeOpts.map((g: any) => (
                            <SelectItem key={g._id} value={String(g._id)}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px]">Tonnage</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={row.tonnage}
                        onChange={(e) => updateRow(row.id, { tonnage: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-[10px]">Store at</Label>
                      <Select value={row.locationId || "__none__"} onValueChange={(v) => updateRow(row.id, { locationId: v === "__none__" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select —</SelectItem>
                          {locationOpts.map((l: any) => (
                            <SelectItem key={l._id} value={String(l._id)}>
                              {l.name} ({l.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeRow(row.id)}>
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Balance indicator */}
              <div
                className={cn(
                  "flex items-center justify-between text-xs px-3 py-2 rounded-md border",
                  balanceOk
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300/50 text-emerald-800 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-300/50 text-rose-800 dark:text-rose-200",
                )}
              >
                <span>
                  Output sum: <strong className="tabular">{outputSum.toFixed(3)}</strong> /{" "}
                  <strong className="tabular">{expectedOutput.toFixed(3)}</strong> t
                </span>
                <span className="font-medium">
                  {balanceOk ? (
                    <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> Balanced</span>
                  ) : (
                    `Off by ${Math.abs(remaining).toFixed(3)} t`
                  )}
                </span>
              </div>
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending || complete.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit() || create.isPending || complete.isPending}>
            {create.isPending || complete.isPending ? "Processing…" : "Process & post to inventory"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
