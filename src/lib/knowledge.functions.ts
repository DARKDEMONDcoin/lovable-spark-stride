import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ws = z.object({ workspaceId: z.string().uuid() });

export const listKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ws.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("knowledge_chunks")
      .select("source, title, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const map = new Map<string, { source: string; title: string; chunks: number; createdAt: string }>();
    for (const r of rows ?? []) {
      const cur = map.get(r.source);
      if (cur) cur.chunks++;
      else map.set(r.source, { source: r.source, title: r.title ?? r.source, chunks: 1, createdAt: r.created_at });
    }
    return [...map.values()];
  });

export const addKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    ws
      .extend({
        url: z.string().url().max(500).optional(),
        title: z.string().max(200).optional(),
        text: z.string().max(300_000).optional(),
      })
      .refine((v) => v.url || (v.text && v.text.trim().length > 20), "أضف رابطاً أو نصاً")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ingestKnowledge, fetchPageText } = await import("./knowledge.server");
    let title = data.title?.trim() || "";
    let text = data.text ?? "";
    let source = "";
    if (data.url) {
      if (!/^https?:\/\//i.test(data.url)) throw new Error("رابط غير صالح.");
      const page = await fetchPageText(data.url);
      title ||= page.title;
      text = page.text;
      source = data.url;
    } else {
      title ||= text.trim().split("\n")[0]!.slice(0, 80);
      source = `text:${title}`;
    }
    const chunks = await ingestKnowledge(context.supabase as never, { workspaceId: data.workspaceId, source, title, text });
    return { chunks, title };
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ws.extend({ source: z.string().max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("knowledge_chunks")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("source", data.source);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
