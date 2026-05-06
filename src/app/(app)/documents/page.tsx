"use client";
import { useState } from "react";
import { FileText, AlertTriangle, Download, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, type DateRange } from "@/components/resource-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

export default function DocumentsPage() {
  const { t, fmtDate } = useI18n();
  const [filter, setFilter] = useState("all");
  const list = trpc.document.list.useQuery({
    expiringInDays: filter === "expiring" ? 30 : undefined,
  });
  const expiring = trpc.document.expiringSoon.useQuery({ days: 30 });

  const items = list.data?.items ?? [];

  return (
    <ResourceList
      title={t("documents")}
      itemName="document"
      data={items}
      loading={list.isLoading}
      filters={[
        { label: t("filterAll"), value: "all", active: filter === "all" },
        { label: t("filterExpiring"), value: "expiring", active: filter === "expiring", count: expiring.data?.length },
      ]}
      onFilterChange={setFilter}
      canCreate={false}
      canEdit={false}
      canDelete={false}
      beforeList={
        (expiring.data?.length ?? 0) > 0 ? (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 mb-4">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="size-5 text-amber-700 dark:text-amber-300 shrink-0" />
              <div className="text-sm">
                <strong className="text-amber-900 dark:text-amber-100">
                  {expiring.data!.length}
                </strong>{" "}
                <span className="text-amber-800 dark:text-amber-200">
                  document(s) expiring within 30 days.
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null
      }
      columns={[
        { key: "documentType", header: t("type"), cell: (d: any) => <span className="font-medium">{d.documentType}</span> },
        { key: "entityType", header: "Entity", cell: (d: any) => <Badge variant="outline">{d.entityType}</Badge> },
        { key: "documentNumber", header: "Number" },
        { key: "originalFileName", header: "File", cell: (d: any) => <span className="font-mono text-xs">{d.originalFileName}</span> },
        {
          key: "expiryDate", header: "Expiry",
          cell: (d: any) => d.expiryDate ? fmtDate(d.expiryDate) : "—",
        },
        {
          key: "isVerified", header: t("status"),
          cell: (d: any) => d.isVerified
            ? <Badge variant="success"><ShieldCheck className="size-3 mr-1" />Verified</Badge>
            : <Badge variant="secondary">Unverified</Badge>,
        },
        {
          key: "actions", header: "",
          cell: (d: any) => <DownloadButton id={d._id} />,
        },
      ]}
      mobileCard={(d: any) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{d.documentType}</span>
            </div>
            {d.isVerified ? (
              <Badge variant="success" className="text-[10px]"><ShieldCheck className="size-3 mr-0.5" />Verified</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Unverified</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">{d.entityType}</Badge>
            {d.documentNumber && <span>#{d.documentNumber}</span>}
          </div>
          {d.expiryDate && (
            <div className="text-xs text-muted-foreground">
              Expires {fmtDate(d.expiryDate)}
            </div>
          )}
          <div className="pt-2 mt-1 border-t flex justify-end">
            <DownloadButton id={d._id} />
          </div>
        </div>
      )}
    />
  );
}

function DownloadButton({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async (e) => {
        e.stopPropagation();
        const inputEncoded = encodeURIComponent(JSON.stringify({ "0": { json: { id } } }));
        const res = await fetch(`/api/trpc/document.presignedDownloadUrl?batch=1&input=${inputEncoded}`);
        if (!res.ok) return;
        const json = await res.json();
        const url = json?.[0]?.result?.data?.json?.url;
        if (url) window.open(url, "_blank");
      }}
    >
      <Download className="size-3.5 mr-1" />
      {t("download")}
    </Button>
  );
}
