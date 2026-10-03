/**
 * حلقة الأداء: يقرأ تفاعل المنشورات المنشورة فعلاً (المخزّن في social_posts.metrics)
 * ويعطي سِراج «ما نجح وما لم ينجح» ليتعلم منه في المنشور التالي.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function rankPosts(rows: { body: string; provider: string; metrics: unknown }[]) {
  const scored = rows
    .map((r) => ({
      body: r.body,
      provider: r.provider,
      score: Number((r.metrics as { engagement?: unknown } | null)?.engagement),
    }))
    .filter((r) => Number.isFinite(r.score));
  if (scored.length < 4) return null;
  scored.sort((a, b) => b.score - a.score);
  return { best: scored.slice(0, 3), worst: scored.slice(-2).reverse() };
}

export async function performanceContext(db: SupabaseClient, workspaceId: string): Promise<string> {
  try {
    const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
    const { data } = await db
      .from("social_posts")
      .select("body, provider, metrics")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .gte("published_at", since)
      .not("metrics", "is", null)
      .order("published_at", { ascending: false })
      .limit(60);
    const ranked = rankPosts((data ?? []) as never);
    if (!ranked) return "";
    const fmt = (p: { body: string; provider: string; score: number }) =>
      `- (${p.provider}، تفاعل ${p.score}) ${p.body.replace(/\s+/g, " ").slice(0, 220)}`;
    return `أداء منشورات العميل الفعلي (تعلّم منه: كرّر أسلوب الأعلى تفاعلاً وتجنّب نمط الأضعف، دون نسخ النص):\nالأعلى تفاعلاً:\n${ranked.best.map(fmt).join("\n")}\nالأضعف:\n${ranked.worst.map(fmt).join("\n")}`;
  } catch {
    return "";
  }
}
