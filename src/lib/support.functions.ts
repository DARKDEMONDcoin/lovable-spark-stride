import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workspace = z.string().uuid().nullable().optional();

export const submitProductFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    workspaceId: workspace,
    kind: z.enum(["idea", "improvement", "issue", "praise"]),
    rating: z.number().int().min(1).max(5),
    message: z.string().trim().min(10).max(4000),
    pagePath: z.string().trim().max(500).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("product_feedback").insert({
      user_id: context.userId, workspace_id: data.workspaceId ?? null, kind: data.kind,
      rating: data.rating, message: data.message, page_path: data.pagePath || null,
    });
    if (error) throw new Error("تعذّر إرسال ملاحظتك الآن. حاول مرة أخرى.");
    return { ok: true as const };
  });

export const submitSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    workspaceId: workspace,
    subject: z.string().trim().min(3).max(140),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    message: z.string().trim().min(10).max(5000),
    pagePath: z.string().trim().max(500).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("support_requests").insert({
      user_id: context.userId, workspace_id: data.workspaceId ?? null, subject: data.subject,
      priority: data.priority, message: data.message, page_path: data.pagePath || null,
    }).select("id").single();
    if (error || !row) throw new Error("تعذّر فتح طلب الدعم الآن. حاول مرة أخرى.");
    return { ok: true as const, reference: row.id.slice(0, 8).toUpperCase() };
  });