"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { format } from "date-fns";

export default function AuditPage() {
  const list = trpc.auditLog.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Audit log" description="Append-only activity record" />
      <DataTable
        data={list.data?.items ?? []}
        loading={list.isLoading}
        columns={[
          {
            key: "createdAt",
            header: "When",
            cell: (a: any) => format(new Date(a.createdAt), "PP p"),
          },
          { key: "action", header: "Action" },
          { key: "entityType", header: "Entity" },
          { key: "userId", header: "User", cell: (a: any) => a.userId?.name ?? "system" },
          { key: "ipAddress", header: "IP" },
        ]}
      />
    </div>
  );
}
