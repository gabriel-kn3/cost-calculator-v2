/**
 * Backend status pill. Same 60s cadence and states as v2's AppHeader, but
 * driven by React Query instead of a bespoke polling hook, and the states are
 * derived from HTTP status rather than string-matching an error message
 * (v2 did `msg.includes("401")`, which broke the moment wording changed).
 */
import { useHealth, useMe } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Status = "ok" | "expired" | "degraded" | "down" | "checking";

export function HealthPill({ compact = false }: { compact?: boolean }) {
  const health = useHealth();
  const me = useMe();

  let status: Status = "checking";
  if (health.isError) status = "down";
  else if (health.data) {
    if (me.isError && me.error instanceof ApiError && me.error.status === 401) status = "expired";
    else if (health.data.status !== "ok") status = "degraded";
    else status = "ok";
  }

  const label = {
    ok: "Online",
    expired: "Session expired",
    degraded: "Degraded",
    down: "Offline",
    checking: "Checking",
  }[status];

  const dot = {
    ok: "bg-success",
    expired: "bg-warning",
    degraded: "bg-warning",
    down: "bg-destructive",
    checking: "bg-muted-foreground",
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs",
        compact ? "text-sidebar-foreground border-sidebar-border" : "text-muted-foreground",
      )}
      title={health.data ? `${health.data.db} · ${health.data.latencyMs}ms` : label}
    >
      <span className={cn("size-2 rounded-full", dot, status === "checking" && "animate-pulse")} />
      {compact ? null : label}
    </span>
  );
}
