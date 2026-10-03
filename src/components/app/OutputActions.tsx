/**
 * شريط إجراءات موحّد أسفل كل مخرج للموظف:
 * 1) روابط سريعة للأداة المتخصصة المناسبة لكل موظف (تقويم، محرر تصميم، تقارير…).
 * 2) خيار ثابت للنسخ والتنزيل، وربط المنصة إن لم تكن مربوطة بعد.
 */
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, CalendarDays, Check, Copy, Download, Globe, ImageIcon, LineChart, ListChecks, Palette, Send, Sparkles, Users } from "lucide-react";

import { ConnectNow } from "@/components/app/ConnectNow";
import { OutputPreview } from "@/components/app/OutputPreview";
import { SendToProject } from "@/components/app/workspace/SendToProject";
import { PlatformPreviewDialog } from "@/components/app/PlatformPreview";
import { requestedPublishTargets } from "@/lib/platforms";
import { appLabel } from "@/components/site/AppIcon";
import { cn } from "@/lib/utils";

/** تمرير المخرج لزميل مناسب لإكمال المهمة المركّبة داخل تخصصه. */
function teamFollowUps(employeeId: string): { id: string; label: string; prompt: string }[] {
  switch (employeeId) {
    case "sam":
      return [
        { id: "nour", label: "مرّر البحث لنور", prompt: "حوّل نتائج البحث التالية إلى خطة محتوى تنفيذية." },
        { id: "sonny", label: "حوّله لمنشورات مع سوني", prompt: "اكتب منشورات سوشيال من نتائج البحث التالية." },
      ];
    case "nour":
      return [
        { id: "sonny", label: "نفّذ المنشورات مع سوني", prompt: "اكتب منشورات جاهزة للنشر من الخطة التالية." },
        { id: "dana", label: "جهّز التصاميم مع دانة", prompt: "جهّز تصاميم مناسبة للخطة التالية بمقاسات المنصات." },
      ];
    case "sonny":
      return [
        { id: "dana", label: "صمّم له صورة مع دانة", prompt: "صمّم صورة مناسبة للمنشور التالي." },
      ];
    case "dana":
      return [
        { id: "sonny", label: "اكتب نص النشر مع سوني", prompt: "اكتب نص منشور مناسب للتصميم التالي." },
      ];
    case "eva":
      return [
        { id: "sam", label: "ابحث بالتفاصيل مع سام", prompt: "ابحث وعمّق المعلومات الواردة في التالي." },
      ];
    default:
      return [];
  }
}

type QuickLink = {
  to: string;
  label: string;
  icon: typeof CalendarDays;
  search?: Record<string, string>;
};

/** أول صورة داخل نص ماركداون — تُستخدم لفتح التصميم في محرر دانة وتنزيله. */
export function firstImageUrl(body: string): string | null {
  const md = body.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  if (md?.[1]) return md[1];
  const raw = body.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/i);
  return raw?.[0] ?? null;
}

type OutputKind = "design" | "post" | "email" | "event" | "seo" | "report" | "plan" | "leads" | "web" | "general";

/** يقرأ المخرج نفسه ليحدد نوعه — الأزرار تتبع المحتوى لا اسم الموظف فقط. */
export function detectOutputKind(employeeId: string, body: string, imageUrl: string | null): OutputKind {
  const t = body.toLowerCase();
  if (imageUrl) return "design";
  if (/(^|\n)\s*(الموضوع|subject)\s*[:：]|مسودة (رد|بريد|إيميل)|عزيزي|تحية طيبة/i.test(body)) return "email";
  if (/(اجتماع|موعد|حجز|تقويم جوجل|meeting)/.test(t) && /(الساعة|\d{1,2}:\d{2}|صباحاً|مساءً)/.test(t)) return "event";
  if (/(كلمات مفتاحية|الكلمة المفتاحية|سيو|seo|ترتيب|search console|backlink)/i.test(body)) return "seo";
  if (/(عملاء محتملين|\bleads?\b|صفقة|عرض سعر|pipeline|قائمة (شركات|عملاء))/i.test(body)) return "leads";
  if (/(خطة محتوى|تقويم المحتوى|الأسبوع الأول|اليوم الأول|جدول نشر)/.test(body)) return "plan";
  if (/(^|\n)\|.+\|/.test(body) || /(ga4|زيارات|معدل التحويل|تقرير|الإنفاق|roas|cpc)/i.test(body)) return "report";
  // نتائج بحث بمصادر ليست منشوراً حتى لو كان الموظف سِراج.
  const researchy = /(المصادر|المصدر:|https?:\/\/)/.test(body) && !/#[\p{L}_]{2,}/u.test(body);
  if (!researchy && (/#[\p{L}_]{2,}/u.test(body) || ["sonny"].includes(employeeId))) return "post";
  if (/https?:\/\//.test(body) && employeeId === "eva") return "web";
  return "general";
}

function linksFor(employeeId: string, imageUrl: string | null, body = ""): QuickLink[] {
  const image = imageUrl ? { img: imageUrl } : undefined;
  switch (detectOutputKind(employeeId, body, imageUrl)) {
    case "design":
      return [
        { to: "/app/design-editor", label: "عدّل التصميم في المحرر", icon: Palette, ...(image ? { search: image } : {}) },
        { to: "/app/calendar", label: "جدوِله في التقويم", icon: CalendarDays },
      ];
    case "post":
      return [
        { to: "/app/calendar", label: "جدوِله في التقويم", icon: CalendarDays },
        { to: "/app/queue", label: "طابور النشر", icon: Send },
      ];
    case "email":
      return [{ to: "/app/inbox-watch", label: "البريد غير المُجاب", icon: Send }];
    case "event":
      return [{ to: "/app/tasks", label: "مهامي ومواعيدي", icon: CalendarDays }];
    case "seo":
      return [
        { to: "/app/rankings", label: "تتبّع هذه الكلمات", icon: LineChart },
        { to: "/app/reports", label: "تقرير السيو", icon: LineChart },
      ];
    case "leads":
      return [
        { to: "/app/proposals", label: "المبادرات والعروض", icon: Sparkles },
        { to: "/app/approvals", label: "اعتمد التواصل", icon: ListChecks },
      ];
    case "plan":
      return [
        { to: "/app/calendar", label: "انقل الخطة للتقويم", icon: CalendarDays },
        { to: "/app/team-tasks", label: "وزّعها على الفريق", icon: Users },
      ];
    case "report":
      return [{ to: "/app/reports", label: "افتح التقارير الكاملة", icon: LineChart }];
    case "web":
      return [{ to: "/app/browser", label: "تابع في المتصفح", icon: Globe }];
    default:
      return employeeId === "eva"
        ? [{ to: "/app/browser", label: "المتصفح المنفّذ", icon: Globe }]
        : [];
  }
}

export function OutputActions({
  employeeId,
  employeeName,
  body,
  workspaceId,
  missingProvider,
  className,
}: {
  employeeId: string;
  employeeName: string;
  body: string;
  workspaceId: string | undefined;
  /** منصة مطلوبة للتنفيذ الآلي وغير مربوطة بعد. */
  missingProvider?: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const imageUrl = firstImageUrl(body);
  const links = linksFor(employeeId, imageUrl, body);
  const kind = detectOutputKind(employeeId, body, imageUrl);
  const [platformOpen, setPlatformOpen] = useState(false);
  const targetPlatform = (() => {
    try {
      return requestedPublishTargets(body)[0] ?? "instagram";
    } catch {
      return "instagram";
    }
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const url = imageUrl;
    const a = document.createElement("a");
    if (url) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.download = `${employeeName}-تصميم`;
    } else {
      const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
      a.href = URL.createObjectURL(blob);
      a.download = `${employeeName}-مخرج.txt`;
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // لا أزرار «مرّر لزميل»: الموظف ينفّذ بنفسه ويستعين بخبرة زملائه خلف الكواليس.
  const followUps: ReturnType<typeof teamFollowUps> = [];
  void teamFollowUps;

  return (
    <div className={cn("output-actions mt-3 flex flex-wrap items-center gap-1.5", className)}>
      {links.map((link) => (
        <Link
          key={`${link.to}-${link.label}`}
          to={link.to}
          {...(link.search ? { search: link.search as never } : {})}
          className="output-action-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.72rem] font-bold transition-colors hover:bg-secondary"
        >
          <link.icon className="size-3.5 shrink-0" />
          {link.label}
        </Link>
      ))}

      {kind === "post" || kind === "design" ? (
        <>
          <button
            type="button"
            onClick={() => setPlatformOpen(true)}
            className="output-action-chip inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1.5 text-[0.72rem] font-bold text-primary transition-colors hover:bg-primary/15"
          >
            <Eye className="size-3.5" /> شوفه على المنصة
          </button>
          <PlatformPreviewDialog
            open={platformOpen}
            onOpenChange={setPlatformOpen}
            post={{ provider: targetPlatform, body: body.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim(), image_url: imageUrl }}
          />
        </>
      ) : null}

      <OutputPreview employeeId={employeeId} employeeName={employeeName} body={body} />

      <SendToProject employeeId={employeeId} employeeName={employeeName} body={body} />

      <button
        type="button"
        onClick={() => void copy()}
        className="output-action-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.72rem] font-bold transition-colors hover:bg-secondary"
      >
        {copied ? <Check className="size-3.5 text-jade" /> : <Copy className="size-3.5" />}
        {copied ? "تم النسخ" : "انسخ المخرج"}
      </button>

      <button
        type="button"
        onClick={download}
        className="output-action-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.72rem] font-bold transition-colors hover:bg-secondary"
      >
        <Download className="size-3.5" />
        {imageUrl ? "نزّل التصميم" : "نزّل المخرج"}
      </button>

      {followUps.map((next) => (
        <Link
          key={next.id}
          to="/app/chat/$id"
          params={{ id: next.id }}
          search={{ prompt: `${next.prompt}\n\n---\n${body.slice(0, 1200)}` }}
          className="output-action-chip inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1.5 text-[0.72rem] font-bold text-primary transition-colors hover:bg-primary/15"
        >
          <Users className="size-3.5 shrink-0" />
          {next.label}
        </Link>
      ))}

      {missingProvider ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-sky/30 bg-sky/10 px-2 py-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">
            {appLabel(missingProvider)} غير مربوط
          </span>
          <ConnectNow
            workspaceId={workspaceId}
            provider={missingProvider}
            size="sm"
            label="اربطه للتنفيذ الآلي"
          />
        </span>
      ) : null}
    </div>
  );
}
