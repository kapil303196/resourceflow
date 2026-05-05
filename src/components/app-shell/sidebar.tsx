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
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { label: string; href: string; icon: any; perm?: string }[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Licenses", href: "/licenses", icon: ScrollText, perm: "license.read" },
  { label: "Extraction", href: "/extraction", icon: Pickaxe, perm: "extraction.read" },
  { label: "Refineries", href: "/refineries", icon: Factory, perm: "refineryBatch.read" },
  { label: "Inventory", href: "/inventory", icon: Boxes, perm: "inventory.read" },
  { label: "Procurement", href: "/procurement", icon: ShoppingCart, perm: "purchase.read" },
  { label: "Customers", href: "/customers", icon: Users, perm: "customer.read" },
  { label: "Sales orders", href: "/sales-orders", icon: Receipt, perm: "salesOrder.read" },
  { label: "Invoices", href: "/invoices", icon: Receipt, perm: "invoice.read" },
  { label: "Contractors", href: "/contractors", icon: HardHat, perm: "contractor.read" },
  { label: "Fleet", href: "/fleet", icon: Truck, perm: "vehicle.read" },
  { label: "Drivers", href: "/drivers", icon: UserCircle2, perm: "driver.read" },
  { label: "Trips", href: "/trips", icon: Map, perm: "trip.read" },
  { label: "Documents", href: "/documents", icon: FileText, perm: "document.read" },
  { label: "Reports", href: "/reports", icon: BarChart3, perm: "report.read" },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Audit log", href: "/audit", icon: History, perm: "auditLog.read" },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const has = (p?: string) =>
    !p || permissions.includes("*") || permissions.includes(p);

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-background">
      <div className="px-4 py-4 border-b">
        <Link href="/" className="font-semibold text-lg flex items-center gap-2">
          <Boxes className="size-5 text-primary" />
          ResourceFlow
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV.filter((n) => has(n.perm)).map((n) => {
          const Active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                Active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
