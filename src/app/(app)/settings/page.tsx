"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Settings"
        description="Tenant, materials, locations, users, roles and alert rules"
      />
      <Tabs defaultValue="tenant" className="mt-2">
        <TabsList>
          <TabsTrigger value="tenant">Tenant</TabsTrigger>
          <TabsTrigger value="grades">Material grades</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="refineries">Refineries</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="alerts">Alert rules</TabsTrigger>
        </TabsList>
        <TabsContent value="tenant"><TenantTab /></TabsContent>
        <TabsContent value="grades"><GradesTab /></TabsContent>
        <TabsContent value="locations"><LocationsTab /></TabsContent>
        <TabsContent value="refineries"><RefineriesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TenantTab() {
  const t = trpc.settings.get.useQuery();
  const update = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Saved.");
      t.refetch();
    },
  });
  const f = useForm({
    values: t.data
      ? {
          name: (t.data as any).name ?? "",
          industryType: (t.data as any).industryType ?? "",
          materialName: (t.data as any).materialName ?? "",
          unitOfMeasure: (t.data as any).unitOfMeasure ?? "",
          currency: (t.data as any).currency ?? "",
          timezone: (t.data as any).timezone ?? "",
        }
      : undefined,
  });
  return (
    <Card>
      <CardContent className="p-6">
        <form
          className="grid grid-cols-2 gap-4 max-w-2xl"
          onSubmit={f.handleSubmit((v) => update.mutate(v as any))}
        >
          <Field label="Company name"><Input {...f.register("name")} /></Field>
          <Field label="Industry"><Input {...f.register("industryType")} /></Field>
          <Field label="Material name"><Input {...f.register("materialName")} /></Field>
          <Field label="Unit"><Input {...f.register("unitOfMeasure")} /></Field>
          <Field label="Currency"><Input {...f.register("currency")} /></Field>
          <Field label="Timezone"><Input {...f.register("timezone")} /></Field>
          <div className="col-span-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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

function GradesTab() {
  const list = trpc.materialGrade.list.useQuery();
  const create = trpc.materialGrade.create.useMutation({
    onSuccess: () => { toast.success("Created"); list.refetch(); f.reset(); },
  });
  const f = useForm({ defaultValues: { name: "", color: "#3B82F6", pricePerUnit: 0, sortOrder: 0 } });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add grade</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-4 gap-3 items-end"
            onSubmit={f.handleSubmit((v) =>
              create.mutate({
                ...v,
                pricePerUnit: Math.round(Number(v.pricePerUnit) * 100),
              } as any),
            )}
          >
            <Field label="Name"><Input {...f.register("name")} /></Field>
            <Field label="Color"><Input type="color" {...f.register("color")} /></Field>
            <Field label="Price per unit (major)">
              <Input type="number" step="0.01" {...f.register("pricePerUnit", { valueAsNumber: true })} />
            </Field>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data?.items ?? []).map((g: any) => (
                <TableRow key={g._id}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>
                    <span className="inline-block size-3 rounded mr-2" style={{ background: g.color }} />
                    {g.color}
                  </TableCell>
                  <TableCell>{(g.pricePerUnit / 100).toFixed(2)}</TableCell>
                  <TableCell>{g.isActive ? <Badge variant="success">yes</Badge> : <Badge variant="secondary">no</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LocationsTab() {
  const list = trpc.location.list.useQuery();
  const create = trpc.location.create.useMutation({
    onSuccess: () => { toast.success("Created"); list.refetch(); f.reset(); },
  });
  const f = useForm({ defaultValues: { name: "", type: "WAREHOUSE", address: "" } });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add location</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-4 gap-3 items-end"
            onSubmit={f.handleSubmit((v) => create.mutate(v as any))}
          >
            <Field label="Name"><Input {...f.register("name")} /></Field>
            <Field label="Type">
              <select className="border rounded h-10 px-2 bg-background" {...f.register("type")}>
                <option>SOURCE</option>
                <option>REFINERY</option>
                <option>WAREHOUSE</option>
                <option>CUSTOMER_SITE</option>
                <option>EXTERNAL</option>
              </select>
            </Field>
            <Field label="Address"><Input {...f.register("address")} /></Field>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data?.items ?? []).map((l: any) => (
                <TableRow key={l._id}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{l.address}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RefineriesTab() {
  const list = trpc.refinery.list.useQuery();
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Daily capacity</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data?.items ?? []).map((r: any) => (
              <TableRow key={r._id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.locationId?.name}</TableCell>
                <TableCell>{r.dailyCapacityTons}</TableCell>
                <TableCell>{r.isActive ? <Badge variant="success">yes</Badge> : <Badge variant="secondary">no</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const list = trpc.user.list.useQuery();
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data?.items ?? []).map((u: any) => (
              <TableRow key={u._id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.roleName}</TableCell>
                <TableCell>{u.isActive ? <Badge variant="success">yes</Badge> : <Badge variant="secondary">no</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RolesTab() {
  const list = trpc.role.list.useQuery();
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>System</TableHead>
              <TableHead>Permissions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data ?? []).map((r: any) => (
              <TableRow key={r._id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.isSystem ? <Badge>system</Badge> : <Badge variant="outline">custom</Badge>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(r.permissions || []).slice(0, 6).join(", ")}
                  {(r.permissions || []).length > 6 ? ` +${r.permissions.length - 6} more` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AlertsTab() {
  const rules = trpc.alert.rules.useQuery();
  const upsert = trpc.alert.upsertRule.useMutation({
    onSuccess: () => rules.refetch(),
  });
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rules.data ?? []).map((r: any) => (
              <TableRow key={r.alertType}>
                <TableCell>{r.alertType}</TableCell>
                <TableCell>{r.thresholdValue} {r.thresholdUnit}</TableCell>
                <TableCell className="text-xs">
                  {[r.channels?.inApp && "In-app", r.channels?.email && "Email", r.channels?.sms && "SMS"]
                    .filter(Boolean)
                    .join(", ")}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={r.isEnabled ? "default" : "outline"}
                    onClick={() =>
                      upsert.mutate({
                        alertType: r.alertType,
                        isEnabled: !r.isEnabled,
                      } as any)
                    }
                  >
                    {r.isEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rules.data?.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  No alert rules configured yet. Run the seed script to populate defaults.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
