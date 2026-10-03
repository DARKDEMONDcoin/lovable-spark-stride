import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { WelcomePreview } from "./welcome-preview.server";

// Local defense in depth when the shared limiter is temporarily unavailable.
const attempts = new Map<string, { count: number; expires: number }>();
const LIMIT = 8;
const LIMIT_MSG = "جرّبت الفحص عدة مرات خلال ساعة. تابع الآن وسنحلل موقعك بعمق بعد التسجيل.";

export const getWelcomePreview = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ url: z.string().trim().min(4).max(300) }).parse(input))
  .handler(async ({ data }): Promise<WelcomePreview> => {
    const { publicWebsiteUrl } = await import("./welcome-preview.server");
    const target = publicWebsiteUrl(data.url);
    if (!target) throw new Error("أدخل رابط موقع عام صالح، مثل example.com");
    const { analyzeWebsite, cachedAnalysis } = await import("./welcome-understand.server");
    // Already analysed recently: instant and does not count against the visitor.
    const cached = cachedAnalysis(target.hostname.replace(/^www\./, ""));
    if (cached) return cached;
    const { isRateLimited, requestIdentifier } = await import("./rate-limit.server");
    const id = requestIdentifier(getRequest());
    const now = Date.now();
    const entry = attempts.get(id);
    if (attempts.size > 5000) for (const [k, v] of attempts) if (v.expires < now) attempts.delete(k);
    if (entry && entry.expires > now && entry.count >= LIMIT) throw new Error(LIMIT_MSG);
    attempts.set(id, { count: (entry && entry.expires > now ? entry.count : 0) + 1, expires: entry && entry.expires > now ? entry.expires : now + 3600_000 });
    if (await isRateLimited("welcome-preview", id, LIMIT, 3600)) throw new Error(LIMIT_MSG);
    return analyzeWebsite(target.toString());
  });
