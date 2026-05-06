"use client";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Bell } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const { t, fmtDate } = useI18n();
  const list = trpc.alert.list.useQuery();
  const utils = trpc.useUtils();
  const mark = trpc.alert.markRead.useMutation({
    onSuccess: () => {
      utils.alert.list.invalidate();
      utils.alert.unreadCount.invalidate();
    },
  });

  const items = list.data ?? [];
  const variant = (s: string) =>
    s === "CRITICAL" ? "danger" : s === "WARNING" ? "warning" : "outline";

  return (
    <div className="px-4 sm:px-6 py-5 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {t("alerts")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.filter((a: any) => !a.isRead).length} unread
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              mark.mutate({ allUnread: true });
              toast.success(t("toastUpdated"));
            }}
          >
            <CheckCheck className="size-4 mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center mb-3">
              <Bell className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No alerts. You're all caught up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((a: any) => (
            <Card
              key={a._id}
              className={cn(
                "transition-opacity",
                a.isRead && "opacity-60",
                a.severity === "CRITICAL" && !a.isRead && "border-rose-300 dark:border-rose-900/60",
              )}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Badge variant={variant(a.severity) as any} className="shrink-0 mt-0.5">
                  {a.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{a.title}</p>
                  {a.body && (
                    <p className="text-xs text-muted-foreground mt-0.5">{a.body}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {fmtDate(a.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {!a.isRead && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => mark.mutate({ id: a._id })}
                    className="shrink-0"
                  >
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
