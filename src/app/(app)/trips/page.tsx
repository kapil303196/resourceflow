"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function TripsPage() {
  const list = trpc.trip.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Trips" description="Dispatch and delivery operations" />
      <DataTable
        data={list.data ?? []}
        loading={list.isLoading}
        columns={[
          { key: "tripNumber", header: "Trip #" },
          {
            key: "scheduledDate",
            header: "Scheduled",
            cell: (t: any) => format(new Date(t.scheduledDate), "PP"),
          },
          { key: "tripType", header: "Type", cell: (t: any) => <Badge variant="outline">{t.tripType}</Badge> },
          { key: "vehicleId", header: "Vehicle", cell: (t: any) => t.vehicleId?.registrationNumber },
          { key: "driverId", header: "Driver", cell: (t: any) => t.driverId?.name ?? "—" },
          {
            key: "fromLocationId",
            header: "From → To",
            cell: (t: any) => `${t.fromLocationId?.name ?? "—"} → ${t.toLocationId?.name ?? "—"}`,
          },
          {
            key: "actualTonnage",
            header: "Tonnage",
            cell: (t: any) => `${(t.actualTonnage ?? 0).toFixed(2)} / ${(t.plannedTonnage ?? 0).toFixed(2)}`,
          },
          { key: "status", header: "Status", cell: (t: any) => <StatusBadge status={t.status} /> },
        ]}
      />
    </div>
  );
}
