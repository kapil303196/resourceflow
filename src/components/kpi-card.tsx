import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: { delta: number; direction: "up" | "down" | "flat" };
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-semibold">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        {trend && (
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1 text-xs font-medium",
              trend.direction === "up" && "text-emerald-600",
              trend.direction === "down" && "text-rose-600",
              trend.direction === "flat" && "text-muted-foreground",
            )}
          >
            {trend.direction === "up" && <TrendingUp className="size-3" />}
            {trend.direction === "down" && <TrendingDown className="size-3" />}
            {(trend.delta * 100).toFixed(1)}% vs last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
