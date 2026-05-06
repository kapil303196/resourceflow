"use client";
import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, AlertTriangle, Download, ShieldCheck, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ResourceList, DetailField } from "@/components/resource-list";
import { ResourceForm, type FieldDef } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [uploadOpen, setUploadOpen] = useState(false);

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
        canCreate={true}
        onCreate={() => setUploadOpen(true)}
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

      <UploadSheet open={uploadOpen} onOpenChange={setUploadOpen} />
    </>
  );
}

/* ---------------------------- Upload sheet ---------------------------- */

const ENTITY_TYPES = [
  "VEHICLE",
  "DRIVER",
  "LICENSE",
  "CONTRACTOR",
  "CUSTOMER",
  "SUPPLIER",
  "INVOICE",
  "TRIP",
  "EXTRACTION",
  "REFINERY_BATCH",
  "PURCHASE_ORDER",
  "OTHER",
] as const;

function UploadSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const presign = trpc.document.presignedUploadUrl.useMutation();
  const confirm = trpc.document.confirmUpload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded");
      utils.document.list.invalidate();
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  // Picker state
  const [entityType, setEntityType] =
    useState<(typeof ENTITY_TYPES)[number]>("VEHICLE");
  const [entityId, setEntityId] = useState("");
  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-fetch entity options based on entityType
  const vehicles = trpc.vehicle.list.useQuery({}, { enabled: entityType === "VEHICLE" });
  const drivers = trpc.driver.list.useQuery({}, { enabled: entityType === "DRIVER" });
  const licenses = trpc.license.list.useQuery({}, { enabled: entityType === "LICENSE" });
  const contractors = trpc.contractor.list.useQuery(
    {},
    { enabled: entityType === "CONTRACTOR" },
  );
  const customers = trpc.customer.list.useQuery({}, { enabled: entityType === "CUSTOMER" });
  const suppliers = trpc.supplier.list.useQuery({}, { enabled: entityType === "SUPPLIER" });

  function entityOptions(): { value: string; label: string }[] {
    switch (entityType) {
      case "VEHICLE":
        return (vehicles.data?.items ?? []).map((v: any) => ({
          value: String(v._id),
          label: v.registrationNumber,
        }));
      case "DRIVER":
        return (drivers.data?.items ?? []).map((d: any) => ({
          value: String(d._id),
          label: d.name,
        }));
      case "LICENSE":
        return (licenses.data ?? []).map((l: any) => ({
          value: String(l._id),
          label: `${l.licenseNumber} · ${l.locationId?.name ?? ""}`,
        }));
      case "CONTRACTOR":
        return (contractors.data?.items ?? []).map((c: any) => ({
          value: String(c._id),
          label: c.name,
        }));
      case "CUSTOMER":
        return (customers.data?.items ?? []).map((c: any) => ({
          value: String(c._id),
          label: c.name,
        }));
      case "SUPPLIER":
        return (suppliers.data?.items ?? []).map((s: any) => ({
          value: String(s._id),
          label: s.name,
        }));
      default:
        return [];
    }
  }

  function reset() {
    setEntityType("VEHICLE");
    setEntityId("");
    setDocType("");
    setDocNumber("");
    setExpiryDate("");
    setNotes("");
    setFile(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!file) {
      toast.error("Pick a file first.");
      return;
    }
    if (!entityId) {
      toast.error("Pick what this document is for.");
      return;
    }
    if (!docType.trim()) {
      toast.error("Enter the document type (e.g. RC Book, Insurance).");
      return;
    }
    setBusy(true);
    try {
      const presigned = await presign.mutateAsync({
        entityType,
        entityId,
        documentType: docType,
        documentNumber: docNumber || undefined,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        notes: notes || undefined,
      });

      // Direct PUT to S3 with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presigned.url);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`S3 upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("S3 upload failed"));
        xhr.send(file);
      });

      await confirm.mutateAsync({
        entityType,
        entityId,
        documentType: docType,
        documentNumber: docNumber || undefined,
        s3Key: presigned.key,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        originalFileName: file.name,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        notes: notes || undefined,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader>
          <SheetTitle>Upload document</SheetTitle>
          <SheetDescription>
            Files go directly from your browser to S3. Max 25 MB.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>What's it for?</Label>
              <Select value={entityType} onValueChange={(v) => { setEntityType(v as any); setEntityId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((e) => (
                    <SelectItem key={e} value={e}>{e.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pick {entityType.toLowerCase().replace(/_/g, " ")}</Label>
              {entityType === "OTHER" ? (
                <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Reference id" />
              ) : (
                <Select value={entityId || "__none__"} onValueChange={(v) => setEntityId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select —</SelectItem>
                    {entityOptions().map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Document type</Label>
              <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="RC Book, Insurance, PAN Card…" />
            </div>
            <div className="space-y-1.5">
              <Label>Document #</Label>
              <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>File</Label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-2 file:text-xs file:font-medium hover:file:opacity-90"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(1)} KB · {file.type || "unknown"}
              </p>
            )}
            {busy && progress > 0 && progress < 100 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? `Uploading… ${progress}%` : (
              <>
                <Upload className="size-4 mr-1.5" />
                Upload
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
