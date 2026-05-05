"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function ContractorsPage() {
  const list = trpc.contractor.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Contractors" />
      <DataTable
        data={list.data?.items ?? []}
        loading={list.isLoading}
        columns={[
          { key: "name", header: "Name" },
          { key: "type", header: "Type", cell: (c: any) => <Badge variant="outline">{c.type}</Badge> },
          { key: "phone", header: "Phone" },
          {
            key: "agreementEndDate",
            header: "Agreement ends",
            cell: (c: any) => (c.agreementEndDate ? format(new Date(c.agreementEndDate), "PP") : "—"),
          },
          { key: "isActive", header: "Active", cell: (c: any) => (c.isActive ? "Yes" : "No") },
        ]}
      />
    </div>
  );
}
