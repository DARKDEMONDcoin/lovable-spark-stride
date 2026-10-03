import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Globe, Loader2, Sparkles, Check, Quote, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { extractBrandVoice } from "@/lib/brand-voice.functions";
import type { BrandVoiceResult } from "@/lib/brand-voice.server";
import { cn } from "@/lib/utils";
import { useBrainItems, useToggleBrainItem } from "@/lib/data";
import { Switch } from "@/components/ui/switch";

const GUIDE_TITLE = "دليل صوت العلامة";

/** Brand voice: one optional guide every employee follows while it is switched on. */
export function BrandVoiceExtractor({
  workspaceId,
  website,
}: {
  workspaceId?: string | undefined;
  website?: string | null | undefined;
}) {
  const qc = useQueryClient();
  const run = useServerFn(extractBrandVoice);
  const toggle = useToggleBrainItem(workspaceId);
  const { data: brainItems } = useBrainItems(workspaceId);
  const guide = (brainItems ?? []).find((item) => item.title === GUIDE_TITLE);
  const active = Boolean(guide && guide.used_by.length > 0);

  const [mode, setMode] = useState<"url" | "samples">("url");
  const [url, setUrl] = useState("");
  const [samples, setSamples] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [result, setResult] = useState<BrandVoiceResult | null>(null);

  useEffect(() => {
    if (website && !url) setUrl(website.startsWith("http") ? website : `https://${website}`);
  }, [website]); // eslint-disable-line react-hooks/exhaustive-deps

  const extract = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("مساحة العمل غير جاهزة بعد.");
      return run({
        data: { workspaceId, url: mode === "url" ? url : undefined, samples: samples || undefined, save: true },
      });
    },
    onSuccess: (res) => {
      setResult(res);
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ["brain", workspaceId] });
      toast.success("جاهز — الموظفون يكتبون الآن بصوت علامتك.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الاستخراج"),
  });

  const showForm = !guide || formOpen;
  const p = result?.profile;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
          <Fingerprint className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-black sm:text-lg">صوت العلامة</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {guide
              ? active
                ? "كل الموظفين يكتبون بهذا الأسلوب الآن."
                : "متوقف — الموظفون يكتبون بأسلوبهم الافتراضي."
              : "نقرأ موقعك أو نصوصك ونستخرج نبرتك ولهجتك، ليكتب الفريق كأنه منك."}
          </p>
        </div>
        {guide ? (
          <Switch
            checked={active}
            disabled={toggle.isPending}
            onCheckedChange={(v) =>
              toggle.mutate(
                { id: guide.id, active: v },
                { onSuccess: () => toast.success(v ? "تم تشغيل صوت العلامة" : "تم إيقاف صوت العلامة") },
              )
            }
            aria-label="تشغيل صوت العلامة للموظفين"
          />
        ) : null}
      </div>

      {guide && !formOpen ? (
        <div className={cn("mt-4 rounded-2xl border border-border p-4", !active && "opacity-60")}>
          <p className="flex items-center gap-2 text-sm font-bold">
            <Check className="size-4 text-jade" /> {p?.summary ?? "الدليل محفوظ"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{guide.meta}</p>
          {p?.signaturePhrases?.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {p.signaturePhrases.slice(0, 5).map((ph) => (
                <li key={ph} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                  <Quote className="size-3 text-primary" /> {ph}
                </li>
              ))}
            </ul>
          ) : null}
          {showGuide ? (
            <p className="mt-3 max-h-80 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {guide.body}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showGuide && "rotate-180")} />
              {showGuide ? "إخفاء الدليل" : "عرض الدليل"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
            >
              <RefreshCw className="size-3.5" /> أعد الاستخراج
            </button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            extract.mutate();
          }}
        >
          <div className="flex gap-1 rounded-full bg-secondary p-1 text-sm font-bold">
            {(["url", "samples"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 transition-colors",
                  mode === m ? "bg-card shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "url" ? "من موقعي" : "من نصوص ألصقها"}
              </button>
            ))}
          </div>

          {mode === "url" ? (
            <label className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 focus-within:border-primary">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <input
                dir="ltr"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-brand.com"
                className="min-w-0 flex-1 bg-transparent text-left text-sm outline-none"
                required
              />
            </label>
          ) : (
            <textarea
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
              placeholder="الصق ٣ منشورات أو رسائل كتبتها بنفسك (٨٠ حرفًا على الأقل)…"
              required
              minLength={80}
              className="min-h-28 w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={extract.isPending || !workspaceId}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background disabled:opacity-60"
            >
              {extract.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> نحلّل أسلوبك… (حتى دقيقة)
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> استخرج صوت العلامة
                </>
              )}
            </button>
            {guide ? (
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground"
              >
                إلغاء
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
