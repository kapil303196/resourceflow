"use client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Truck,
  ShoppingCart,
  Receipt,
  HardHat,
  Pickaxe,
  FileText,
  CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney, formatTonnage, cn } from "@/lib/utils";

function greeting(t: any) {
  const h = new Date().getHours();
  if (h < 12) return t("goodMorning");
  if (h < 17) return t("goodAfternoon");
  return t("goodEvening");
}

const QUICK_ACTIONS = [
  { href: "/trips?new=1", label: "newTrip" as const, icon: Truck, color: "from-blue-500 to-blue-600" },
  { href: "/extraction?new=1", label: "newExtraction" as const, icon: Pickaxe, color: "from-amber-500 to-amber-600" },
  { href: "/trips?slip=1", label: "issueLoadingSlip" as const, icon: FileText, color: "from-emerald-500 to-emerald-600" },
  { href: "/sales-orders?new=1", label: "newSalesOrder" as const, icon: ShoppingCart, color: "from-violet-500 to-violet-600" },
  { href: "/invoices?payment=1", label: "recordPayment" as const, icon: CreditCard, color: "from-teal-500 to-teal-600" },
  { href: "/invoices?new=1", label: "newInvoice" as const, icon: Receipt, color: "from-rose-500 to-rose-600" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const tenant = session?.user.tenantSettings;
  const kpis = trpc.dashboard.kpis.useQuery();
  const monthly = trpc.dashboard.monthlyInOut.useQuery();
  const alerts = trpc.alert.list.useQuery({ unreadOnly: true, limit: 5 });
  const topCustomers = trpc.dashboard.topCustomers.useQuery();
  const topVehicles = trpc.dashboard.topVehicles.useQuery();

  const trend = kpis.data?.tonnageChange ?? 0;
  const trendDir = trend > 0.001 ? "up" : trend < -0.001 ? "down" : "flat";

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{greeting(t)},</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {session?.user?.name?.split(" ")[0] ?? ""}
        </h1>
      </div>

      {(alerts.data?.length ?? 0) > 0 && (
        <Card className="border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-4" />
                <span className="text-sm font-semibold">{t("todayActions")}</span>
              </div>
              <Link
                href="/alerts"
                className="text-xs text-amber-800 dark:text-amber-200 hover:underline flex items-center"
              >
                {t("alerts")}
                <ChevronRight className="size-3" />
              </Link>
            </div>
            <ul className="space-y-1.5">
              {alerts.data!.slice(0, 5).map((a: any) => (
                <li key={a._id} className="flex items-start gap-2 text-sm">
                  <span
                    className={cn(
                      "mt-1 size-1.5 rounded-full shrink-0",
                      a.severity === "CRITICAL"
                        ? "bg-rose-500"
                        : a.severity === "WARNING"
                          ? "bg-amber-500"
                          : "bg-blue-500",
                    )}
                  />
                  <span className="flex-1">{a.title}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label={`${t("tonnage")} · ${t("thisMonth")}`}
          value={kpis.isLoading ? <Skeleton className="h-7 w-24" /> : formatTonnage(kpis.data?.tonnageThisMonth ?? 0, tenant?.unitOfMeasure)}
          trend={trendDir !== "flat" ? { delta: Math.abs(trend), direction: trendDir as any } : undefined}
          accent="blue"
          icon={Pickaxe}
        />
        <KpiTile
          label={t("revenue")}
          value={kpis.isLoading ? <Skeleton className="h-7 w-24" /> : formatMoney(kpis.data?.revenueThisMonth ?? 0, tenant?.currency)}
          accent="emerald"
          icon={Receipt}
        />
        <KpiTile
          label={t("receivables")}
          value={kpis.isLoading ? <Skeleton className="h-7 w-24" /> : formatMoney(kpis.data?.outstandingReceivables ?? 0, tenant?.currency)}
          accent="amber"
          icon={CreditCard}
        />
        <KpiTile
          label={t("contractorPayouts")}
          value={kpis.isLoading ? <Skeleton className="h-7 w-24" /> : formatMoney(kpis.data?.pendingContractorPayments ?? 0, tenant?.currency)}
          accent="violet"
          icon={HardHat}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SmallStat label={t("tripsInProgress")} value={kpis.data?.tripsInProgress ?? 0} />
        <SmallStat label={t("activeOrders")} value={kpis.data?.activeOrders ?? 0} />
        <SmallStat label={t("criticalAlerts")} value={kpis.data?.criticalAlerts ?? 0} danger={(kpis.data?.criticalAlerts ?? 0) > 0} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {t("quickActions")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex flex-col gap-2.5 p-3.5 rounded-2xl border bg-card hover:bg-accent active:scale-[0.98] transition-all"
              >
                <div className={cn("size-10 rounded-xl bg-gradient-to-br grid place-items-center text-white shadow-md", a.color)}>
                  <Icon className="size-[18px]" strokeWidth={2.25} />
                </div>
                <div className="text-sm font-medium leading-tight">{t(a.label)}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 pb-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Tonnage flow · last 12 months
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Material in (extraction + purchase) vs out (sales)
            </p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly.data ?? []} margin={{ top: 5, right: 16, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="in" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#inGrad)" name="In" />
                <Area type="monotone" dataKey="out" stroke="hsl(var(--warning))" strokeWidth={2} fill="url(#outGrad)" name="Out" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TopList
          title="Top customers · this month"
          items={(topCustomers.data ?? []).map((c: any) => ({
            id: c.customerId,
            primary: c.name,
            secondary: formatMoney(c.revenue, tenant?.currency),
          }))}
        />
        <TopList
          title="Top vehicles · this month"
          items={(topVehicles.data ?? []).map((v: any) => ({
            id: v.vehicleId,
            primary: v.registrationNumber,
            secondary: `${formatTonnage(v.tonnage, tenant?.unitOfMeasure)} · ${v.tripCount} trips`,
          }))}
        />
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  trend,
  accent,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  trend?: { delta: number; direction: "up" | "down" };
  accent: "blue" | "emerald" | "amber" | "violet";
  icon: any;
}) {
  const tones: Record<string, string> = {
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 relative">
        <div className={cn("absolute -top-6 -right-6 size-20 rounded-full bg-gradient-to-br opacity-80 blur-xl", tones[accent])} aria-hidden />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</p>
            <div className="text-xl sm:text-2xl font-semibold tabular">{value}</div>
            {trend && (
              <div className={cn("inline-flex items-center gap-1 text-[11px] font-medium", trend.direction === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {trend.direction === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {(trend.delta * 100).toFixed(1)}%
              </div>
            )}
          </div>
          <div className={cn("size-9 rounded-xl bg-gradient-to-br grid place-items-center shrink-0", tones[accent])}>
            <Icon className="size-[18px]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SmallStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <Card className={cn(danger && value > 0 && "border-destructive/40")}>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-xl font-semibold tabular mt-0.5", danger && value > 0 && "text-destructive")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TopList({ title, items }: { title: string; items: { id: string; primary: string; secondary: string }[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3">
                <span className="size-7 rounded-lg bg-muted text-muted-foreground grid place-items-center text-xs font-semibold">{i + 1}</span>
                <span className="flex-1 truncate text-sm font-medium">{it.primary}</span>
                <span className="text-sm tabular text-muted-foreground">{it.secondary}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
