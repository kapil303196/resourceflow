"use client";
import { useState } from "react";
import { Factory, Layers } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, type DateRange } from "@/components/resource-list";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";

export default function RefineriesPage() {
  const { t, fmtTonnage, fmtDate } = useI18n();
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });

  const list = trpc.refineryBatch.list.useQuery({
    status: filter === "all" ? undefined : filter,
    from: dateRange.from ?? undefined,
    to: dateRange.to ?? undefined,
  });
  const queue = trpc.refineryBatch.unrefinedQueue.useQuery();

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
      canCreate={false}
      canEdit={false}
      canDelete={false}
      beforeList={stats}
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
  );
}
