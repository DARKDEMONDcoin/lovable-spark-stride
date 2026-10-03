import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** تنبيهات صحة الربط: توكن Meta قارب الانتهاء أو انتهى أو به خطأ — قبل أن يفشل النشر. */
export const getConnectionHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("meta_connections")
      .select("kind, page_name, ig_username, status, token_expires_at, last_error")
      .eq("workspace_id", data.workspaceId);
    const now = Date.now();
    const alerts: { level: "error" | "warn"; text: string }[] = [];
    for (const r of rows ?? []) {
      const name = r.ig_username ? `@${r.ig_username}` : (r.page_name ?? "صفحة ميتا");
      const exp = r.token_expires_at ? new Date(r.token_expires_at).getTime() : null;
      if (r.status !== "connected") {
        alerts.push({ level: "error", text: `ربط ${name} متوقف${r.last_error ? `: ${r.last_error.slice(0, 120)}` : ""} — أعد الربط حتى لا يفشل النشر.` });
      } else if (exp && exp < now) {
        alerts.push({ level: "error", text: `انتهت صلاحية ربط ${name} — أعد الربط الآن.` });
      } else if (exp && exp - now < 7 * 86_400_000) {
        const days = Math.max(1, Math.round((exp - now) / 86_400_000));
        alerts.push({ level: "warn", text: `ربط ${name} ينتهي خلال ${days} يوم — جدّده الآن لتجنب توقف النشر.` });
      }
    }
    return alerts;
  });
