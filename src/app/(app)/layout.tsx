import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DesktopSidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { QuickActionsFab } from "@/components/quick-actions-fab";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    // h-dvh (not min-h) anchors the layout to viewport height, so only the
    // <main> column scrolls and the sidebar stays pinned.
    <div className="h-dvh flex bg-muted/30 overflow-hidden">
      <DesktopSidebar permissions={session.user.permissions ?? []} />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-4">{children}</main>
        <BottomNav />
        <QuickActionsFab permissions={session.user.permissions ?? []} />
      </div>
    </div>
  );
}
