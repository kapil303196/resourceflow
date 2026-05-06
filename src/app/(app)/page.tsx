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
  ArrowRight,
  CreditCard,
  FileText,
  Map,
  Pickaxe,
  Receipt,
  ScrollText,
  ShoppingCart,
  Truck,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

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
  const { t, fmtMoney, fmtTonnage, fmtDate } = useI18n();
  const tenant = session?.user.tenantSettings;
  const queue = trpc.dashboard.actionQueue.useQuery(undefined, { refetchInterval: 30_000 });
  const kpis = trpc.dashboard.kpis.useQuery();
  const monthly = trpc.dashboard.monthlyInOut.useQuery();

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto space-y-5 pb-24">
      {/* Greeting */}
      <div>
        <p className="text-sm text-muted-foreground">{greeting(t)},</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {session?.user?.name?.split(" ")[0] ?? ""}
        </h1>
      </div>

      {/* Action queue */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          What needs your attention
        </h2>
        <div className="space-y-2">
          {queue.isLoading && (
            <>
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </>
          )}
          {queue.data && (
            <>
              <ActionCard
                href="/trips?status=COMPLETED"
                icon={Receipt}
                tone="emerald"
                count={queue.data.tripsToInvoice.count}
                title="Trips ready to invoice"
                desc="Completed deliveries that don't have an invoice yet"
                cta="Invoice now"
              />
              <ActionCard
                href="/invoices?status=OVERDUE"
                icon={CreditCard}
                tone="rose"
                count={queue.data.overdueInvoices.count}
                title="Overdue invoices"
                desc="Customers past due — record a payment or follow up"
                cta="Collect"
                emphasised
              />
              <ActionCard
                href="/sales-orders?status=CONFIRMED"
                icon={ShoppingCart}
                tone="violet"
                count={queue.data.pendingDispatches.count}
                title="Sales orders awaiting dispatch"
                desc="Confirmed orders that need a vehicle assigned"
                cta="Dispatch"
              />
              <ActionCard
                href="/trips?status=IN_TRANSIT"
                icon={Map}
                tone="blue"
                count={queue.data.inTransit.count}
                title="Trips in transit"
                desc="Mark complete when they arrive"
                cta="Track"
              />
              <ActionCard
                href="/refineries"
                icon={Pickaxe}
                tone="amber"
                count={queue.data.pendingExtractionsCount}
                title="Extractions pending refinery"
                desc="Raw batches waiting to be processed into grades"
                cta="Process"
              />
              <ActionCard
                href="/licenses?filter=expiring"
                icon={ScrollText}
                tone="amber"
                count={queue.data.expiringLicenses.count}
                title="Licenses expiring soon"
                desc="Renew before validity ends"
                cta="Review"
              />
              <ActionCard
                href="/documents?filter=expiring"
                icon={FileText}
                tone="amber"
                count={queue.data.expiringDocs.count}
                title="Documents expiring soon"
                desc="Vehicle / driver / license paperwork to renew"
                cta="View"
              />
              {queue.data.criticalAlerts.count > 0 && (
                <ActionCard
                  href="/alerts"
                  icon={AlertTriangle}
                  tone="rose"
                  count={queue.data.criticalAlerts.count}
                  title="Critical alerts"
                  desc="Issues that need immediate attention"
                  cta="See all"
                  emphasised
                />
              )}
              {/* When everything is zero */}
              {Object.values({
                a: queue.data.tripsToInvoice.count,
                b: queue.data.overdueInvoices.count,
                c: queue.data.pendingDispatches.count,
                d: queue.data.inTransit.count,
                e: queue.data.pendingExtractionsCount,
                f: queue.data.expiringLicenses.count,
                g: queue.data.expiringDocs.count,
                h: queue.data.criticalAlerts.count,
              }).every((n) => n === 0) && (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <div className="mx-auto size-12 rounded-full bg-emerald-500/10 grid place-items-center mb-2">
                      <span className="text-2xl">✓</span>
                    </div>
                    <p className="font-medium">You're all caught up.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      No action items. Use the quick actions below to start a new task.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Compact KPI strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <KpiPill
          label={`${t("tonnage")} (${t("thisMonth")})`}
          value={kpis.isLoading ? "…" : fmtTonnage(kpis.data?.tonnageThisMonth ?? 0, tenant?.unitOfMeasure)}
        />
        <KpiPill
          label={t("revenue")}
          value={kpis.isLoading ? "…" : fmtMoney(kpis.data?.revenueThisMonth ?? 0, tenant?.currency)}
        />
        <KpiPill
          label={t("receivables")}
          value={kpis.isLoading ? "…" : fmtMoney(kpis.data?.outstandingReceivables ?? 0, tenant?.currency)}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          {t("quickActions")}
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex flex-col gap-2 p-3 rounded-2xl border bg-card hover:bg-accent active:scale-[0.98] transition-all"
              >
                <div className={cn("size-9 rounded-xl bg-gradient-to-br grid place-items-center text-white shadow-md", a.color)}>
                  <Icon className="size-[16px]" strokeWidth={2.25} />
                </div>
                <div className="text-xs font-medium leading-tight">{t(a.label)}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Trend chart */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 pb-1">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Tonnage flow · last 12 months
            </h3>
          </div>
          <div className="h-[180px]">
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
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  tone,
  count,
  title,
  desc,
  cta,
  emphasised,
}: {
  href: string;
  icon: any;
  tone: "blue" | "rose" | "amber" | "emerald" | "violet";
  count: number;
  title: string;
  desc: string;
  cta: string;
  emphasised?: boolean;
}) {
  if (count === 0) return null;
  const tones: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  };
  return (
    <Link href={href}>
      <Card
        className={cn(
          "transition-all hover:shadow-md active:scale-[0.99]",
          emphasised && "ring-1 ring-rose-300/40 dark:ring-rose-900/40",
        )}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn("size-11 rounded-xl grid place-items-center shrink-0", tones[tone])}>
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular text-lg leading-none">{count}</span>
              <span className="font-medium text-sm">{title}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{desc}</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
            {cta}
            <ArrowRight className="size-3.5" />
          </div>
          <ArrowRight className="size-4 text-muted-foreground shrink-0 sm:hidden" />
        </CardContent>
      </Card>
    </Link>
  );
}

function KpiPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">
          {label}
        </p>
        <p className="text-base sm:text-lg font-semibold tabular mt-1 truncate">{value}</p>
      </CardContent>
    </Card>
  );
}
