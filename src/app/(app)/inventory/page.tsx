"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/components/i18n-provider";
import { ResourceList, type DateRange } from "@/components/resource-list";

export default function InventoryPage() {
  const { t, fmtNumber, fmtDate, fmtMoney } = useI18n();
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {t("inventory")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Live stock across grades and locations
        </p>
      </div>
      <Tabs defaultValue="stock">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="stock" className="flex-1 sm:flex-none">Stock</TabsTrigger>
          <TabsTrigger value="ledger" className="flex-1 sm:flex-none">Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="mt-4">
          <StockTab />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab dateRange={dateRange} setDateRange={setDateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StockTab() {
  const { fmtNumber, fmtMoney } = useI18n();
  const stock = trpc.inventory.currentStock.useQuery({});

  if (stock.isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  // Group by grade for nicer mobile display
  const byGrade = (stock.data ?? []).reduce<Record<string, any[]>>((acc, s: any) => {
    const k = s.gradeName || "—";
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  if (Object.keys(byGrade).length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No stock yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(byGrade).map(([grade, rows]) => {
        const total = rows.reduce((s, r) => s + Number(r.quantity), 0);
        const totalValue = rows.reduce(
          (s, r) => s + Number(r.quantity) * (r.pricePerUnit ?? 0),
          0,
        );
        const color = rows[0]?.gradeColor ?? "#3B82F6";
        return (
          <Card key={grade}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="size-3.5 rounded shrink-0"
                    style={{ background: color }}
                  />
                  <span className="font-semibold truncate">{grade}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-semibold tabular leading-tight">
                    {fmtNumber(total, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtMoney(totalValue)}
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5">
                {rows.map((r: any, i: number) => (
                  <li
                    key={`${r.locationId}-${i}`}
                    className="flex items-center justify-between text-sm py-1 border-t first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{r.locationName}</span>
                      {r.locationType && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {r.locationType}
                        </Badge>
                      )}
                    </div>
                    <span className="font-medium tabular">
                      {fmtNumber(Number(r.quantity), { maximumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LedgerTab({
  dateRange,
  setDateRange,
}: {
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
}) {
  const { t, fmtDate, fmtNumber } = useI18n();
  const [type, setType] = useState("all");
  const ledger = trpc.inventory.ledger.useQuery({
    transactionType: type === "all" ? undefined : type,
    from: dateRange.from ?? undefined,
    to: dateRange.to ?? undefined,
  });
  return (
    <ResourceList
      title=""
      itemName="entry"
      data={ledger.data?.items ?? []}
      loading={ledger.isLoading}
      filters={[
        { label: t("filterAll"), value: "all", active: type === "all" },
        { label: "IN", value: "IN", active: type === "IN" },
        { label: "OUT", value: "OUT", active: type === "OUT" },
        { label: "Transfer", value: "TRANSFER_IN", active: type === "TRANSFER_IN" },
        { label: "Adjust", value: "ADJUSTMENT", active: type === "ADJUSTMENT" },
      ]}
      onFilterChange={setType}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      canCreate={false}
      canEdit={false}
      canDelete={false}
      columns={[
        { key: "transactionDate", header: t("date"), cell: (l: any) => fmtDate(l.transactionDate) },
        { key: "transactionType", header: t("type"), cell: (l: any) => <Badge variant="outline">{l.transactionType}</Badge> },
        { key: "materialGradeId", header: "Grade", cell: (l: any) => l.materialGradeId?.name },
        { key: "locationId", header: "Location", cell: (l: any) => l.locationId?.name },
        { key: "quantity", header: "Qty", cell: (l: any) => fmtNumber(Number(l.quantity), { maximumFractionDigits: 3 }) },
        { key: "referenceType", header: "Ref" },
      ]}
      mobileCard={(l: any) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                variant={l.transactionType === "OUT" || l.transactionType === "TRANSFER_OUT" ? "danger" : "success"}
                className="text-[10px]"
              >
                {l.transactionType}
              </Badge>
              <span className="font-medium truncate">{l.materialGradeId?.name}</span>
            </div>
            <span className="font-semibold tabular text-sm">
              {fmtNumber(Number(l.quantity), { maximumFractionDigits: 3 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{l.locationId?.name}</span>
            <span>{fmtDate(l.transactionDate)}</span>
          </div>
        </div>
      )}
    />
  );
}
