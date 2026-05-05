"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RefineriesPage() {
  const list = trpc.refineryBatch.list.useQuery({});
  const queue = trpc.refineryBatch.unrefinedQueue.useQuery();
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Refinery processing" description="Process raw material into graded outputs" />

      <Card>
        <CardHeader>
          <CardTitle>Unrefined queue</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>Extractions waiting: <span className="font-semibold">{queue.data?.extractions.length ?? 0}</span></p>
          <p>Purchase deliveries waiting: <span className="font-semibold">{queue.data?.deliveries.length ?? 0}</span></p>
        </CardContent>
      </Card>

      <DataTable
        data={list.data ?? []}
        loading={list.isLoading}
        columns={[
          { key: "processedDate", header: "Date", cell: (b: any) => format(new Date(b.processedDate), "PP") },
          { key: "refineryId", header: "Refinery", cell: (b: any) => b.refineryId?.name },
          { key: "sourceType", header: "Source" },
          { key: "inputTonnage", header: "Input", cell: (b: any) => b.inputTonnage.toFixed(2) },
          { key: "processingLoss", header: "Loss", cell: (b: any) => b.processingLoss.toFixed(2) },
          { key: "outputs", header: "Outputs", cell: (b: any) => `${b.outputs.length} grade(s)` },
          { key: "status", header: "Status", cell: (b: any) => <StatusBadge status={b.status} /> },
        ]}
      />
    </div>
  );
}
