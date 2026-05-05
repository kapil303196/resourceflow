"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";

export default function DriversPage() {
  const list = trpc.driver.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Drivers" />
      <DataTable
        data={list.data?.items ?? []}
        loading={list.isLoading}
        columns={[
          { key: "name", header: "Name" },
          { key: "phone", header: "Phone" },
          { key: "employmentType", header: "Type" },
          { key: "contractorId", header: "Contractor", cell: (d: any) => d.contractorId?.name ?? "—" },
          {
            key: "assignedVehicleId",
            header: "Vehicle",
            cell: (d: any) => d.assignedVehicleId?.registrationNumber ?? "—",
          },
          {
            key: "licenseExpiryDate",
            header: "License expires",
            cell: (d: any) =>
              d.licenseExpiryDate ? format(new Date(d.licenseExpiryDate), "PP") : "—",
          },
          { key: "currentStatus", header: "Status", cell: (d: any) => <StatusBadge status={d.currentStatus} /> },
        ]}
      />
    </div>
  );
}
