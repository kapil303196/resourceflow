"use client";
import { useSession } from "next-auth/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  HardHat,
  Receipt,
  Truck,
  TrendingUp,
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatMoney, formatTonnage } from "@/lib/utils";

export default function DashboardPage() {
  const { data: session } = useSession();
  const tenant = session?.user.tenantSettings;
  const kpis = trpc.dashboard.kpis.useQuery();
  const monthly = trpc.dashboard.monthlyInOut.useQuery();
  const byGrade = trpc.dashboard.salesByGrade.useQuery();
  const topCustomers = trpc.dashboard.topCustomers.useQuery();
  const topVehicles = trpc.dashboard.topVehicles.useQuery();

  const trend =
    kpis.data && kpis.data.tonnageLastMonth > 0
      ? {
          delta: kpis.data.tonnageChange,
          direction:
            kpis.data.tonnageChange > 0
              ? ("up" as const)
              : kpis.data.tonnageChange < 0
                ? ("down" as const)
                : ("flat" as const),
        }
      : undefined;

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={`Tonnage (this month)`}
          value={formatTonnage(kpis.data?.tonnageThisMonth ?? 0, tenant?.unitOfMeasure)}
          icon={<TrendingUp className="size-4" />}
          trend={trend}
        />
        <KpiCard
          label="Active orders"
          value={kpis.data?.activeOrders ?? 0}
          icon={<Receipt className="size-4" />}
        />
        <KpiCard
          label="Trips in progress"
          value={kpis.data?.tripsInProgress ?? 0}
          icon={<Truck className="size-4" />}
        />
        <KpiCard
          label="Critical alerts"
          value={kpis.data?.criticalAlerts ?? 0}
          icon={<AlertTriangle className="size-4" />}
          className={
            (kpis.data?.criticalAlerts ?? 0) > 0
              ? "border-amber-300 dark:border-amber-700"
              : undefined
          }
        />
        <KpiCard
          label="Revenue (this month)"
          value={formatMoney(kpis.data?.revenueThisMonth ?? 0, tenant?.currency)}
          icon={<Activity className="size-4" />}
        />
        <KpiCard
          label="Outstanding receivables"
          value={formatMoney(
            kpis.data?.outstandingReceivables ?? 0,
            tenant?.currency,
          )}
          icon={<Receipt className="size-4" />}
        />
        <KpiCard
          label="Pending contractor payouts"
          value={formatMoney(
            kpis.data?.pendingContractorPayments ?? 0,
            tenant?.currency,
          )}
          icon={<HardHat className="size-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Monthly tonnage in vs out</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly.data ?? []}>
                <XAxis dataKey="period" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="in" fill="#10b981" name="In" />
                <Bar dataKey="out" fill="#ef4444" name="Out" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by grade (this month)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byGrade.data ?? []}
                  dataKey="tonnage"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {(byGrade.data ?? []).map((entry: any, idx) => (
                    <Cell key={idx} fill={entry.color || "#3B82F6"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 customers (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            {(topCustomers.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            <ul className="space-y-2">
              {(topCustomers.data ?? []).map((c: any) => (
                <li key={c.customerId} className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="font-medium">
                    {formatMoney(c.revenue, tenant?.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 vehicles (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            {(topVehicles.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            <ul className="space-y-2">
              {(topVehicles.data ?? []).map((v: any) => (
                <li key={v.vehicleId} className="flex justify-between text-sm">
                  <span>{v.registrationNumber}</span>
                  <span className="font-medium">
                    {formatTonnage(v.tonnage, tenant?.unitOfMeasure)} ·{" "}
                    {v.tripCount} trips
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
