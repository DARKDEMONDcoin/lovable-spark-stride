import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { recommendationInput, type WelcomeRecommendation } from "./welcome-recommendation.server";

const attempts = new Map<string, { count: number; expires: number }>();

export const getWelcomeRecommendation = createServerFn({ method: "POST" })
  .validator((input: unknown) => recommendationInput.parse(input))
  .handler(async ({ data }): Promise<WelcomeRecommendation> => {
    const { isRateLimited, requestIdentifier } = await import("./rate-limit.server");
    const id = requestIdentifier(getRequest());
    const now = Date.now();
    if (attempts.size > 5000) for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    const old = attempts.get(id);
    const count = old && old.expires > now ? old.count : 0;
    if (count >= 6) throw new Error("وصلت للحد المؤقت. يمكنك المتابعة ثم استكمال التفاصيل بعد التسجيل.");
    attempts.set(id, { count: count + 1, expires: old && old.expires > now ? old.expires : now + 3600_000 });
    if (await isRateLimited("welcome-recommendation", id, 6, 3600)) throw new Error("وصلت للحد المؤقت. يمكنك المتابعة ثم استكمال التفاصيل بعد التسجيل.");
    const { recommendWelcome } = await import("./welcome-recommendation.server");
    return recommendWelcome(data);
  });