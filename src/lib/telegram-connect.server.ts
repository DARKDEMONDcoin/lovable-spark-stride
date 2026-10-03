/**
 * ربط المنصات اليدوية (اللي محتاجة رابط/مفتاح) من داخل تيليجرام نفسه — بدون
 * أي تحويل للموقع. نجمع الحقول واحد واحد في المحادثة، نتحقق من صحتها فعلياً
 * مقابل المنصة، ثم نخزّنها مشفّرة في نفس جدول الموقع (integration_credentials).
 */
import { providerLabel } from "./platforms";
import { esc, show, writePending, type UiCtx } from "./telegram-ui.server";

type Field = { key: string; label: string; hint: string };

export const MANUAL_PROVIDERS: Record<string, { fields: Field[] }> = {
  wordpress: {
    fields: [
      { key: "siteUrl", label: "رابط موقعك", hint: "مثال: https://mysite.com" },
      { key: "username", label: "اسم المستخدم في ووردبريس", hint: "نفس اسم الدخول للوحة ووردبريس" },
      {
        key: "appPassword",
        label: "كلمة مرور التطبيق",
        hint: "من ووردبريس: المستخدمون ← ملفي ← Application Passwords ← أنشئ واحدة والصقها هنا",
      },
    ],
  },
};

const back = (to = "i") => [
  [{ text: "⬅️ رجوع", callback_data: to }, { text: "🏠 القائمة", callback_data: "m" }],
];

function normalizeSite(input: string): string {
  const raw = input.trim().replace(/\/+$/, "");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:") throw new Error("الرابط لازم يبدأ بـ https.");
  if (url.username || url.password) throw new Error("الرابط مينفعش يحتوي اسم مستخدم أو كلمة سر.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || /^(10|127|0|192\.168|169\.254)\./.test(host)) {
    throw new Error("استخدم نطاق موقعك العام مش عنوان داخلي.");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** يبدأ إدخال بيانات الربط في المحادثة. */
export async function startManualConnect(ctx: UiCtx, provider: string) {
  const spec = MANUAL_PROVIDERS[provider];
  if (!spec) {
    return void (await show(
      ctx,
      [
        `<b>🔗 ربط ${esc(providerLabel(provider))}</b>`,
        "المنصة دي بتتربط بالربط الآمن بضغطة. لو الربط مكتمل اضغط «تحديث الحالة» ونشوفها هنا فوراً.",
      ].join("\n"),
      [[{ text: "🔄 تحديث الحالة", callback_data: "is" }], ...back()],
    ));
  }
  await askField(ctx, provider, spec.fields[0]!.key, {});
}

async function askField(ctx: UiCtx, provider: string, field: string, data: Record<string, string>) {
  const spec = MANUAL_PROVIDERS[provider]!;
  const f = spec.fields.find((x) => x.key === field)!;
  const step = spec.fields.findIndex((x) => x.key === field) + 1;
  await writePending(ctx.admin, ctx.link, { wait: { kind: "cred_field", id: provider, field, data } });
  await show(
    ctx,
    [
      `<b>🔗 ربط ${esc(providerLabel(provider))} — خطوة ${step}/${spec.fields.length}</b>`,
      `اكتب <b>${esc(f.label)}</b> في رسالة:`,
      `ℹ️ ${esc(f.hint)}`,
      "",
      "بياناتك بتتخزن مشفّرة على السيرفر ومحدش يشوفها.",
    ].join("\n"),
    back(),
  );
}

/** يستقبل قيمة كتبها المالك: ينتقل للحقل التالي أو يتحقق ويحفظ الربط. */
export async function handleCredText(
  ctx: UiCtx,
  provider: string,
  field: string,
  prev: Record<string, string>,
  text: string,
): Promise<void> {
  const spec = MANUAL_PROVIDERS[provider];
  if (!spec) return;
  const data = { ...prev, [field]: text.trim() };
  const idx = spec.fields.findIndex((x) => x.key === field);
  const next = spec.fields[idx + 1];
  if (next) return void (await askField(ctx, provider, next.key, data));

  await writePending(ctx.admin, ctx.link, { wait: null });
  await show(ctx, "⏳ بتحقق من بيانات الربط دلوقتي…", []);
  try {
    const account = await verifyAndSave(ctx, provider, data);
    await show(
      ctx,
      [`✅ <b>${esc(providerLabel(provider))} اتربط بنجاح.</b>`, `الحساب: <b>${esc(account)}</b>`, "الفريق بقى يقدر ينشر عليه فعلاً."].join("\n"),
      [[{ text: "🔌 التكاملات", callback_data: "i" }], ...back()],
    );
  } catch (e) {
    await show(
      ctx,
      [`⚠️ <b>الربط مانجحش</b>`, esc(e instanceof Error ? e.message : "تعذّر التحقق من البيانات"), "", "جرب تاني بالبيانات الصحيحة."].join("\n"),
      [[{ text: "🔁 جرب تاني", callback_data: `ic:${provider}` }], ...back()],
    );
  }
}

async function verifyAndSave(ctx: UiCtx, provider: string, data: Record<string, string>): Promise<string> {
  if (provider !== "wordpress") throw new Error("المنصة دي مش مدعومة للربط اليدوي.");
  const config = {
    siteUrl: normalizeSite(data["siteUrl"] ?? ""),
    username: (data["username"] ?? "").trim(),
    appPassword: (data["appPassword"] ?? "").replace(/\s+/g, ""),
  };
  if (!config.username || config.appPassword.length < 8) throw new Error("اسم المستخدم أو كلمة مرور التطبيق ناقصة.");
  const res = await fetch(`${config.siteUrl}/wp-json/wp/v2/users/me?context=edit`, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Basic ${btoa(`${config.username}:${config.appPassword}`)}`,
      Accept: "application/json",
    },
  });
  const body = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("اسم المستخدم أو كلمة مرور التطبيق غير صحيحة.");
    if (res.status === 404) throw new Error("ملقيناش واجهة ووردبريس على الرابط ده — فعّل الروابط الدائمة وتأكد من الرابط.");
    throw new Error(`الموقع رفض الطلب (${res.status}).`);
  }
  let me: { name?: string; capabilities?: Record<string, boolean> };
  try {
    me = JSON.parse(body) as typeof me;
  } catch {
    throw new Error("الرد مش من موقع ووردبريس — راجع الرابط.");
  }
  if (me.capabilities && me.capabilities["publish_posts"] !== true) {
    throw new Error("المستخدم ده معندوش صلاحية نشر المقالات.");
  }
  const account = `${new URL(config.siteUrl).host} · ${me.name ?? config.username}`;
  const { sealConfig } = await import("./credential-crypto.server");
  await ctx.admin.from("integration_credentials").upsert(
    {
      workspace_id: ctx.link.workspace_id,
      provider,
      config: await sealConfig(config as unknown as Record<string, unknown>),
    } as never,
    { onConflict: "workspace_id,provider" },
  );
  await ctx.admin
    .from("integrations")
    .update({ status: "connected", account })
    .eq("workspace_id", ctx.link.workspace_id)
    .eq("provider", provider);
  return account;
}
