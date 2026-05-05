"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function FleetPage() {
  const list = trpc.vehicle.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Fleet" description="Vehicles, ownership and document expiry" />
      <DataTable
        data={list.data?.items ?? []}
        loading={list.isLoading}
        columns={[
          { key: "registrationNumber", header: "Reg #" },
          { key: "vehicleType", header: "Type", cell: (v: any) => <Badge variant="outline">{v.vehicleType}</Badge> },
          { key: "ownershipType", header: "Ownership" },
          { key: "contractorId", header: "Contractor", cell: (v: any) => v.contractorId?.name ?? "—" },
          { key: "capacityTons", header: "Capacity" },
          { key: "currentStatus", header: "Status", cell: (v: any) => <StatusBadge status={v.currentStatus} /> },
          {
            key: "insuranceExpiryDate",
            header: "Insurance",
            cell: (v: any) =>
              v.insuranceExpiryDate ? format(new Date(v.insuranceExpiryDate), "PP") : "—",
          },
        ]}
      />
    </div>
  );
}
