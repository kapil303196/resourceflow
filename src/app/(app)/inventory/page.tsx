"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Pencil, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/components/i18n-provider";
import { ResourceList, type DateRange } from "@/components/resource-list";

export default function InventoryPage() {
  const { t, fmtNumber, fmtDate, fmtMoney } = useI18n();
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {t("inventory")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live stock across grades and locations
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="size-4 mr-1.5" />
            <span className="hidden sm:inline">Transfer</span>
          </Button>
          <Button size="sm" onClick={() => setAdjustOpen(true)}>
            <Pencil className="size-4 mr-1.5" />
            <span className="hidden sm:inline">Adjust</span>
          </Button>
        </div>
      </div>
      <AdjustSheet open={adjustOpen} onOpenChange={setAdjustOpen} />
      <TransferSheet open={transferOpen} onOpenChange={setTransferOpen} />

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

/* -------------------- Adjust sheet -------------------- */

function AdjustSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const grades = trpc.materialGrade.list.useQuery({});
  const locations = trpc.location.list.useQuery({});
  const adjust = trpc.inventory.adjustment.useMutation({
    onSuccess: () => {
      toast.success("Adjustment recorded");
      utils.inventory.currentStock.invalidate();
      utils.inventory.ledger.invalidate();
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const [gradeId, setGradeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  function reset() {
    setGradeId("");
    setLocationId("");
    setDelta(0);
    setReason("");
    setDate(new Date().toISOString().slice(0, 10));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader>
          <SheetTitle>Manual stock adjustment</SheetTitle>
          <SheetDescription>
            Use a positive number to add stock, negative to remove. A reason is required.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex-1 space-y-4">
          <div className="space-y-1.5">
            <Label>Grade</Label>
            <Select value={gradeId || "__none__"} onValueChange={(v) => setGradeId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select —</SelectItem>
                {(grades.data?.items ?? []).map((g: any) => (
                  <SelectItem key={g._id} value={String(g._id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId || "__none__"} onValueChange={(v) => setLocationId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select —</SelectItem>
                {(locations.data?.items ?? []).map((l: any) => (
                  <SelectItem key={l._id} value={String(l._id)}>{l.name} ({l.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity (+ to add, − to remove)</Label>
            <Input
              type="number"
              step="0.01"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Stock count correction, damage write-off, opening balance fix…"
              rows={3}
            />
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adjust.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!gradeId || !locationId || delta === 0 || !reason.trim() || adjust.isPending}
            onClick={() =>
              adjust.mutate({
                materialGradeId: gradeId,
                locationId,
                quantity: delta,
                reason,
                transactionDate: new Date(date),
              })
            }
          >
            {adjust.isPending ? "Saving…" : "Record adjustment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* -------------------- Transfer sheet -------------------- */

function TransferSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const grades = trpc.materialGrade.list.useQuery({});
  const locations = trpc.location.list.useQuery({});
  const transfer = trpc.inventory.transfer.useMutation({
    onSuccess: () => {
      toast.success("Stock transferred");
      utils.inventory.currentStock.invalidate();
      utils.inventory.ledger.invalidate();
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const [gradeId, setGradeId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState(0);
  const [notes, setNotes] = useState("");

  function reset() {
    setGradeId(""); setFromId(""); setToId(""); setQty(0); setNotes("");
  }

  const sameLocation = fromId && toId && fromId === toId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader>
          <SheetTitle>Transfer stock between locations</SheetTitle>
          <SheetDescription>
            Atomic — out from source + in to destination posted in one transaction.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex-1 space-y-4">
          <div className="space-y-1.5">
            <Label>Grade</Label>
            <Select value={gradeId || "__none__"} onValueChange={(v) => setGradeId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select —</SelectItem>
                {(grades.data?.items ?? []).map((g: any) => (
                  <SelectItem key={g._id} value={String(g._id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={fromId || "__none__"} onValueChange={(v) => setFromId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {(locations.data?.items ?? []).map((l: any) => (
                    <SelectItem key={l._id} value={String(l._id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={toId || "__none__"} onValueChange={(v) => setToId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {(locations.data?.items ?? []).map((l: any) => (
                    <SelectItem key={l._id} value={String(l._id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {sameLocation && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              From and To locations must differ.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Tonnage to transfer</Label>
            <Input
              type="number"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={transfer.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!gradeId || !fromId || !toId || sameLocation || qty <= 0 || transfer.isPending}
            onClick={() =>
              transfer.mutate({
                materialGradeId: gradeId,
                fromLocationId: fromId,
                toLocationId: toId,
                quantity: qty,
                notes: notes || undefined,
              })
            }
          >
            {transfer.isPending ? "Transferring…" : "Transfer stock"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
