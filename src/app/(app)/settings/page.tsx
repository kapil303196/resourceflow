"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Building2, MapPin, Factory, UserCircle2, ShieldCheck, Bell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/components/i18n-provider";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {t("settings")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Workspace, materials, locations, users & alert rules
        </p>
      </div>
      <Tabs defaultValue="tenant">
        <TabsList className="w-full overflow-x-auto justify-start sm:w-auto sm:justify-center scrollbar-thin">
          <TabsTrigger value="tenant"><Building2 className="size-4 mr-1.5" />{t("settingsPage_tenant")}</TabsTrigger>
          <TabsTrigger value="grades">{t("settingsPage_grades")}</TabsTrigger>
          <TabsTrigger value="locations"><MapPin className="size-4 mr-1.5" />{t("settingsPage_locations")}</TabsTrigger>
          <TabsTrigger value="refineries"><Factory className="size-4 mr-1.5" />{t("settingsPage_refineries")}</TabsTrigger>
          <TabsTrigger value="users"><UserCircle2 className="size-4 mr-1.5" />{t("settingsPage_users")}</TabsTrigger>
          <TabsTrigger value="roles"><ShieldCheck className="size-4 mr-1.5" />{t("settingsPage_roles")}</TabsTrigger>
          <TabsTrigger value="alerts"><Bell className="size-4 mr-1.5" />{t("settingsPage_alerts")}</TabsTrigger>
        </TabsList>
        <TabsContent value="tenant" className="mt-5"><TenantTab /></TabsContent>
        <TabsContent value="grades" className="mt-5"><GradesTab /></TabsContent>
        <TabsContent value="locations" className="mt-5"><LocationsTab /></TabsContent>
        <TabsContent value="refineries" className="mt-5"><RefineriesTab /></TabsContent>
        <TabsContent value="users" className="mt-5"><UsersTab /></TabsContent>
        <TabsContent value="roles" className="mt-5"><RolesTab /></TabsContent>
        <TabsContent value="alerts" className="mt-5"><AlertsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TenantTab() {
  const { t } = useI18n();
  const tenant = trpc.settings.get.useQuery();
  const update = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success(t("toastSaved"));
      tenant.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const settings = ((tenant.data as any)?.settings ?? {}) as Record<string, any>;
  const f = useForm({
    values: tenant.data
      ? {
          name: (tenant.data as any).name ?? "",
          industryType: (tenant.data as any).industryType ?? "",
          materialName: (tenant.data as any).materialName ?? "",
          unitOfMeasure: (tenant.data as any).unitOfMeasure ?? "",
          currency: (tenant.data as any).currency ?? "",
          timezone: (tenant.data as any).timezone ?? "",
          // Company / GST details (stored in tenant.settings)
          legalName: settings.legalName ?? "",
          gstin: settings.gstin ?? "",
          pan: settings.pan ?? "",
          address: settings.address ?? "",
          state: settings.state ?? "",
          stateCode: settings.stateCode ?? "",
          email: settings.email ?? "",
          phone: settings.phone ?? "",
          taxRate: typeof settings.taxRate === "number" ? settings.taxRate : 0.05,
          defaultHsn: settings.defaultHsn ?? "2505",
          // Bank details (for invoice footer)
          bankName: settings.bankName ?? "",
          bankAccount: settings.bankAccount ?? "",
          bankIfsc: settings.bankIfsc ?? "",
          bankBranch: settings.bankBranch ?? "",
          upiId: settings.upiId ?? "",
          invoiceFooterNote: settings.invoiceFooterNote ?? "",
        }
      : undefined,
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <form
            className="space-y-6"
            onSubmit={f.handleSubmit((v: any) =>
              update.mutate({
                name: v.name,
                industryType: v.industryType,
                materialName: v.materialName,
                unitOfMeasure: v.unitOfMeasure,
                currency: v.currency,
                timezone: v.timezone,
                settings: {
                  legalName: v.legalName,
                  gstin: v.gstin,
                  pan: v.pan,
                  address: v.address,
                  state: v.state,
                  stateCode: v.stateCode,
                  email: v.email,
                  phone: v.phone,
                  taxRate: Number(v.taxRate ?? 0),
                  defaultHsn: v.defaultHsn,
                  bankName: v.bankName,
                  bankAccount: v.bankAccount,
                  bankIfsc: v.bankIfsc,
                  bankBranch: v.bankBranch,
                  upiId: v.upiId,
                  invoiceFooterNote: v.invoiceFooterNote,
                },
              } as any),
            )}
          >
            {/* Workspace */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Workspace
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t("field_companyName")}><Input {...f.register("name")} /></Field>
                <Field label={t("field_industry")}><Input {...f.register("industryType")} /></Field>
                <Field label="Material name"><Input {...f.register("materialName")} /></Field>
                <Field label="Unit"><Input {...f.register("unitOfMeasure")} /></Field>
                <Field label="Currency"><Input {...f.register("currency")} /></Field>
                <Field label="Timezone"><Input {...f.register("timezone")} /></Field>
              </div>
            </div>

            {/* Company / GST details */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Company details (used on invoices)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Legal name (printed on invoice)">
                  <Input placeholder="ABC Sand Mining Pvt. Ltd." {...f.register("legalName")} />
                </Field>
                <Field label="GSTIN">
                  <Input placeholder="24ABCDE1234F1Z5" {...f.register("gstin")} />
                </Field>
                <Field label="PAN">
                  <Input placeholder="ABCDE1234F" {...f.register("pan")} />
                </Field>
                <Field label="Default HSN/SAC code">
                  <Input placeholder="2505 (Sand)" {...f.register("defaultHsn")} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Registered address">
                    <Input placeholder="Plot 12, Industrial Area, Vadodara" {...f.register("address")} />
                  </Field>
                </div>
                <Field label="State">
                  <Input placeholder="Gujarat" {...f.register("state")} />
                </Field>
                <Field label="State code">
                  <Input placeholder="24" {...f.register("stateCode")} />
                </Field>
                <Field label="Contact email (Reply-To)">
                  <Input type="email" placeholder="billing@company.com" {...f.register("email")} />
                </Field>
                <Field label="Phone">
                  <Input type="tel" placeholder="+91 …" {...f.register("phone")} />
                </Field>
                <Field label="Default tax rate (decimal e.g. 0.05 for 5%)">
                  <Input type="number" step="0.01" {...f.register("taxRate", { valueAsNumber: true })} />
                </Field>
              </div>
            </div>

            {/* Bank details */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Bank details (printed on invoices)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Bank name"><Input {...f.register("bankName")} /></Field>
                <Field label="Account number"><Input {...f.register("bankAccount")} /></Field>
                <Field label="IFSC"><Input {...f.register("bankIfsc")} /></Field>
                <Field label="Branch"><Input {...f.register("bankBranch")} /></Field>
                <Field label="UPI ID (optional)"><Input placeholder="company@hdfc" {...f.register("upiId")} /></Field>
                <Field label="Invoice footer note (optional)">
                  <Input placeholder="Subject to Vadodara jurisdiction." {...f.register("invoiceFooterNote")} />
                </Field>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? t("saving") : t("saveChanges")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function GradesTab() {
  const { t, fmtMoney } = useI18n();
  const list = trpc.materialGrade.list.useQuery({});
  const utils = trpc.useUtils();
  const create = trpc.materialGrade.create.useMutation({
    onSuccess: () => {
      toast.success(t("toastAdded"));
      utils.materialGrade.list.invalidate();
      f.reset();
    },
    onError: (e) => toast.error(e.message),
  });
  const f = useForm({
    defaultValues: { name: "", color: "#3B82F6", pricePerUnit: 0, sortOrder: 0 },
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">{t("settingsPage_addGrade")}</p>
          <form
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            onSubmit={f.handleSubmit((v) =>
              create.mutate({
                ...v,
                pricePerUnit: Math.round(Number(v.pricePerUnit) * 100),
              } as any),
            )}
          >
            <Field label={t("name")}><Input {...f.register("name")} /></Field>
            <Field label={t("field_color")}>
              <Input type="color" {...f.register("color")} className="h-10 w-full p-1" />
            </Field>
            <Field label={t("field_pricePerUnit")}>
              <Input type="number" step="0.01" {...f.register("pricePerUnit", { valueAsNumber: true })} />
            </Field>
            <Button type="submit" className="h-10">
              <Plus className="size-4 mr-1" />{t("add")}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {(list.data?.items ?? []).map((g: any) => (
          <Card key={g._id}>
            <CardContent className="p-4 flex items-center gap-3">
              <span
                className="size-9 rounded-xl shrink-0"
                style={{ background: g.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{g.name}</div>
                {g.description && (
                  <div className="text-xs text-muted-foreground truncate">{g.description}</div>
                )}
              </div>
              <div className="text-right">
                <div className="font-medium tabular text-sm">{fmtMoney(g.pricePerUnit ?? 0)}</div>
                {g.isActive ? (
                  <Badge variant="success" className="text-[10px]">{t("active")}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">{t("inactive")}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LocationsTab() {
  const { t } = useI18n();
  const list = trpc.location.list.useQuery({});
  const utils = trpc.useUtils();
  const create = trpc.location.create.useMutation({
    onSuccess: () => {
      toast.success(t("toastAdded"));
      utils.location.list.invalidate();
      f.reset();
    },
    onError: (e) => toast.error(e.message),
  });
  const f = useForm({
    defaultValues: { name: "", type: "WAREHOUSE" as const, address: "" },
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">{t("settingsPage_addLocation")}</p>
          <form
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            onSubmit={f.handleSubmit((v) => create.mutate(v as any))}
          >
            <Field label={t("name")}><Input {...f.register("name")} /></Field>
            <Field label={t("field_locationType")}>
              <Select
                value={f.watch("type")}
                onValueChange={(v) => f.setValue("type", v as any)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOURCE">{t("loc_source")}</SelectItem>
                  <SelectItem value="REFINERY">{t("loc_refinery")}</SelectItem>
                  <SelectItem value="WAREHOUSE">{t("loc_warehouse")}</SelectItem>
                  <SelectItem value="CUSTOMER_SITE">{t("loc_customerSite")}</SelectItem>
                  <SelectItem value="EXTERNAL">{t("loc_external")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("address")}><Input {...f.register("address")} /></Field>
            <Button type="submit" className="h-10">
              <Plus className="size-4 mr-1" />{t("add")}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(list.data?.items ?? []).map((l: any) => (
          <Card key={l._id}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                <MapPin className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{l.type}</Badge>
                  {l.address && <span className="truncate">{l.address}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RefineriesTab() {
  const { t, fmtNumber } = useI18n();
  const list = trpc.refinery.list.useQuery({});
  if (list.isLoading) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(list.data?.items ?? []).map((r: any) => (
        <Card key={r._id}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                <Factory className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.locationId?.name}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Daily capacity</div>
            <div className="text-2xl font-semibold tabular">
              {fmtNumber(r.dailyCapacityTons ?? 0)} <span className="text-sm font-normal text-muted-foreground">tons</span>
            </div>
            {r.supportedGradeIds?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {r.supportedGradeIds.map((g: any) => (
                  <Badge key={g._id} variant="outline" className="text-[10px]">
                    {g.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {!(list.data?.items ?? []).length && (
        <Card className="border-dashed sm:col-span-2">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("noDataYet")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsersTab() {
  const { t } = useI18n();
  const list = trpc.user.list.useQuery();
  return (
    <div className="space-y-2">
      {(list.data?.items ?? []).map((u: any) => (
        <Card key={u._id}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold shrink-0">
              {(u.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{u.name}</div>
              <div className="text-xs text-muted-foreground truncate">{u.email}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline">{u.roleName}</Badge>
              {u.isActive ? (
                <Badge variant="success" className="text-[10px]">{t("active")}</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">{t("inactive")}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RolesTab() {
  const { t } = useI18n();
  const list = trpc.role.list.useQuery();
  return (
    <div className="space-y-2">
      {(list.data ?? []).map((r: any) => (
        <Card key={r._id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="size-4 text-muted-foreground shrink-0" />
                <span className="font-semibold truncate">{r.name}</span>
              </div>
              <Badge variant={r.isSystem ? "default" : "outline"}>
                {r.isSystem ? t("settingsPage_systemRole") : t("settingsPage_customRole")}
              </Badge>
            </div>
            {r.description && (
              <p className="text-xs text-muted-foreground mb-2">{r.description}</p>
            )}
            <p className="text-xs text-muted-foreground tabular">
              {(r.permissions ?? []).length} permission(s)
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlertsTab() {
  const { t } = useI18n();
  const rules = trpc.alert.rules.useQuery();
  const utils = trpc.useUtils();
  const upsert = trpc.alert.upsertRule.useMutation({
    onSuccess: () => {
      utils.alert.rules.invalidate();
      toast.success(t("toastUpdated"));
    },
  });
  if (!rules.data?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("noDataYet")}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {(rules.data ?? []).map((r: any) => (
        <Card key={r.alertType}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
              <Bell className="size-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium font-mono text-xs sm:text-sm">{r.alertType}</div>
              <div className="text-xs text-muted-foreground">
                Threshold: {r.thresholdValue} {r.thresholdUnit} ·{" "}
                {[
                  r.channels?.inApp && "In-app",
                  r.channels?.email && "Email",
                  r.channels?.sms && "SMS",
                ].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
            <Switch
              checked={!!r.isEnabled}
              onCheckedChange={(v) =>
                upsert.mutate({
                  alertType: r.alertType,
                  isEnabled: v,
                  thresholdValue: r.thresholdValue,
                  thresholdUnit: r.thresholdUnit,
                  channels: r.channels,
                } as any)
              }
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
