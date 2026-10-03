import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { getConnectionHealth } from "@/lib/health.functions";
import { cn } from "@/lib/utils";

export function ConnectionHealthBanner({ workspaceId }: { workspaceId: string }) {
  const fn = useServerFn(getConnectionHealth);
  const { data = [] } = useQuery({
    queryKey: ["connection-health", workspaceId],
    queryFn: () => fn({ data: { workspaceId } }),
    staleTime: 5 * 60_000,
  });
  if (!data.length) return null;
  return (
    <div className="space-y-2">
      {data.map((a, i) => (
        <Link
          key={i}
          to="/app/integrations"
          className={cn(
            "flex items-start gap-2 rounded-2xl border p-3 text-sm font-semibold",
            a.level === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/5 text-foreground",
          )}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{a.text}</span>
        </Link>
      ))}
    </div>
  );
}
