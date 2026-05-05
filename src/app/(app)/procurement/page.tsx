"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProcurementPage() {
  const pos = trpc.purchaseOrder.list.useQuery({});
  const suppliers = trpc.supplier.list.useQuery({});
  return (
    <div className="p-6">
      <PageHeader title="Procurement" description="Suppliers and purchase orders" />
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Purchase orders</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <DataTable
            data={pos.data ?? []}
            loading={pos.isLoading}
            columns={[
              { key: "poNumber", header: "PO #" },
              { key: "supplierId", header: "Supplier", cell: (p: any) => p.supplierId?.name },
              { key: "orderDate", header: "Date", cell: (p: any) => format(new Date(p.orderDate), "PP") },
              { key: "items", header: "Lines", cell: (p: any) => p.items?.length ?? 0 },
              {
                key: "totalAmount",
                header: "Total",
                cell: (p: any) => `₹${(p.totalAmount / 100).toLocaleString("en-IN")}`,
              },
              { key: "status", header: "Status", cell: (p: any) => <StatusBadge status={p.status} /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="suppliers">
          <DataTable
            data={suppliers.data?.items ?? []}
            loading={suppliers.isLoading}
            columns={[
              { key: "name", header: "Name" },
              { key: "contactName", header: "Contact" },
              { key: "phone", header: "Phone" },
              { key: "email", header: "Email" },
              { key: "isActive", header: "Active", cell: (s: any) => (s.isActive ? "Yes" : "No") },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
