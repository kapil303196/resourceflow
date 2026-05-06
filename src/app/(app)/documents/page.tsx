"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, AlertTriangle, Download, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, DetailField } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

const editSchema = z.object({
  documentType: z.string().min(1),
  documentNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

type EditValues = z.infer<typeof editSchema>;

export default function DocumentsPage() {
  const { t, fmtDate } = useI18n();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const list = trpc.document.list.useQuery({
    expiringInDays: filter === "expiring" ? 30 : undefined,
  });
  const expiring = trpc.document.expiringSoon.useQuery({ days: 30 });
  const utils = trpc.useUtils();
  const update = trpc.document.update.useMutation({
    onSuccess: () => {
      toast.success(t("toastSaved"));
      utils.document.list.invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.document.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toastRemoved"));
      utils.document.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const verify = trpc.document.markVerified.useMutation({
    onSuccess: () => {
      toast.success(t("toastUpdated"));
      utils.document.list.invalidate();
    },
  });

  const items = list.data?.items ?? [];
  const fields: FieldDef[] = [
    { name: "documentType", label: t("type"), type: "text", required: true, span: 2 },
    { name: "documentNumber", label: "Number", type: "text" },
    { name: "expiryDate", label: "Expiry", type: "date" },
    { name: "notes", label: t("notes"), type: "textarea", span: 2 },
  ];

  return (
    <>
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
        onEdit={(row: any) => {
          setEditing(row);
          setOpen(true);
        }}
        onDelete={async (row: any) => del.mutateAsync({ id: String(row._id) })}
        rowActions={(row: any) => [
          {
            label: row.isVerified ? "Unverify" : "Mark verified",
            onClick: () => verify.mutate({ id: row._id, verified: !row.isVerified }),
          },
        ]}
        beforeList={
          (expiring.data?.length ?? 0) > 0 ? (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 mb-4">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="size-5 text-amber-700 dark:text-amber-300 shrink-0" />
                <div className="text-sm">
                  <strong className="text-amber-900 dark:text-amber-100">{expiring.data!.length}</strong>{" "}
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
        detailTitle={(d: any) => d.documentType}
        detailRender={(d: any) => (
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailField label={t("type")} value={d.documentType} />
            <DetailField label="Entity" value={<Badge variant="outline">{d.entityType}</Badge>} />
            <DetailField label="Number" value={d.documentNumber} />
            <DetailField label="Verified" value={d.isVerified ? "Yes" : "No"} />
            <DetailField span={2} label="File" value={<span className="font-mono text-xs">{d.originalFileName}</span>} />
            <DetailField label="Expiry" value={d.expiryDate ? fmtDate(d.expiryDate) : null} />
            <DetailField label="Size" value={d.fileSize ? `${(d.fileSize / 1024).toFixed(1)} KB` : null} />
            {d.notes && <DetailField span={2} label={t("notes")} value={d.notes} />}
          </div>
        )}
      />
      <ResourceForm
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        title={editing ? `Edit ${editing.documentType ?? "document"}` : "Edit document"}
        schema={editSchema}
        defaultValues={
          editing
            ? {
                documentType: editing.documentType ?? "",
                documentNumber: editing.documentNumber ?? "",
                expiryDate: editing.expiryDate
                  ? new Date(editing.expiryDate).toISOString().slice(0, 10)
                  : "",
                notes: editing.notes ?? "",
              }
            : { documentType: "", documentNumber: "", expiryDate: "", notes: "" }
        }
        fields={fields}
        submitting={update.isPending}
        onSubmit={async (v: EditValues) => {
          if (!editing) return;
          await update.mutateAsync({
            id: editing._id,
            documentType: v.documentType,
            documentNumber: v.documentNumber ?? undefined,
            expiryDate: v.expiryDate ? new Date(v.expiryDate) : undefined,
            notes: v.notes ?? undefined,
          });
        }}
      />
    </>
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
