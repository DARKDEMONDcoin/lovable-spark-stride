import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { askEmployeeInput, runEmployeeTurn, type TurnEvent } from "@/lib/ai.functions";

/** مفاتيح Supabase الحديثة نصوص مبهمة لا JWT — تُرسل في apikey فقط. */
function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (
      (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * بثّ حقيقي لتنفيذ طلب الموظف: مراحل العمل الفعلية + نص الرد وهو يُكتب.
 * نفس منطق askEmployee تماماً — لا تكرار ولا اختلاف في النتيجة النهائية.
 */
export const Route = createFileRoute("/api/employee-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Supabase not configured", { status: 500 });

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token || token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient<Database>(url, key, {
          global: { fetch: supabaseFetch(key), headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const parsed = askEmployeeInput.safeParse(payload);
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        // Shared team chat: owners run as themselves; verified members run through the
        // privileged client scoped to this workspace only, so the employee keeps full brand context.
        const userId = claims.claims.sub as string;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("owner_id")
          .eq("id", parsed.data.workspaceId)
          .maybeSingle();
        if (!ws) return new Response("Not found", { status: 404 });
        let turnClient = supabase;
        if (ws.owner_id !== userId) {
          const { data: membership } = await supabaseAdmin
            .from("workspace_members")
            .select("user_id")
            .eq("workspace_id", parsed.data.workspaceId)
            .eq("user_id", userId)
            .maybeSingle();
          if (!membership) return new Response("Forbidden", { status: 403 });
          turnClient = supabaseAdmin;
        }
        const { data: senderProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        const sender = { senderId: userId, senderName: senderProfile?.full_name?.trim() || "عضو الفريق" };

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            const send = (event: Record<string, unknown>) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                closed = true;
              }
            };
            void (async () => {
              try {
                const startedAt = new Date(Date.now() - 2_000).toISOString();
                const result = await runEmployeeTurn(
                  parsed.data,
                  { supabase: turnClient, ...sender },
                  (event: TurnEvent) => send(event),
                );
                send({ type: "done", result });
                // نفس الرد يصل لتيليجرام المربوط — الموقع والبوت محادثة واحدة.
                try {
                  const { mirrorSiteTurn } = await import("@/lib/telegram-deliver.server");
                  await mirrorSiteTurn({
                    workspaceId: parsed.data.workspaceId,
                    employeeId: parsed.data.employeeId,
                    conversationId: parsed.data.conversationId,
                    message: parsed.data.message,
                    startedAt,
                    result: result as never,
                  });
                } catch (e) {
                  console.error("[telegram] mirror skipped:", e);
                }
              } catch (error) {
                send({
                  type: "error",
                  message: error instanceof Error ? error.message : "تعذّر إتمام الطلب",
                });
              } finally {
                closed = true;
                try {
                  controller.close();
                } catch {
                  /* أُغلق مسبقاً */
                }
              }
            })();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
