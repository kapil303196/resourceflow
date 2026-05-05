"use client";
import { useSession, signOut } from "next-auth/react";
import { Bell, Moon, Sun, LogOut, User as UserIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";

export function Topbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const unread = trpc.alert.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-3">
      <div className="font-medium text-sm text-muted-foreground hidden md:block">
        {session?.user?.tenantName}
      </div>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="size-4 hidden dark:block" />
      </Button>
      <Link href="/alerts">
        <Button variant="ghost" size="icon" aria-label="Alerts">
          <Bell className="size-4" />
          {unread.data && unread.data > 0 ? (
            <Badge variant="destructive" className="absolute -mt-5 ml-3 h-4 px-1 text-[10px]">
              {unread.data}
            </Badge>
          ) : null}
        </Button>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <UserIcon className="size-4" />
            {session?.user?.name}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-xs">
            {session?.user?.email}
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Role: {session?.user?.roleName}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
