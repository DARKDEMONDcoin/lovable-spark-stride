import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const MAX_BYTES = 14 * 1024 * 1024;

/**
 * تحويل صوت المستخدم إلى نص داخل مربع الإدخال — يبثّ النص أثناء التفريغ (SSE).
 * يتطلب جلسة مستخدم صالحة.
 */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Not configured", { status: 500 });
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token || token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: claims, error } = await supabase.auth.getClaims(token);
        if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "طلب غير صالح." }, { status: 400 });
        }
        const file = form.get("file");
        if (!(file instanceof File) || file.size < 800) {
          return Response.json({ error: "التسجيل قصير جداً — اتكلم شوية أطول." }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: "التسجيل طويل جداً — قسّمه لأجزاء أقصر." }, { status: 413 });
        }

        const { getSecret } = await import("@/lib/secrets.server");
        const apiKey = await getSecret("LOVABLE_API_KEY");
        if (!apiKey) return Response.json({ error: "خدمة تحويل الصوت غير مهيّأة." }, { status: 500 });

        const mime = (file.type || "audio/webm").replace(/^video\//, "audio/").split(";")[0]!;
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
        const upstreamForm = new FormData();
        upstreamForm.append("model", "google/gemini-3.5-transcribe");
        upstreamForm.append("file", new File([await file.arrayBuffer()], `voice.${ext}`, { type: mime }));
        upstreamForm.append("stream", "true");

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstreamForm,
          signal: request.signal,
        });
        if (!upstream.ok || !upstream.body) {
          const body = await upstream.text().catch(() => "");
          console.error(`[transcribe] failed [${upstream.status}]: ${body.slice(0, 300)}`);
          const message =
            upstream.status === 402
              ? "رصيد الذكاء الاصطناعي خلص — اشحن الرصيد وجرب تاني."
              : upstream.status === 429
                ? "ضغط كبير دلوقتي — جرب تاني بعد لحظات."
                : upstream.status === 400
                  ? "ماقدرتش أسمع التسجيل — جرب تاني بصوت أوضح."
                  : "تعذّر تحويل الصوت لنص — جرب تاني.";
          return Response.json({ error: message }, { status: upstream.status === 429 || upstream.status === 402 ? upstream.status : 502 });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
