"use client";
import { ReactNode, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Papa from "papaparse";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  cell?: (row: T) => ReactNode;
  className?: string;
  exportValue?: (row: T) => string | number | undefined;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search…",
  pageSize = 25,
  onSearchChange,
  totalRows,
  onPageChange,
  page = 0,
  loading = false,
  exportFileName = "export.csv",
}: {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  pageSize?: number;
  onSearchChange?: (s: string) => void;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  page?: number;
  loading?: boolean;
  exportFileName?: string;
}) {
  const [search, setSearch] = useState("");
  const total = totalRows ?? data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function exportCsv() {
    const rows = data.map((r) => {
      const out: Record<string, any> = {};
      for (const c of columns) {
        out[c.header] = c.exportValue
          ? c.exportValue(r)
          : (r as any)[c.key as string];
      }
      return out;
    });
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {onSearchChange && (
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onSearchChange(e.target.value);
            }}
            placeholder={searchPlaceholder}
            className="max-w-xs"
          />
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4 mr-1" />
          CSV
        </Button>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={String(c.key)} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  No records.
                </TableCell>
              </TableRow>
            )}
            {data.map((row, i) => (
              <TableRow key={(row._id as any) ?? i}>
                {columns.map((c) => (
                  <TableCell key={String(c.key)} className={c.className}>
                    {c.cell ? c.cell(row) : (row as any)[c.key as string]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {onPageChange && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {Math.min(page * pageSize + 1, total)}–
            {Math.min((page + 1) * pageSize, total)} of {total}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 0}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page + 1 >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
