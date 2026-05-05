"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";

export default function InvoicesPage() {
  const list = trpc.invoice.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Invoices" />
      <DataTable
        data={list.data ?? []}
        loading={list.isLoading}
        columns={[
          { key: "invoiceNumber", header: "Invoice #" },
          { key: "customerId", header: "Customer", cell: (i: any) => i.customerId?.name },
          { key: "invoiceDate", header: "Date", cell: (i: any) => format(new Date(i.invoiceDate), "PP") },
          { key: "dueDate", header: "Due", cell: (i: any) => format(new Date(i.dueDate), "PP") },
          {
            key: "totalAmount",
            header: "Total",
            cell: (i: any) => `₹${(i.totalAmount/100).toLocaleString("en-IN")}`,
          },
          {
            key: "paidAmount",
            header: "Paid",
            cell: (i: any) => `₹${((i.paidAmount ?? 0)/100).toLocaleString("en-IN")}`,
          },
          { key: "status", header: "Status", cell: (i: any) => <StatusBadge status={i.status} /> },
        ]}
      />
    </div>
  );
}
