"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";

export default function SalesOrdersPage() {
  const list = trpc.salesOrder.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Sales orders" />
      <DataTable
        data={list.data ?? []}
        loading={list.isLoading}
        columns={[
          { key: "orderNumber", header: "Order #" },
          { key: "customerId", header: "Customer", cell: (o: any) => o.customerId?.name },
          { key: "orderDate", header: "Date", cell: (o: any) => format(new Date(o.orderDate), "PP") },
          { key: "items", header: "Lines", cell: (o: any) => o.items?.length ?? 0 },
          {
            key: "totalAmount",
            header: "Total",
            cell: (o: any) => `₹${(o.totalAmount/100).toLocaleString("en-IN")}`,
          },
          { key: "status", header: "Status", cell: (o: any) => <StatusBadge status={o.status} /> },
        ]}
      />
    </div>
  );
}
