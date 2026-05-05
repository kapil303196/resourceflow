"use client";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  Filter,
  Calendar,
  X as XIcon,
} from "lucide-react";
import Papa from "papaparse";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  exportValue?: (row: T) => string | number | null | undefined;
};

export type FilterChip = {
  label: string;
  value: string;
  active: boolean;
  count?: number;
};

export type DateRange = { from: Date | null; to: Date | null };

export type ResourceListProps<T extends { _id?: any }> = {
  title: string;
  description?: string;
  itemName: string;

  data: T[];
  loading?: boolean;

  columns: Column<T>[];
  mobileCard: (row: T) => ReactNode;

  search?: string;
  onSearchChange?: (s: string) => void;

  filters?: FilterChip[];
  onFilterChange?: (value: string) => void;

  /** Optional secondary filters shown in a compact row (selects). */
  extraFilters?: ReactNode;

  /** Date range filter — when provided, a date picker shows in the filter row. */
  dateRange?: DateRange;
  onDateRangeChange?: (r: DateRange) => void;

  onCreate?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => Promise<unknown> | unknown;
  /** Click row → open the detail sheet (preferred). If unset and onEdit is set, click opens edit. */
  onRowClick?: (row: T) => void;

  /** Detail view renderer — when set, a "View details" Sheet opens on row click. */
  detailRender?: (row: T) => ReactNode;
  detailTitle?: (row: T) => string;

  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;

  rowActions?: (row: T) => { label: string; onClick: () => void; destructive?: boolean }[];

  exportFileName?: string;

  beforeList?: ReactNode;
};

const DATE_PRESETS = ["all", "today", "week", "month", "custom"] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

export function ResourceList<T extends { _id?: any }>({
  title,
  description,
  itemName,
  data,
  loading,
  columns,
  mobileCard,
  search,
  onSearchChange,
  filters,
  onFilterChange,
  extraFilters,
  dateRange,
  onDateRangeChange,
  onCreate,
  onEdit,
  onDelete,
  onRowClick,
  detailRender,
  detailTitle,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  rowActions,
  exportFileName,
  beforeList,
}: ResourceListProps<T>) {
  const { t } = useI18n();
  const sp = useSearchParams();
  const [searchValue, setSearchValue] = useState(search ?? "");
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailRow, setDetailRow] = useState<T | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [showDatePanel, setShowDatePanel] = useState(false);

  const wantNew = sp?.get("new") === "1";
  useEffect(() => {
    if (wantNew && onCreate) {
      const id = setTimeout(() => onCreate(), 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantNew]);

  const desktopCols = columns.filter((c) => !c.hideOnMobile);

  function exportCsv() {
    const rows = data.map((r) => {
      const out: Record<string, any> = {};
      for (const c of columns) {
        out[c.header] = c.exportValue ? c.exportValue(r) : (r as any)[c.key];
      }
      return out;
    });
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName ?? `${title.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyDatePreset(p: DatePreset) {
    if (!onDateRangeChange) return;
    setDatePreset(p);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (p === "all") onDateRangeChange({ from: null, to: null });
    else if (p === "today") onDateRangeChange({ from: today, to: now });
    else if (p === "week")
      onDateRangeChange({ from: new Date(now.getTime() - 7 * 86_400_000), to: now });
    else if (p === "month")
      onDateRangeChange({ from: new Date(now.getTime() - 30 * 86_400_000), to: now });
    else if (p === "custom") setShowDatePanel(true);
  }

  // Open detail sheet on row click (preferred). Fallback to onRowClick prop.
  const handleRowClick = (row: T) => {
    if (detailRender) setDetailRow(row);
    else if (onRowClick) onRowClick(row);
  };

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="hidden sm:inline-flex"
          >
            <Download className="size-4 mr-1" />
            {t("exportCsv")}
          </Button>
          {canCreate && onCreate && (
            <Button onClick={onCreate} size="sm" className="hidden md:inline-flex">
              <Plus className="size-4 mr-1" />
              {t("add")} {itemName}
            </Button>
          )}
        </div>
      </div>

      {beforeList}

      {(onSearchChange || filters?.length || onDateRangeChange || extraFilters) && (
        <div className="space-y-2 mb-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {onSearchChange && (
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    onSearchChange(e.target.value);
                  }}
                  placeholder={t("search")}
                  className="pl-9 h-10"
                />
              </div>
            )}
            {onDateRangeChange && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDatePanel((s) => !s)}
                className="h-10"
              >
                <Calendar className="size-4 mr-1.5" />
                {datePreset === "all"
                  ? t("dateRange")
                  : datePreset === "today"
                    ? t("filterToday")
                    : datePreset === "week"
                      ? t("filterWeek")
                      : datePreset === "month"
                        ? t("filterMonth")
                        : t("filterCustom")}
              </Button>
            )}
            {extraFilters}
          </div>

          {!!filters?.length && (
            <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => onFilterChange?.(f.value)}
                  className={cn(
                    "shrink-0 px-3 h-8 rounded-full text-xs font-medium border transition-colors",
                    f.active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground hover:bg-accent",
                  )}
                >
                  {f.label}
                  {f.count !== undefined && (
                    <span
                      className={cn(
                        "ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]",
                        f.active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {showDatePanel && onDateRangeChange && (
            <Card className="border-dashed">
              <CardContent className="p-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "today", "week", "month", "custom"] as DatePreset[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => applyDatePreset(p)}
                      className={cn(
                        "px-3 h-8 rounded-full text-xs font-medium border transition-colors",
                        datePreset === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent",
                      )}
                    >
                      {p === "all" ? t("filterAll") : p === "today" ? t("filterToday") : p === "week" ? t("filterWeek") : p === "month" ? t("filterMonth") : t("filterCustom")}
                    </button>
                  ))}
                </div>
                {datePreset === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{t("fromDate")}</Label>
                      <Input
                        type="date"
                        value={dateRange?.from ? dateRange.from.toISOString().slice(0, 10) : ""}
                        onChange={(e) =>
                          onDateRangeChange({
                            from: e.target.value ? new Date(e.target.value) : null,
                            to: dateRange?.to ?? null,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{t("toDate")}</Label>
                      <Input
                        type="date"
                        value={dateRange?.to ? dateRange.to.toISOString().slice(0, 10) : ""}
                        onChange={(e) =>
                          onDateRangeChange({
                            from: dateRange?.from ?? null,
                            to: e.target.value ? new Date(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center mb-3">
              <Plus className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">{t("noRecords")}</p>
            {canCreate && onCreate && (
              <Button onClick={onCreate} size="sm">
                <Plus className="size-4 mr-1" />
                {t("add")} {itemName}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && data.length > 0 && (
        <div className="md:hidden space-y-2">
          {data.map((row) => (
            <Card
              key={row._id?.toString() ?? Math.random()}
              className="overflow-hidden"
            >
              <CardContent
                className={cn(
                  "p-4 flex items-start gap-3",
                  (detailRender || onRowClick) && "cursor-pointer active:bg-accent",
                )}
                onClick={() => handleRowClick(row)}
              >
                <div className="flex-1 min-w-0">{mobileCard(row)}</div>
                {(canEdit || canDelete || rowActions) && (
                  <RowMenu
                    onEdit={canEdit && onEdit ? () => onEdit(row) : undefined}
                    onDelete={
                      canDelete && onDelete ? () => setDeleteTarget(row) : undefined
                    }
                    extra={rowActions?.(row)}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="hidden md:block rounded-xl border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {desktopCols.map((c) => (
                  <TableHead key={c.key} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
                {(canEdit || canDelete || rowActions) && (
                  <TableHead className="w-[60px]" />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row._id?.toString() ?? Math.random()}
                  className={(detailRender || onRowClick) ? "cursor-pointer" : ""}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-row-menu]")) return;
                    handleRowClick(row);
                  }}
                >
                  {desktopCols.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.cell ? c.cell(row) : (row as any)[c.key] ?? "—"}
                    </TableCell>
                  ))}
                  {(canEdit || canDelete || rowActions) && (
                    <TableCell data-row-menu>
                      <RowMenu
                        onEdit={canEdit && onEdit ? () => onEdit(row) : undefined}
                        onDelete={
                          canDelete && onDelete ? () => setDeleteTarget(row) : undefined
                        }
                        extra={rowActions?.(row)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canCreate && onCreate && data.length > 0 && (
        <Button
          onClick={onCreate}
          variant="outline"
          className="md:hidden w-full mt-3 h-12"
        >
          <Plus className="size-4 mr-2" />
          {t("add")} {itemName}
        </Button>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`${t("delete")} ${itemName}?`}
        description={t("confirmDelete")}
        destructive
        confirmLabel={t("delete")}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget || !onDelete) return;
          setDeleting(true);
          try {
            await onDelete(deleteTarget);
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
      />

      {/* Detail view sheet */}
      <Sheet open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader>
            <SheetTitle>{detailRow ? (detailTitle?.(detailRow) ?? itemName) : ""}</SheetTitle>
            <SheetDescription>{t("viewDetails")}</SheetDescription>
          </SheetHeader>
          <SheetBody className="flex-1">
            {detailRow && detailRender?.(detailRow)}
          </SheetBody>
          <SheetFooter>
            {detailRow && canEdit && onEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  const r = detailRow;
                  setDetailRow(null);
                  onEdit(r);
                }}
              >
                <Pencil className="size-4 mr-1.5" />
                {t("edit")}
              </Button>
            )}
            <Button onClick={() => setDetailRow(null)}>{t("close")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RowMenu({
  onEdit,
  onDelete,
  extra,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  extra?: { label: string; onClick: () => void; destructive?: boolean }[];
}) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("rowActions")}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4 mr-2" />
            {t("edit")}
          </DropdownMenuItem>
        )}
        {extra?.map((a) => (
          <DropdownMenuItem
            key={a.label}
            onClick={a.onClick}
            className={a.destructive ? "text-destructive" : ""}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="size-4 mr-2" />
            {t("delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Tiny field renderer used by detail views */
export function DetailField({
  label,
  value,
  span = 1,
}: {
  label: string;
  value: ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
        {label}
      </div>
      <div className="text-sm font-medium tabular">{value || "—"}</div>
    </div>
  );
}
