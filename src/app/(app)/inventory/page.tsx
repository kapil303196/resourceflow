"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { format } from "date-fns";

export default function InventoryPage() {
  const stock = trpc.inventory.currentStock.useQuery({});
  const ledger = trpc.inventory.ledger.useQuery({});
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Inventory"
        description="Live stock matrix and full ledger history"
      />

      <div>
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
          Current stock by grade × location
        </h2>
        <DataTable
          data={stock.data ?? []}
          loading={stock.isLoading}
          columns={[
            {
              key: "gradeName",
              header: "Grade",
              cell: (s: any) => (
                <span>
                  <span
                    className="inline-block size-2.5 rounded mr-2 align-middle"
                    style={{ background: s.gradeColor }}
                  />
                  {s.gradeName}
                </span>
              ),
            },
            { key: "locationName", header: "Location" },
            { key: "locationType", header: "Type" },
            {
              key: "quantity",
              header: "Quantity",
              cell: (s: any) => Number(s.quantity).toFixed(3),
            },
          ]}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
          Ledger
        </h2>
        <DataTable
          data={ledger.data?.items ?? []}
          loading={ledger.isLoading}
          columns={[
            {
              key: "transactionDate",
              header: "Date",
              cell: (l: any) => format(new Date(l.transactionDate), "PP p"),
            },
            { key: "transactionType", header: "Type" },
            { key: "materialGradeId", header: "Grade", cell: (l: any) => l.materialGradeId?.name },
            { key: "locationId", header: "Location", cell: (l: any) => l.locationId?.name },
            { key: "quantity", header: "Qty", cell: (l: any) => l.quantity.toFixed(3) },
            { key: "referenceType", header: "Ref" },
            { key: "userId", header: "By", cell: (l: any) => l.userId?.name ?? "—" },
          ]}
        />
      </div>
    </div>
  );
}
