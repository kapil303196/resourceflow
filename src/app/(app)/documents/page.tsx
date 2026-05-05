"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function DocumentsPage() {
  const list = trpc.document.list.useQuery({});
  const expiring = trpc.document.expiringSoon.useQuery({ days: 30 });
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Documents" description="Unified document center across all entities" />

      {(expiring.data?.length ?? 0) > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
          <strong>{expiring.data!.length} document(s)</strong> expiring within 30 days.
        </div>
      )}

      <DataTable
        data={list.data?.items ?? []}
        loading={list.isLoading}
        columns={[
          {
            key: "documentType",
            header: "Type",
            cell: (d: any) => (
              <span className="font-medium">{d.documentType}</span>
            ),
          },
          { key: "entityType", header: "Entity", cell: (d: any) => <Badge variant="outline">{d.entityType}</Badge> },
          { key: "documentNumber", header: "Number" },
          { key: "originalFileName", header: "File" },
          {
            key: "expiryDate",
            header: "Expires",
            cell: (d: any) => (d.expiryDate ? format(new Date(d.expiryDate), "PP") : "—"),
          },
          {
            key: "isVerified",
            header: "Verified",
            cell: (d: any) => (d.isVerified ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>),
          },
          {
            key: "actions",
            header: "",
            cell: (d: any) => <DownloadButton id={d._id} />,
          },
        ]}
      />
    </div>
  );
}

function DownloadButton({ id }: { id: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        // tRPC HTTP GET with superjson-encoded input
        const inputEncoded = encodeURIComponent(
          JSON.stringify({ "0": { json: { id } } }),
        );
        const res = await fetch(
          `/api/trpc/document.presignedDownloadUrl?batch=1&input=${inputEncoded}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        const url =
          json?.[0]?.result?.data?.json?.url ??
          json?.result?.data?.json?.url ??
          json?.[0]?.result?.data?.url;
        if (url) window.open(url, "_blank");
      }}
    >
      Download
    </Button>
  );
}
