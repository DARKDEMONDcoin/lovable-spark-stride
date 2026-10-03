import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const referralCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,16}$/);

type ReferralAccount = {
  code: string;
  payout_method: "bank" | "paypal" | "wallet" | null;
  payout_destination: string | null;
};

type Attribution = {
  id: string;
  status: "signed_up" | "trial" | "active" | "cancelled" | "held";
  attributed_at: string;
  first_paid_at: string | null;
};

type Commission = {
  id: string;
  commission_amount_cents: number;
  commission_rate: number;
  currency: string;
  status: "pending" | "approved" | "reserved" | "paid" | "reversed" | "held";
  created_at: string;
  held_until: string;
};

function rateForActiveCustomers(active: number) {
  if (active >= 25) return 50;
  if (active >= 10) return 40;
  if (active >= 5) return 30;
  return 20;
}

async function getOrCreateAccount(admin: any, userId: string): Promise<ReferralAccount> {
  const { data: current, error: readError } = await admin
    .from("referral_accounts")
    .select("code,payout_method,payout_destination")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (current) return current as ReferralAccount;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = `SAHL${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const { data, error } = await admin
      .from("referral_accounts")
      .insert({ user_id: userId, code })
      .select("code,payout_method,payout_destination")
      .single();
    if (!error && data) return data as ReferralAccount;
    if (!error?.message.toLowerCase().includes("duplicate")) {
      throw new Error(error?.message ?? "تعذّر إنشاء رابط الإحالة.");
    }
  }
  throw new Error("تعذّر إنشاء رمز فريد. أعد المحاولة.");
}

export const getReferralDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const account = await getOrCreateAccount(supabaseAdmin, context.userId);
    const [clickResult, attributionResult, commissionResult, payoutResult] = await Promise.all([
      supabaseAdmin.from("referral_clicks").select("id", { count: "exact", head: true }).eq("code", account.code),
      supabaseAdmin.from("referral_attributions").select("id,status,attributed_at,first_paid_at").eq("referrer_user_id", context.userId).order("attributed_at", { ascending: false }).limit(50),
      supabaseAdmin.from("referral_commissions").select("id,commission_amount_cents,commission_rate,currency,status,created_at,held_until").eq("referrer_user_id", context.userId).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("referral_payout_requests").select("id,amount_cents,currency,status,requested_at").eq("user_id", context.userId).order("requested_at", { ascending: false }).limit(20),
    ]);
    if (clickResult.error || attributionResult.error || commissionResult.error || payoutResult.error) {
      throw new Error(clickResult.error?.message ?? attributionResult.error?.message ?? commissionResult.error?.message ?? payoutResult.error?.message ?? "تعذّر تحميل بيانات الإحالة.");
    }

    const attributions = (attributionResult.data ?? []) as Attribution[];
    const commissions = (commissionResult.data ?? []) as Commission[];
    const active = attributions.filter((row) => row.status === "active").length;
    const totals = commissions.reduce((sum, item) => {
      if (item.currency !== "USD" || item.status === "reversed") return sum;
      sum.earned += item.commission_amount_cents;
      if (item.status === "pending" || item.status === "held") sum.pending += item.commission_amount_cents;
      if (item.status === "approved") sum.available += item.commission_amount_cents;
      if (item.status === "paid") sum.paid += item.commission_amount_cents;
      if (item.status === "reserved") sum.reserved += item.commission_amount_cents;
      return sum;
    }, { earned: 0, pending: 0, available: 0, paid: 0, reserved: 0 });

    return {
      code: account.code,
      payoutMethod: account.payout_method,
      hasPayoutDestination: Boolean(account.payout_destination),
      clicks: clickResult.count ?? 0,
      signups: attributions.length,
      active,
      rate: rateForActiveCustomers(active),
      totals,
      referrals: attributions.map((row, index) => ({
        id: row.id,
        label: `إحالة ${String(attributions.length - index).padStart(2, "0")}`,
        status: row.status,
        attributedAt: row.attributed_at,
        firstPaidAt: row.first_paid_at,
      })),
      commissions,
      payouts: payoutResult.data ?? [],
    };
  });

export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: referralCodeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: referrer } = await supabaseAdmin.from("referral_accounts").select("user_id,code").eq("code", data.code).maybeSingle();
    if (!referrer || referrer.user_id === context.userId) return { accepted: false as const };

    const { data: authResult } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const createdAt = authResult.user?.created_at ? new Date(authResult.user.created_at).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > 24 * 60 * 60 * 1000) return { accepted: false as const };

    const { error } = await supabaseAdmin.from("referral_attributions").upsert({
      referrer_user_id: referrer.user_id,
      referred_user_id: context.userId,
      code: referrer.code,
      status: "signed_up",
    }, { onConflict: "referred_user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { accepted: true as const };
  });

export const requestReferralPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    method: z.enum(["bank", "paypal", "wallet"]),
    destination: z.string().trim().min(5).max(200),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: requestId, error } = await supabaseAdmin.rpc("request_referral_payout", {
      _user_id: context.userId,
      _method: data.method,
      _destination: data.destination,
    });
    if (error || !requestId) {
      const message = error?.message ?? "تعذّر إرسال طلب السحب.";
      if (message.includes("Minimum payout")) throw new Error("الحد الأدنى لطلب السحب هو ٥٠ دولاراً من الرصيد المتاح.");
      if (message.includes("already pending")) throw new Error("لديك طلب سحب قيد المراجعة بالفعل.");
      throw new Error(message);
    }
    return { ok: true as const, requestId };
  });
