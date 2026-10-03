import { Portrait } from "@/components/site/Portrait";
import { cn } from "@/lib/utils";
import type { BrowserEvent } from "@/lib/employee-stream";
import { Check, Globe, ExternalLink, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * مؤشر عمل الموظف لحظة بلحظة: سجل الخطوات الحقيقية التي نفّذها (مثل Manus/Claude)،
 * نافذة المتصفح الحيّ وهو يبحث، ثم نص الرد وهو يُكتب.
 */
export function Thinking({
  memberId,
  name,
  className,
  step,
  steps = [],
  browser,
  text,
}: {
  memberId: string;
  name: string;
  className?: string;
  step?: string | null;
  steps?: string[];
  browser?: BrowserEvent | null;
  text?: string;
  request?: string;
  imageRequested?: boolean;
  attachments?: number;
}) {
  const streaming = Boolean(text && text.trim());
  const log = steps.length ? steps : step ? [step] : [];
  const active = log.length > 0 || Boolean(browser) || streaming;
  let host = "";
  try {
    host = browser?.url ? new URL(browser.url).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }

  if (!streaming) return null;
  void log; void active; void host;
  return (
    <div
      className={cn("chat-thinking-row flex min-w-0 justify-end gap-3 animate-bubble-in", className)}
      aria-live="polite"
    >
      <span className="order-2 block size-9 shrink-0 overflow-hidden rounded-xl shadow-sm">
        <Portrait memberId={memberId} name={name} className="size-full" />
      </span>
      <div className="order-1 chat-thinking-content w-[min(46rem,82%)] min-w-0 [overflow-wrap:anywhere] rounded-3xl rounded-se-lg border border-border bg-card px-4 py-3 shadow-sm">
        <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7">
          {text}
          <span className="typewriter-caret align-middle" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}

/**
 * لوحة العمل اللحظية فوق مربع الإدخال (يسار): ما يفعله الموظف الآن خطوة بخطوة،
 * مع عدّاد الوقت والمتصفح الحي — بدل حشرها داخل المحادثة.
 */
export function LiveStatus({
  memberId,
  name,
  steps,
  browser,
  writing,
}: {
  memberId: string;
  name: string;
  steps: string[];
  browser?: BrowserEvent | null;
  writing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const iv = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const current = writing ? `${name} يكتب الرد الآن…` : steps[steps.length - 1] ?? `${name} يقرأ رسالتك…`;
  const done = writing ? steps : steps.slice(0, -1);
  let host = "";
  try {
    host = browser?.url ? new URL(browser.url).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }
  return (
    <div
      className="pointer-events-auto mb-2 mr-auto w-fit min-w-0 max-w-[min(28rem,100%)] animate-pop-in overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-card backdrop-blur"
      role="status"
      aria-live="polite"
      aria-label={`${name} يعمل على طلبك`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!done.length && !browser}
        className="flex w-full min-w-0 items-center gap-2.5 px-2.5 py-2 text-start"
      >
        <span className="relative block size-7 shrink-0 overflow-hidden rounded-lg">
          <Portrait memberId={memberId} name={name} className="size-full" />
        </span>
        <span className="size-2 shrink-0 rounded-full bg-primary think-dot" aria-hidden />
        <span key={current} dir="auto" className="min-w-0 flex-1 truncate text-[0.8rem] font-semibold text-foreground animate-pop-in">
          {current}
        </span>
        <span className="shrink-0 tabular-nums text-[0.7rem] text-muted-foreground" dir="ltr">
          {elapsed}s
        </span>
        {done.length || browser ? (
          <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        ) : null}
      </button>
      {open && done.length ? (
        <ol className="space-y-1 border-t border-border/60 px-3 py-2" dir="auto">
          {done.map((label, i) => (
            <li key={`${i}-${label}`} className="flex min-w-0 items-start gap-2 text-[0.72rem] leading-5 text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">{label}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {browser ? (
        <div className="border-t border-border/60">
          <div className="flex min-w-0 items-center gap-2 px-3 py-1.5 text-[0.7rem] text-muted-foreground">
            <Globe className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate" dir="ltr">{host || "متصفح حقيقي"}</span>
            {!browser.done ? (
              <span className="font-semibold text-primary">مباشر</span>
            ) : (
              <span>انتهى التصفح</span>
            )}
            {browser.liveUrl && !browser.done ? (
              <a href={browser.liveUrl} target="_blank" rel="noreferrer" className="hover:text-foreground" aria-label="افتح الشاشة الحيّة">
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
          {open ? (
            <div className="relative aspect-video w-[min(28rem,80vw)] bg-muted">
              {browser.screenshotUrl ? (
                <img src={browser.screenshotUrl} alt="" className="absolute inset-0 size-full object-cover object-top" />
              ) : null}
              {browser.liveUrl && !browser.done ? (
                <iframe src={browser.liveUrl} title="المتصفح الحي" className="pointer-events-none absolute inset-0 size-full" sandbox="allow-same-origin allow-scripts" />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
