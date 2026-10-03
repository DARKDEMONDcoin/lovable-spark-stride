/**
 * دوال الخادم لتنفيذ إجراءات الموظفين الحقيقية بعد اعتماد المالك.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { actionsFor } from "./employee-actions.server";

async function assertOwner(
  supabase: {
    rpc: (
      fn: "owns_workspace",
      args: { _workspace_id: string },
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  workspaceId: string,
) {
  const { data, error } = await supabase.rpc("owns_workspace", { _workspace_id: workspaceId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: لا تملك هذه مساحة العمل.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertWorkspaceAccess(
  supabase: {
    from: (table: "workspaces" | "workspace_members") => any;
  },
  workspaceId: string,
  userId: string,
) {
  const { data: owned } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!owned) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("ليس لديك وصول لهذه المساحة.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** قائمة الإجراءات المتاحة لموظف معيّن. */
export const listEmployeeActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ employeeId: z.string().min(2).max(20) }).parse(input),
  )
  .handler(({ data }) =>
    actionsFor(data.employeeId).map((a) => ({
      id: a.id,
      provider: a.provider,
      label: a.label,
      inputs: a.inputs,
    })),
  );

/** لقطة معاينة حية لصفحة النموذج قبل اعتماد إجراء المتصفح. */
export const previewBrowserAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), url: z.string().url().max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const { browsePage, browseFailureReason } = await import("./cloud-browser.server");
    const page = await browsePage(data.url, { screenshot: true });
    return {
      title: page?.title ?? null,
      screenshotUrl: page?.screenshotUrl ?? null,
      error: page ? null : browseFailureReason(data.url),
    };
  });

/** تنفيذ إجراء فعلي (إرسال بريد، حجز موعد، تحديث CRM…). */
export const runEmployeeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        actionId: z.string().min(3).max(60),
        values: z.record(z.string(), z.string()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { runEmployeeActionServer } = await import("./employee-actions.server");
    const res = await runEmployeeActionServer(admin, {
      workspaceId: data.workspaceId,
      actionId: data.actionId,
      values: data.values,
    });
    // نعيد نتيجة JSON آمنة للتسلسل (الموظفون قد يعيدون كائنات منصات خام).
    const safe = JSON.parse(JSON.stringify(res.result ?? null)) as Json;
    const browserResult = res.provider === "browser" && safe && typeof safe === "object"
      ? (safe as { verification?: string })
      : null;
    return {
      actionId: res.actionId,
      provider: res.provider,
      ok:
        res.provider !== "browser" ||
        browserResult?.verification === undefined ||
        browserResult.verification === "verified",
      result: safe,
    };
  });

/** مهمة تصفح متعددة الخطوات (قراءة وتنقل وبحث) — تتوقف عند أي خطوة حساسة. */
export const runBrowserTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        employeeId: z.string().min(2).max(20).optional(),
        goal: z.string().trim().min(5).max(1500),
        startUrl: z.string().url().max(2000).optional(),
        resumeSessionId: z.string().max(100).optional(),
        maxSteps: z.number().int().min(1).max(15).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertWorkspaceAccess(context.supabase, data.workspaceId, context.userId);
    const { enforceEmployeePolicy, recordAudit } = await import("./employee-policy.server");
    const employeeId = data.employeeId ?? "eva";
    await enforceEmployeePolicy(admin, data.workspaceId, employeeId, `${employeeId}-browser-task`);
    const { runBrowserAgent } = await import("./browser-agent.server");
    const { getMember } = await import("@/data/team");
    const employee = getMember(employeeId);
    const r = await runBrowserAgent({
      ...data,
      goal: employee
        ? `نفّذ بصفتك ${employee.name} (${employee.role}) وركّز على ما يخدم اختصاصك. المطلوب: ${data.goal}`
        : data.goal,
    });
    await recordAudit(admin, {
      workspaceId: data.workspaceId,
      employeeId,
      actionId: `${employeeId}-browser-task`,
      provider: "browser",
      status: r.status === "done" ? "done" : r.status === "error" ? "failed" : "blocked",
      values: { title: data.goal.slice(0, 120), url: data.startUrl ?? "" },
    });
    return JSON.parse(JSON.stringify(r)) as typeof r;
  });

/** جولة مقارنة بين 2–5 مواقع بجدول ومصادر. */
export const compareSitesTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        employeeId: z.string().min(2).max(20).optional(),
        goal: z.string().trim().min(5).max(1000),
        urls: z.array(z.string().url().max(2000)).min(2).max(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertWorkspaceAccess(context.supabase, data.workspaceId, context.userId);
    const { compareSites } = await import("./browser-agent.server");
    const { getMember } = await import("@/data/team");
    const employee = data.employeeId ? getMember(data.employeeId) : null;
    return compareSites({
      goal: employee
        ? `قارن بصفتك ${employee.name} (${employee.role}) وركّز على ما يخدم اختصاصك. المطلوب: ${data.goal}`
        : data.goal,
      urls: data.urls,
    });
  });

/** تعديل قيم إجراء جاهز بأمر نصي من المالك داخل الشات («خلّي الرد أقصر»، «غيّر الموعد لبكرة»…). */
export const reviseEmployeeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        employeeId: z.string().min(2).max(20),
        label: z.string().max(200),
        inputs: z
          .array(z.object({ name: z.string().max(60), label: z.string().max(120) }))
          .max(30),
        values: z.record(z.string(), z.string().max(20_000)),
        instruction: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const { freeChat } = await import("./nour-research.server");
    const fields = data.inputs.map((i) => `- ${i.name} (${i.label})`).join("\n");
    const raw = await freeChat(
      data.employeeId,
      [
        {
          role: "system",
          content: [
            `أنت تعدّل مسودة إجراء «${data.label}» حسب تعليمات صاحب العمل حرفياً.`,
            "عدّل فقط ما طُلب، واحتفظ بباقي القيم كما هي، وحافظ على اللغة واللهجة الأصلية ما لم يُطلب غير ذلك.",
            "أعد JSON فقط بالشكل: {\"values\": {...كل الحقول...}, \"summary\": \"جملة قصيرة بالعربية تصف ما عدّلته\"}",
            `الحقول المتاحة:\n${fields}`,
          ].join("\n"),
        },
        {
          role: "user",
          content: `القيم الحالية:\n${JSON.stringify(data.values, null, 2)}\n\nالتعليمات: ${data.instruction}`,
        },
      ],
      { maxTokens: 2000, timeoutMs: 45_000 },
    );
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: { values?: Record<string, unknown>; summary?: unknown } = {};
    try {
      parsed = match ? JSON.parse(match[0]) : {};
    } catch {
      parsed = {};
    }
    if (!parsed.values || typeof parsed.values !== "object")
      throw new Error("لم أستطع تطبيق التعديل، جرّب صياغة أوضح.");
    const allowed = new Set(data.inputs.map((i) => i.name));
    const next: Record<string, string> = { ...data.values };
    for (const [k, v] of Object.entries(parsed.values)) {
      if (allowed.has(k) && typeof v === "string") next[k] = v;
    }
    return {
      values: next,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 300) : "طبّقت التعديل.",
    };
  });
