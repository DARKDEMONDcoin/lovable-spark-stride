import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { isRateLimited, requestIdentifier } from "@/lib/rate-limit.server";

const input = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,16}$/),
  path: z.string().max(200).default("/"),
});

export const Route = createFileRoute("/api/public/referral-click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const identifier = requestIdentifier(request);
        if (await isRateLimited("referral-click", identifier, 30, 3600)) return Response.json({ ok: false }, { status: 429 });
        const parsed = input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: account } = await supabaseAdmin.from("referral_accounts").select("code").eq("code", parsed.data.code).maybeSingle();
        if (!account) return Response.json({ ok: false }, { status: 404 });
        const day = new Date().toISOString().slice(0, 10);
        const visitorHash = createHash("sha256").update(`${identifier}:${parsed.data.code}:${day}`).digest("hex");
        const { data: existing } = await supabaseAdmin.from("referral_clicks").select("id").eq("code", parsed.data.code).eq("visitor_hash", visitorHash).gte("created_at", `${day}T00:00:00.000Z`).limit(1).maybeSingle();
        if (!existing) await supabaseAdmin.from("referral_clicks").insert({ code: parsed.data.code, visitor_hash: visitorHash, landing_path: parsed.data.path });
        return Response.json({ ok: true });
      },
    },
  },
});
