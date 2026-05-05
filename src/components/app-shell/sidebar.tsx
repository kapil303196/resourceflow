"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScrollText,
  Pickaxe,
  Factory,
  Boxes,
  ShoppingCart,
  Users,
  Receipt,
  HardHat,
  Truck,
  UserCircle2,
  Map,
  FileText,
  BarChart3,
  Bell,
  Settings,
  History,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import type { DictKey, Locale } from "@/lib/i18n/dictionaries";

/**
 * Sidebar grouping is ordered by how often a sand-mining owner needs each
 * module on a typical day. Daily-flow items live at the top; setup/rare
 * items (licenses, refinery processing, contractors, audit) are pushed
 * down so the active operating surface is one tap away.
 */
type GroupKey = "today" | "sales" | "people" | "setup" | "system";

const GROUP_LABELS: Record<Locale, Record<GroupKey, string>> = {
  en: {
    today: "Today",
    sales: "Sales & customers",
    people: "Fleet & people",
    setup: "Setup",
    system: "System",
  },
  hi: {
    today: "आज",
    sales: "बिक्री व ग्राहक",
    people: "बेड़ा व लोग",
    setup: "व्यवस्थापन",
    system: "सिस्टम",
  },
  gu: {
    today: "આજે",
    sales: "વેચાણ અને ગ્રાહકો",
    people: "કાફલો અને લોકો",
    setup: "વ્યવસ્થા",
    system: "સિસ્ટમ",
  },
};

export type NavItem = {
  labelKey: DictKey;
  href: string;
  icon: any;
  perm?: string;
  group: GroupKey;
};

export const NAV_ITEMS: NavItem[] = [
  // 🏃 Daily — Dashboard + the actions an owner does multiple times a day
  { labelKey: "dashboard", href: "/", icon: LayoutDashboard, group: "today" },
  { labelKey: "trips", href: "/trips", icon: Map, perm: "trip.read", group: "today" },
  { labelKey: "extraction", href: "/extraction", icon: Pickaxe, perm: "extraction.read", group: "today" },
  { labelKey: "inventory", href: "/inventory", icon: Boxes, perm: "inventory.read", group: "today" },
  { labelKey: "alerts", href: "/alerts", icon: Bell, group: "today" },

  // 💰 Sales — Order-to-cash; checked daily/weekly
  { labelKey: "salesOrders", href: "/sales-orders", icon: FileSpreadsheet, perm: "salesOrder.read", group: "sales" },
  { labelKey: "invoices", href: "/invoices", icon: Receipt, perm: "invoice.read", group: "sales" },
  { labelKey: "customers", href: "/customers", icon: Users, perm: "customer.read", group: "sales" },

  // 👥 Fleet & people — Used when changes happen, occasional reviews
  { labelKey: "fleet", href: "/fleet", icon: Truck, perm: "vehicle.read", group: "people" },
  { labelKey: "drivers", href: "/drivers", icon: UserCircle2, perm: "driver.read", group: "people" },
  { labelKey: "contractors", href: "/contractors", icon: HardHat, perm: "contractor.read", group: "people" },

  // 🛠️ Setup — Configured early, edited rarely
  { labelKey: "refineries", href: "/refineries", icon: Factory, perm: "refineryBatch.read", group: "setup" },
  { labelKey: "procurement", href: "/procurement", icon: ShoppingCart, perm: "purchase.read", group: "setup" },
  { labelKey: "licenses", href: "/licenses", icon: ScrollText, perm: "license.read", group: "setup" },
  { labelKey: "documents", href: "/documents", icon: FileText, perm: "document.read", group: "setup" },

  // ⚙️ System — Reports & admin
  { labelKey: "reports", href: "/reports", icon: BarChart3, perm: "report.read", group: "system" },
  { labelKey: "auditLog", href: "/audit", icon: History, perm: "auditLog.read", group: "system" },
  { labelKey: "settings", href: "/settings", icon: Settings, group: "system" },
];

function hasPerm(permissions: string[], p?: string) {
  if (!p) return true;
  return permissions.includes("*") || permissions.includes(p);
}

export function SidebarNav({
  permissions,
  onNavigate,
}: {
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const groupTranslations = GROUP_LABELS[locale] ?? GROUP_LABELS.en;

  const items = NAV_ITEMS.filter((n) => hasPerm(permissions, n.perm));
  const groups = items.reduce<Record<GroupKey, NavItem[]>>((acc, n) => {
    (acc[n.group] ??= []).push(n);
    return acc;
  }, {} as any);

  // Preserve the order: today → sales → people → setup → system
  const ORDER: GroupKey[] = ["today", "sales", "people", "setup", "system"];

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
      {ORDER.filter((g) => groups[g]?.length).map((group) => (
        <div key={group}>
          <div className="px-2 mb-1.5 text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/60">
            {groupTranslations[group]}
          </div>
          <div className="space-y-0.5">
            {groups[group].map((n) => {
              const active =
                n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all",
                    active
                      ? "bg-sidebar-active/20 text-white shadow-[inset_2px_0_0_0_hsl(var(--sidebar-active))]"
                      : "text-sidebar-foreground hover:bg-sidebar-muted hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      active ? "text-sidebar-active" : "text-sidebar-foreground/70 group-hover:text-white",
                    )}
                  />
                  <span className="truncate">{t(n.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function DesktopSidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside className="hidden md:flex md:flex-col md:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-muted/40 shrink-0">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sidebar-muted/40">
        <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-success grid place-items-center shadow-lg">
          <Boxes className="size-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-white font-semibold leading-tight">ResourceFlow</div>
          <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">
            Operations
          </div>
        </div>
      </div>
      <SidebarNav permissions={permissions} />
    </aside>
  );
}
