import { Badge } from "@/components/ui/badge";

const MAP: Record<string, "default" | "secondary" | "success" | "warning" | "danger" | "outline"> = {
  ACTIVE: "success",
  COMPLETED: "success",
  PAID: "success",
  DELIVERED: "success",
  REFINED: "success",
  PRESENT: "success",

  PENDING: "warning",
  PARTIAL: "warning",
  IN_PROGRESS: "warning",
  AT_REFINERY: "warning",
  IN_TRANSIT: "warning",
  DISPATCHING: "warning",
  CONFIRMED: "warning",
  ON_TRIP: "warning",
  HALF_DAY: "warning",

  EXPIRED: "danger",
  OVERDUE: "danger",
  CANCELLED: "danger",
  SUSPENDED: "danger",
  ABSENT: "danger",
  OUT_OF_SERVICE: "danger",

  DRAFT: "secondary",
  SCHEDULED: "secondary",
  AVAILABLE: "secondary",
  RENEWED: "secondary",
  LEAVE: "secondary",

  SENT: "default",
  EXITED: "outline",
};

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return <Badge variant={MAP[status] ?? "outline"}>{status.replaceAll("_", " ")}</Badge>;
}
