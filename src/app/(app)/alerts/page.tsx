"use client";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AlertsPage() {
  const list = trpc.alert.list.useQuery();
  const mark = trpc.alert.markRead.useMutation({
    onSuccess: () => list.refetch(),
  });
  const variant = (s: string) =>
    s === "CRITICAL" ? "danger" : s === "WARNING" ? "warning" : "outline";
  return (
    <div className="p-6">
      <PageHeader
        title="Alerts"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              mark.mutate({ allUnread: true });
              toast.success("Marked all as read");
            }}
          >
            Mark all read
          </Button>
        }
      />
      <div className="space-y-2">
        {(list.data ?? []).map((a: any) => (
          <Card key={a._id} className={a.isRead ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-start gap-3">
              <Badge variant={variant(a.severity) as any}>{a.severity}</Badge>
              <div className="flex-1">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(a.createdAt), "PP p")}
                </p>
              </div>
              {!a.isRead && (
                <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: a._id })}>
                  Mark read
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!list.data?.length && (
          <p className="text-sm text-muted-foreground text-center py-12">No alerts.</p>
        )}
      </div>
    </div>
  );
}
