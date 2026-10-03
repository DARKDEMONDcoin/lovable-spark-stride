/**
 * نشر مخرج (مهمة) فعلياً من تيليجرام على منصة مربوطة — نفس طابور النشر في الموقع.
 * الضغط على زر المنصة هو موافقة المالك الصريحة.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { providerLabel } from "./platforms";
import { adaptForProvider, extractPostMedia } from "./post-format";

type Admin = SupabaseClient<Database>;

export async function publishTaskNow(admin: Admin, workspaceId: string, taskId: string, target: string): Promise<string> {
  const { data: t } = await admin
    .from("tasks")
    .select("id, output, employee_id")
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!t?.output) return "المنشور ده مش موجود.";
  const { connectedProviders } = await import("./command-core.server");
  const connected = await connectedProviders(admin, workspaceId);
  const providers = target === "all" ? connected : connected.filter((p) => p === target);
  if (!providers.length) return `${providerLabel(target)} مش مربوطة — اربطها من 🔌 التكاملات.`;
  const { text, images } = extractPostMedia(t.output);
  const { publishQueuedPost } = await import("./social-queue.server");
  const lines: string[] = [];
  let ok = false;
  for (const provider of providers) {
    try {
      const now = new Date().toISOString();
      const { data: row, error } = await admin
        .from("social_posts")
        .insert({
          workspace_id: workspaceId,
          employee_id: t.employee_id || "sonny",
          provider,
          body: adaptForProvider(provider, text),
          image_url: images[0]?.url ?? null,
          scheduled_at: now,
          status: "scheduled",
          locked_at: now,
          meta: { source: "telegram", task_id: t.id },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const r = await publishQueuedPost(admin, row.id);
      if (r.status === "published") {
        ok = true;
        lines.push(`✅ ${providerLabel(provider)} — اتنشر`);
      } else lines.push(`⚠️ ${providerLabel(provider)} — ${r.error ?? "تعذّر النشر"}`);
    } catch (e) {
      lines.push(`⚠️ ${providerLabel(provider)} — ${e instanceof Error ? e.message : "تعذّر النشر"}`);
    }
  }
  if (ok) await admin.from("tasks").update({ status: "done" }).eq("id", t.id);
  return lines.join("\n");
}

const PUBLISH_REF = /(انشر|أنشر|نشر|انزل|نزّل|نزل|ارفع|بوست)(ه|ها|هو|ة)?\b|عايز\s*انشر|عاوز\s*انشر/;
const NEW_CONTENT = /(اكتب|اعمل|جهّز|جهز|صمم|منشور\s+(جديد|عن)|بوست\s+(جديد|عن))/;

/** «انشره على فيسبوك» / «عايز انشره» بعد مخرج جاهز = نشر المخرج نفسه لا كتابة جديد. */
export function isPublishPrevious(text: string): boolean {
  const t = text.trim();
  return t.length <= 160 && PUBLISH_REF.test(t) && !NEW_CONTENT.test(t);
}
