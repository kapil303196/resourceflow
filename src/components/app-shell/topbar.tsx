"use client";
import { useSession, signOut } from "next-auth/react";
import { Bell, Moon, Sun, LogOut, User as UserIcon, Menu, Boxes, Languages } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { SidebarNav } from "./sidebar";
import { useI18n } from "@/components/i18n-provider";

export function Topbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unread = trpc.alert.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  return (
    <header className="h-14 sticky top-0 z-30 glass border-b safe-pt flex items-center px-3 sm:px-4 gap-2">
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={t("openMenu")}
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground border-sidebar-muted/40 p-0 flex flex-col"
        >
          <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sidebar-muted/40">
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-success grid place-items-center shadow-lg">
              <Boxes className="size-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-white font-semibold leading-tight">
                ResourceFlow
              </div>
              <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider truncate">
                {session?.user?.tenantName}
              </div>
            </div>
          </div>
          <SidebarNav
            permissions={session?.user?.permissions ?? []}
            onNavigate={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="hidden md:block font-medium text-sm text-muted-foreground truncate">
        {session?.user?.tenantName}
      </div>
      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Language">
            <Languages className="size-[18px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setLocale("en")} className={locale === "en" ? "bg-accent" : ""}>
            English
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLocale("hi")} className={locale === "hi" ? "bg-accent" : ""}>
            हिन्दी (Hindi)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLocale("gu")} className={locale === "gu" ? "bg-accent" : ""}>
            ગુજરાતી (Gujarati)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="size-[18px] dark:hidden" />
        <Moon className="size-[18px] hidden dark:block" />
      </Button>

      <Link href="/alerts" className="relative">
        <Button variant="ghost" size="icon" aria-label={t("alerts")}>
          <Bell className="size-[18px]" />
        </Button>
        {unread.data && unread.data > 0 ? (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive ring-2 ring-background" />
        ) : null}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors"
            aria-label="User menu"
          >
            <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
              {(session?.user?.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium leading-tight">
                {session?.user?.name}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {session?.user?.roleName}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {session?.user?.email}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <UserIcon className="size-4 mr-2" />
              {t("settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-4 mr-2" />
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
