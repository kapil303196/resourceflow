"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";

export default function CustomersPage() {
  const list = trpc.customer.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Customers" />
      <DataTable
        data={list.data?.items ?? []}
        loading={list.isLoading}
        columns={[
          { key: "name", header: "Name" },
          { key: "contactName", header: "Contact" },
          { key: "phone", header: "Phone" },
          { key: "email", header: "Email" },
          { key: "creditLimit", header: "Credit limit", cell: (c: any) => `₹${(c.creditLimit/100).toLocaleString("en-IN")}` },
          { key: "creditDays", header: "Credit days" },
          { key: "isActive", header: "Active", cell: (c: any) => (c.isActive ? "Yes" : "No") },
        ]}
      />
    </div>
  );
}
