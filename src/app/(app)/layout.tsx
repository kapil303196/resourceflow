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
    <div className="min-h-dvh flex bg-muted/30">
      <DesktopSidebar permissions={session.user.permissions ?? []} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-4">{children}</main>
        <BottomNav />
        <QuickActionsFab permissions={session.user.permissions ?? []} />
      </div>
    </div>
  );
}
