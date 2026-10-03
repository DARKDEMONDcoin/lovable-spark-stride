/**
 * بطاقة «اعتماد إجراء حقيقي» داخل المحادثة.
 * الموظف يجهّز الإجراء بقيمه كاملة على تكامله المربوط (بريد، موعد، صفقة، رسالة…)
 * والمالك يعتمده بضغطة واحدة — أو يعدّل أي حقل قبل التنفيذ.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { previewBrowserAction, runEmployeeAction } from "@/lib/employee-actions.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PendingAction = {
  id: string;
  provider: string;
  label: string;
  inputs: { name: string; label: string; required?: boolean }[];
  values: Record<string, string>;
};

function executeLabel(action: PendingAction): string {
  if (/email|mail|outlook|gmail|message|reply|send/i.test(`${action.id} ${action.provider}`))
    return "اعتمد وأرسل";
  if (action.provider === "browser") return "اعتمد وشغّل المتصفح";
  if (/calendar|meeting|event|zoom/i.test(`${action.id} ${action.provider}`))
    return "اعتمد وأضف الموعد";
  if (/publish|post/i.test(action.id)) return "اعتمد وانشر";
  return "اعتمد ونفّذ";
}

export function ActionCard({
  workspaceId,
  action,
  onDone,
  runSignal = 0,
  onExecuted,
  revisedNote,
}: {
  workspaceId: string;
  action: PendingAction;
  onDone?: () => void;
  /** يزيد عند أمر «ابعت/اعتمد» من الشات لتنفيذ الإجراء بلا ضغط الزر. */
  runSignal?: number;
  onExecuted?: (ok: boolean, message?: string) => void;
  /** ملخّص آخر تعديل طُبّق بأمر من الشات. */
  revisedNote?: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(action.values ?? {});
  const dispatched = useRef(false);
  /** التعديل بأمر نصي يستبدل القيم المعروضة. */
  useEffect(() => {
    setValues(action.values ?? {});
    setDone(false);
    setOutcome(null);
    dispatched.current = false;
  }, [action.values]);
  const [edit, setEdit] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{
    filled?: string[];
    missed?: string[];
    submitted?: boolean;
    verification?: "verified" | "needs_confirmation" | "not_submitted";
    verificationReason?: string;
    screenshotUrl?: string | null;
    kind?: string;
    status?: string;
    answer?: string;
    liveViewUrl?: string | null;
    steps?: { n: number; note: string; url: string; screenshotUrl: string | null }[];
  } | null>(null);
  const [preview, setPreview] = useState<{ title: string | null; screenshotUrl: string | null; error?: string | null } | null>(null);

  const exec = useServerFn(runEmployeeAction);
  const previewFn = useServerFn(previewBrowserAction);

  // لإجراءات المتصفح: لقطة حية للصفحة قبل الاعتماد، ليرى المالك ما سيُملأ بالضبط.
  const browserUrl = action.provider === "browser" ? (values["url"] ?? "").trim() : "";
  useEffect(() => {
    if (!browserUrl) return;
    let cancelled = false;
    previewFn({ data: { workspaceId, url: browserUrl } })
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserUrl, workspaceId]);
  const run = useMutation({
    mutationFn: () => exec({ data: { workspaceId, actionId: action.id, values } }),
    onSuccess: (res) => {
      setDone(true);
      setError(null);
      if (res && typeof res === "object" && "result" in res && res.result && typeof res.result === "object") {
        setOutcome(res.result as typeof outcome);
      }
      const browserOutcome = res.result as typeof outcome;
       const verified =
         action.provider !== "browser" ||
         browserOutcome?.verification === undefined ||
         browserOutcome.verification === "verified";
      onExecuted?.(verified, browserOutcome?.verificationReason);
      // تبقى البطاقة ظاهرة بنتيجة التنفيذ؛ الإغلاق فقط بزر «لاحقاً».
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : "تعذّر تنفيذ الإجراء.";
      setError(message);
      onExecuted?.(false, message);
    },
    onSettled: () => {
      dispatched.current = false;
    },
  });

  const missing = action.inputs
    .filter((i) => i.required && !(values[i.name] ?? "").trim())
    .map((i) => i.label);

  const lastSignal = useRef(runSignal);
  useEffect(() => {
    if (runSignal === lastSignal.current) return;
    lastSignal.current = runSignal;
    if (done || run.isPending || dispatched.current) return;
    if (missing.length) {
      setEdit(true);
      onExecuted?.(false, `ناقص: ${missing.join("، ")} — اكتبه في الشات أو في البطاقة.`);
      return;
    }
    dispatched.current = true;
    run.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSignal]);

  if (done && outcome?.kind === "browser-task") {
    const last = [...(outcome.steps ?? [])].reverse().find((st) => st.screenshotUrl);
    const lastUrl = [...(outcome.steps ?? [])].reverse().find((st) => st.url)?.url;
    const stopped = outcome.status === "needs_approval" || outcome.status === "handoff";
    return (
      <div className="mt-3 space-y-2 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm animate-pop-in">
        <p className="font-semibold">
          {stopped
            ? "وصلت للخطوة الحساسة وتوقفت لتأكيدك قبل أي دفع أو إرسال."
            : `أنهيت رحلة التصفح في ${outcome.steps?.length ?? 0} خطوة.`}
        </p>
        {outcome.answer ? (
          <p className="whitespace-pre-line text-foreground" dir="auto">
            {outcome.answer}
          </p>
        ) : null}
        {last?.screenshotUrl ? (
          <img
            src={last.screenshotUrl}
            alt="آخر صفحة وصل إليها المتصفح"
            className="max-h-64 w-full rounded-xl border border-border object-cover object-top"
            loading="lazy"
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          {outcome.liveViewUrl ? (
            <Button asChild className="min-h-10 rounded-xl text-xs font-bold">
              <a href={outcome.liveViewUrl} target="_blank" rel="noreferrer">
                أكّد الخطوة الأخيرة في الجلسة الحية
              </a>
            </Button>
          ) : null}
          {lastUrl ? (
            <Button asChild variant="outline" className="min-h-10 rounded-xl text-xs font-bold">
              <a href={lastUrl} target="_blank" rel="noreferrer">
                افتح العرض الأصلي
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-semibold animate-pop-in">
        <AppIcon name={action.provider} className="size-5 shrink-0" />
        <span>
           {outcome?.verification === "not_submitted"
             ? `لم يتم إرسال «${action.label}» على ${appLabel(action.provider)}.`
             : outcome?.verification === "needs_confirmation"
            ? `تمت محاولة «${action.label}» على ${appLabel(action.provider)} وتحتاج تأكيدك.`
            : `تم تنفيذ «${action.label}» فعلياً على ${appLabel(action.provider)}.`}
          {outcome?.filled?.length ? ` اتملى: ${outcome.filled.join("، ")}.` : ""}
          {outcome?.missed?.length ? ` ملقتش: ${outcome.missed.join("، ")}.` : ""}
          {outcome?.verificationReason ? ` ${outcome.verificationReason}` : ""}
        </span>
        {outcome?.screenshotUrl ? (
          <a
            href={outcome.screenshotUrl}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-mint/30"
          >
            <img
              src={outcome.screenshotUrl}
              alt="لقطة الصفحة بعد التنفيذ"
              className="max-h-64 w-full object-cover object-top"
              loading="lazy"
            />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm animate-pop-in">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 font-semibold sm:flex">
        <AppIcon name={action.provider} className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          {action.label} — جاهز للتنفيذ على <b>{appLabel(action.provider)}</b>
        </span>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setEdit((v) => !v)}
          aria-expanded={edit}
          className="col-span-2 min-h-9 shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          {edit ? "إخفاء التفاصيل" : "مراجعة وتعديل"}
        </Button>
      </div>

      <div className={cn("mt-2 space-y-2", edit ? "" : "hidden")}>
        {action.inputs.map((i) => (
          <label key={i.name} className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {i.label}
              {i.required ? " *" : ""}
            </span>
            <textarea
              dir="auto"
              rows={3}
              value={values[i.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [i.name]: e.target.value }))}
              className="w-full min-w-0 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      {!edit ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {action.inputs
            .filter((i) => (values[i.name] ?? "").trim())
            .slice(0, 4)
            .map((i) => (
              <li key={i.name} className="truncate" dir="auto">
                <b>{i.label}:</b> {values[i.name]}
              </li>
            ))}
        </ul>
      ) : null}

      {preview?.screenshotUrl ? (
        <figure className="mt-3 overflow-hidden rounded-xl border border-border">
          <img
            src={preview.screenshotUrl}
            alt={preview.title ?? "معاينة الصفحة"}
            className="max-h-64 w-full object-cover object-top"
            loading="lazy"
          />
          <figcaption className="bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
            معاينة حية للصفحة قبل التنفيذ{preview.title ? ` — ${preview.title}` : ""}
          </figcaption>
        </figure>
      ) : preview?.error ? (
        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground" dir="auto">
          تعذّرت المعاينة: {preview.error}
        </p>
      ) : null}

      {revisedNote ? (
        <p className="mt-2 rounded-lg bg-background/70 px-2.5 py-1.5 text-xs font-semibold text-foreground animate-pop-in" dir="auto">
          ✏️ {revisedNote}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs font-semibold text-coral">{error}</p> : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        تقدر تتحكم من الشات: اكتب «ابعت» للتنفيذ، أو «عدّل … ثم ابعت»، أو «إلغاء».
      </p>
      {missing.length ? (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          أكمل: {missing.join("، ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={run.isPending || done || missing.length > 0}
          onClick={() => {
            // قفل فوري ضد الضغط المزدوج أو ضعف الشبكة.
            if (dispatched.current || run.isPending || done) return;
            dispatched.current = true;
            run.mutate();
          }}
          className="min-h-10 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background disabled:opacity-50"
        >
          {run.isPending ? "جارٍ التنفيذ…" : executeLabel(action)}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => onDone?.()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          لاحقاً
        </Button>
      </div>
    </div>
  );
}
