/**
 * معاينة حيّة للمخرج قبل اعتماده: يظهر المنشور أو البريد داخل قالبه النهائي
 * (شكل منشور سوشيال أو رسالة بريد) مع تعديل سريع ونسخ مباشر.
 */
import { useEffect, useState } from "react";
import { Check, Copy, Eye } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Portrait } from "@/components/site/Portrait";
import { firstImageUrl } from "@/components/app/OutputActions";

export type PreviewKind = "post" | "email" | "doc";

export function previewKindFor(employeeId: string, body: string): PreviewKind {
  if (/^\s*(الموضوع|subject)\s*[:：]/im.test(body) || employeeId === "eva") return "email";
  if (employeeId === "sonny" || employeeId === "dana" || /#[^\s#]{2,}/.test(body)) return "post";
  return "doc";
}

function subjectOf(body: string): { subject: string; rest: string } {
  const match = body.match(/^\s*(?:الموضوع|subject)\s*[:：]\s*(.+)$/im);
  if (!match) return { subject: "", rest: body };
  return { subject: match[1]!.trim(), rest: body.replace(match[0]!, "").trim() };
}

export function OutputPreview({
  employeeId,
  employeeName,
  body,
  className,
}: {
  employeeId: string;
  employeeName: string;
  body: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(body);
  const [copied, setCopied] = useState(false);
  const kind = previewKindFor(employeeId, draft);
  const image = firstImageUrl(draft);

  useEffect(() => {
    setDraft(body);
  }, [body]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const { subject, rest } = subjectOf(draft);
  const clean = draft.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "output-action-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.72rem] font-bold transition-colors hover:bg-secondary"
          }
        >
          <Eye className="size-3.5" />
          معاينة حيّة
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[88dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {kind === "email"
              ? "شكل الرسالة كما ستصل"
              : kind === "post"
                ? "شكل المنشور كما سيظهر"
                : "معاينة المخرج"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            {kind === "email" ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
                <p className="text-xs font-bold text-muted-foreground">من: {employeeName}</p>
                <p className="mt-1 text-base font-bold" dir="auto">
                  {subject || "بدون عنوان"}
                </p>
                <div className="mt-3 whitespace-pre-wrap leading-7" dir="auto">
                  {rest}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="block size-8 overflow-hidden rounded-full">
                    <Portrait memberId={employeeId} name={employeeName} className="size-full" />
                  </span>
                  <span className="text-xs font-bold">{employeeName}</span>
                </div>
                {image ? (
                  <img src={image} alt="معاينة التصميم" className="w-full object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-square w-full bg-secondary" />
                )}
                <p className="whitespace-pre-wrap px-3 py-3 text-sm leading-7" dir="auto">
                  {clean}
                </p>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-xs font-bold text-muted-foreground">تعديل سريع قبل النسخ</p>
            <textarea
              dir="auto"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-64 w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm leading-7"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void copy()}
                className="min-h-10 rounded-xl px-4 text-xs font-bold"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "تم النسخ" : "انسخ النص النهائي"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(body)}
                className="min-h-10 rounded-xl px-3 text-xs font-bold text-muted-foreground"
              >
                رجوع للنص الأصلي
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
