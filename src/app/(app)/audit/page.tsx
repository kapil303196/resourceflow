"use client";
import { useState } from "react";
import { History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, type DateRange } from "@/components/resource-list";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";

export default function AuditPage() {
  const { t, fmtDate } = useI18n();
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const list = trpc.auditLog.list.useQuery({
    from: dateRange.from ?? undefined,
    to: dateRange.to ?? undefined,
  });

  return (
    <ResourceList
      title={t("auditLog")}
      itemName="entry"
      data={list.data?.items ?? []}
      loading={list.isLoading}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      canCreate={false}
      canEdit={false}
      canDelete={false}
      columns={[
        { key: "createdAt", header: "When", cell: (a: any) => fmtDate(a.createdAt, { dateStyle: "medium", timeStyle: "short" }) },
        { key: "action", header: "Action", cell: (a: any) => <Badge variant="outline" className="font-mono text-[11px]">{a.action}</Badge> },
        { key: "entityType", header: "Entity" },
        { key: "userId", header: "User", cell: (a: any) => a.userId?.name ?? "system" },
        { key: "ipAddress", header: "IP", className: "font-mono text-xs" },
      ]}
      mobileCard={(a: any) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="size-3.5 text-muted-foreground shrink-0" />
            <Badge variant="outline" className="font-mono text-[10px]">{a.action}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{a.entityType}</p>
          <div className="flex items-center justify-between text-xs">
            <span>{a.userId?.name ?? "system"}</span>
            <span className="text-muted-foreground">
              {fmtDate(a.createdAt, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        </div>
      )}
    />
  );
}
