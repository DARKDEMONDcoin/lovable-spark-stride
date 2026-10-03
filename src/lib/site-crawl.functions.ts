import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runSiteCrawl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!/^https?:\/\//i.test(data.url)) throw new Error("رابط غير صالح.");
    const host = new URL(data.url).hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(host)) throw new Error("لا يمكن فحص عناوين داخلية.");
    const { isRateLimited } = await import("./rate-limit.server");
    if (await isRateLimited("site-crawl", context.userId, 6, 3600)) throw new Error("وصلت للحد: 6 فحوصات في الساعة.");
    const { crawlSite } = await import("./site-crawl.server");
    return crawlSite(data.url, 300);
  });
