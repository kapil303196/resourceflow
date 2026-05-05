"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";

export default function ExtractionPage() {
  const list = trpc.extraction.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Extraction batches" description="Raw material extracted under each license" />
      <DataTable
        data={list.data?.items ?? []}
        loading={list.isLoading}
        columns={[
          { key: "extractedDate", header: "Date", cell: (e: any) => format(new Date(e.extractedDate), "PP") },
          { key: "licenseId", header: "License", cell: (e: any) => e.licenseId?.licenseNumber },
          { key: "locationId", header: "Source", cell: (e: any) => e.locationId?.name },
          { key: "grossTonnage", header: "Gross tonnage", cell: (e: any) => e.grossTonnage.toFixed(2) },
          { key: "vehicleId", header: "Vehicle", cell: (e: any) => e.vehicleId?.registrationNumber ?? "—" },
          { key: "royaltyAmount", header: "Royalty", cell: (e: any) => `₹${(e.royaltyAmount/100).toFixed(0)}` },
          { key: "status", header: "Status", cell: (e: any) => <StatusBadge status={e.status} /> },
        ]}
      />
    </div>
  );
}
