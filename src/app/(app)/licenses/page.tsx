"use client";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

export default function LicensesPage() {
  const list = trpc.license.list.useQuery({});
  const grouped = (list.data ?? []).reduce(
    (acc: Record<string, any[]>, l: any) => {
      const days = l.daysToExpiry ?? 0;
      const bucket =
        l.status === "EXPIRED"
          ? "Expired"
          : days < 30
            ? "Expiring soon"
            : l.status === "SUSPENDED"
              ? "Suspended"
              : "Active";
      (acc[bucket] ??= []).push(l);
      return acc;
    },
    {},
  );
  return (
    <div className="p-6">
      <PageHeader title="Licenses" description="Mining/extraction licenses by status" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Object.entries(grouped).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">{k}</p>
              <p className="text-2xl font-semibold">{v.length}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <DataTable
        data={list.data ?? []}
        loading={list.isLoading}
        columns={[
          {
            key: "licenseNumber",
            header: "License #",
            cell: (l: any) => (
              <Link
                href={`/licenses/${l._id}`}
                className="font-medium text-primary hover:underline"
              >
                {l.licenseNumber}
              </Link>
            ),
          },
          { key: "locationId", header: "Location", cell: (l: any) => l.locationId?.name },
          { key: "validTo", header: "Expires", cell: (l: any) => format(new Date(l.validTo), "PP") },
          {
            key: "utilization",
            header: "Utilization",
            cell: (l: any) => `${(l.utilization * 100).toFixed(1)}%`,
          },
          {
            key: "permittedTonnage",
            header: "Used / Permitted",
            cell: (l: any) =>
              `${l.usedTonnage.toFixed(1)} / ${l.permittedTonnage.toFixed(1)}`,
          },
          { key: "status", header: "Status", cell: (l: any) => <StatusBadge status={l.status} /> },
        ]}
      />
    </div>
  );
}
