"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Boxes, Receipt, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import type { DictKey } from "@/lib/i18n/dictionaries";

const ITEMS: { href: string; labelKey: DictKey; icon: any }[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/trips", labelKey: "trips", icon: Map },
  { href: "/inventory", labelKey: "inventory", icon: Boxes },
  { href: "/invoices", labelKey: "invoices", icon: Receipt },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t safe-pb">
      <ul className="grid grid-cols-5">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                <span className="truncate max-w-full px-1">{t(it.labelKey)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/settings"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors text-muted-foreground",
            )}
          >
            <Menu className="size-5" />
            <span>{t("more")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
