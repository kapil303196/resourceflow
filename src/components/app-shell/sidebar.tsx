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
  Building2,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import type { DictKey, Locale } from "@/lib/i18n/dictionaries";

/**
 * Sidebar collapses 16+ entities into 5 owner-centric sections, with the
 * less-frequent destinations nested behind expandable groups. Top-level
 * is what an owner taps every day; inner nodes are reference data.
 */
type SectionKey = "today" | "sales" | "ops" | "people" | "more";

const SECTION_LABELS: Record<Locale, Record<SectionKey, string>> = {
  en: { today: "Today", sales: "Sales", ops: "Operations", people: "Fleet & people", more: "More" },
  hi: { today: "आज", sales: "बिक्री", ops: "संचालन", people: "बेड़ा व लोग", more: "अधिक" },
  gu: { today: "આજે", sales: "વેચાણ", ops: "કામગીરી", people: "કાફલો અને લોકો", more: "વધુ" },
};

export type NavItem = {
  labelKey: DictKey;
  href: string;
  icon: any;
  perm?: string;
};

const NAV: Record<SectionKey, NavItem[]> = {
  today: [
    { labelKey: "dashboard", href: "/", icon: LayoutDashboard },
    { labelKey: "alerts", href: "/alerts", icon: Bell },
  ],
  sales: [
    { labelKey: "salesOrders", href: "/sales-orders", icon: FileSpreadsheet, perm: "salesOrder.read" },
    { labelKey: "invoices", href: "/invoices", icon: Receipt, perm: "invoice.read" },
    { labelKey: "customers", href: "/customers", icon: Users, perm: "customer.read" },
  ],
  ops: [
    { labelKey: "trips", href: "/trips", icon: Map, perm: "trip.read" },
    { labelKey: "extraction", href: "/extraction", icon: Pickaxe, perm: "extraction.read" },
    { labelKey: "inventory", href: "/inventory", icon: Boxes, perm: "inventory.read" },
    { labelKey: "refineries", href: "/refineries", icon: Factory, perm: "refineryBatch.read" },
    { labelKey: "licenses", href: "/licenses", icon: ScrollText, perm: "license.read" },
  ],
  people: [
    { labelKey: "fleet", href: "/fleet", icon: Truck, perm: "vehicle.read" },
    { labelKey: "drivers", href: "/drivers", icon: UserCircle2, perm: "driver.read" },
    { labelKey: "contractors", href: "/contractors", icon: HardHat, perm: "contractor.read" },
    { labelKey: "suppliers", href: "/procurement", icon: Building2, perm: "purchase.read" },
  ],
  more: [
    { labelKey: "documents", href: "/documents", icon: FileText, perm: "document.read" },
    { labelKey: "reports", href: "/reports", icon: BarChart3, perm: "report.read" },
    { labelKey: "auditLog", href: "/audit", icon: History, perm: "auditLog.read" },
    { labelKey: "settings", href: "/settings", icon: Settings },
  ],
};

const ORDER: SectionKey[] = ["today", "sales", "ops", "people", "more"];

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
  const labels = SECTION_LABELS[locale] ?? SECTION_LABELS.en;

  // Auto-expand the section containing the active route on first paint.
  const findActiveSection = (): SectionKey =>
    (ORDER.find((s) =>
      NAV[s].some((n) =>
        n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
      ),
    ) ?? "today");

  const [open, setOpen] = useState<SectionKey>(findActiveSection());

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">
      {ORDER.map((section) => {
        const items = NAV[section].filter((n) => hasPerm(permissions, n.perm));
        if (!items.length) return null;
        const isOpen = open === section;
        const isActive = items.some((n) =>
          n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
        );
        // "Today" stays always-flat; rest are collapsible accordion-style
        if (section === "today") {
          return (
            <div key={section} className="space-y-0.5">
              {items.map((n) => {
                const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
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
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-active" : "text-sidebar-foreground/70 group-hover:text-white")} />
                    <span className="truncate">{t(n.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          );
        }
        return (
          <div key={section} className="pt-1">
            <button
              onClick={() => setOpen(isOpen ? "today" : section)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] uppercase tracking-wider font-semibold transition-colors",
                isActive ? "text-white" : "text-sidebar-foreground/70 hover:text-white",
              )}
            >
              <span>{labels[section]}</span>
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  isOpen ? "rotate-0" : "-rotate-90",
                )}
              />
            </button>
            {isOpen && (
              <div className="space-y-0.5 mt-0.5">
                {items.map((n) => {
                  const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg pl-3.5 pr-2.5 py-1.5 text-sm transition-all",
                        active
                          ? "bg-sidebar-active/20 text-white shadow-[inset_2px_0_0_0_hsl(var(--sidebar-active))]"
                          : "text-sidebar-foreground hover:bg-sidebar-muted hover:text-white",
                      )}
                    >
                      <Icon className={cn("size-[16px] shrink-0", active ? "text-sidebar-active" : "text-sidebar-foreground/60 group-hover:text-white")} />
                      <span className="truncate">{t(n.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside className="hidden md:flex md:flex-col md:w-64 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-muted/40 shrink-0">
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
