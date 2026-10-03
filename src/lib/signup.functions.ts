import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { isRateLimited, requestIdentifier } from "./rate-limit.server";

const schema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8).max(72),
  fullName: z.string().min(3).max(80),
  company: z.string().min(2).max(80),
  dialect: z.string().min(2).max(20),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,16}$/).optional(),
});

/**
 * إنشاء الحساب على الخادم مباشرةً (بدون رسالة تأكيد) حتى لا يتوقف التسجيل
 * على حدود إرسال البريد، ثم يسجّل العميل الدخول بكلمة المرور نفسها.
 */
export const createAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    // حد استخدام: 5 محاولات إنشاء حساب لكل عنوان خلال 10 دقائق.
    if (await isRateLimited("signup", requestIdentifier(getRequest()), 5, 600)) {
      return { ok: false as const, reason: "rate_limited" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName.trim(),
        company: data.company.trim(),
        dialect: data.dialect,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      if (msg.includes("password")) return { ok: false as const, reason: "password" as const };
      console.error("[signup] createUser failed:", error.message);
      return { ok: false as const, reason: "unknown" as const };
    }

    if (created.user && data.referralCode) {
      const { data: referrer } = await supabaseAdmin.from("referral_accounts").select("user_id,code").eq("code", data.referralCode).maybeSingle();
      if (referrer && referrer.user_id !== created.user.id) {
        await supabaseAdmin.from("referral_attributions").insert({
          referrer_user_id: referrer.user_id,
          referred_user_id: created.user.id,
          code: referrer.code,
          status: "signed_up",
        });
      }
    }

    return { ok: true as const };
  });
