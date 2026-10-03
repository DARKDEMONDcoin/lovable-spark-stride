import { useEffect, useMemo, useRef, useState } from "react";
import { ListenButton } from "@/components/app/ListenButton";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  Copy,
  Share2,
  RefreshCw,
  Download,
  X,
  SlidersHorizontal,
  BookOpenText,
  PlugZap,
  ImagePlus,
  TextCursorInput,
  CalendarDays,
  Bot,
  ListChecks,
  ExternalLink,
  ArrowRight,
  Plane,
  CalendarClock,
  History,
  CheckCircle2,
  Sparkles,
  ScrollText,
  LayoutDashboard,
  ChevronDown,
  Globe,
  Palette,
  MailWarning,
  Settings2,
  MessageCircle,
  Search,
} from "lucide-react";

import { ChatShellActions, ChatShellMeta } from "@/components/app/ChatShellHost";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { ConnectNow } from "@/components/app/ConnectNow";
import { InlineApproval } from "@/components/app/InlineApproval";
import { getMember } from "@/data/team";
import {
  useBrainItems,
  useEmployeeConversation,
  useIntegrations,
  useMessages,
  useProfile,
  useMarkConversationRead,
  useTasks,
  useWorkspace,
  useChatWorkspace,
  useUpdateWorkspace,
} from "@/lib/data";
import { askEmployee, runSkill } from "@/lib/ai.functions";
import { reviseEmployeeAction } from "@/lib/employee-actions.functions";
import { parseChatCommand } from "@/lib/chat-commands";
import { saveChatSignal } from "@/lib/learning.functions";
import { SkillPalette } from "@/components/app/SkillPalette";
import { Thinking, LiveStatus } from "@/components/app/Thinking";
import { VoiceInput } from "@/components/app/VoiceInput";
import { Markdown } from "@/components/app/Markdown";
import { ChatAttachments, splitUserBody } from "@/components/app/ChatAttachments";
import { PostCards } from "@/components/app/PostCards";
import { OutputActions } from "@/components/app/OutputActions";
import { requestedPublishTargets } from "@/lib/platforms";
import { askedForPublishableOutput, extractPostText, isNonPostReply } from "@/lib/post-format";
import { detectHandoff } from "@/lib/handoff";
import { HandoffCard } from "@/components/app/HandoffCard";
import { PublishToWordPress } from "@/components/app/PublishToWordPress";
import { ActionPanel } from "@/components/app/ActionPanel";
import { ActionCard, type PendingAction } from "@/components/app/ActionCard";
import { UserAvatar } from "@/components/app/UserAvatar";
import { PersonAvatar } from "@/components/app/PersonAvatar";
import { BusinessProfileCard } from "@/components/app/BusinessProfileCard";
import { Portrait } from "@/components/site/Portrait";
import { streamEmployeeTurn, type BrowserEvent } from "@/lib/employee-stream";
import { supabase } from "@/integrations/supabase/client";
import { listHumanTeam } from "@/lib/collaboration.functions";
import {
  MediaStudio,
  type Attachment,
  type ImageMode,
  type Aspect,
} from "@/components/app/MediaStudio";

import { featuredSkillsFor, skillsFor, type Skill } from "@/data/skills";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

/** يقسّم الرسائل حسب اليوم لعرض فواصل تاريخ أنيقة. */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "اليوم";
  if (same(d, yesterday)) return "أمس";
  return d.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" });
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  /** المؤقّت يُلغى عند الخروج: بدونه يُحدَّث زر مختفٍ بعد تبديل المحادثة. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1600);
        } catch {
          /* تجاهل */
        }
      }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label="نسخ الرد"
    >
      {done ? <Check className="size-3 text-jade" /> : <Copy className="size-3" />}
      {done ? "نُسخ" : "نسخ"}
    </button>
  );
}

/** أزرار أسفل رد الموظف: نسخ · مشاركة · تنزيل · إعادة التوليد. */
function MessageActions({
  text,
  onRegenerate,
  disabled,
  listen,
}: {
  listen?: React.ReactNode;
  text: string;
  onRegenerate: (() => void) | null;
  disabled: boolean;
}) {
  const [shared, setShared] = useState(false);
  /** المؤقّت يُلغى عند الخروج: بدونه يُحدَّث زر مختفٍ بعد تبديل المحادثة. */
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (shareTimer.current) clearTimeout(shareTimer.current);
    },
    [],
  );
  const btn =
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50";
  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        if (shareTimer.current) clearTimeout(shareTimer.current);
        shareTimer.current = setTimeout(() => setShared(false), 1600);
      }
    } catch {
      /* أُلغيت المشاركة */
    }
  };
  const download = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sahl-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {listen}
      <CopyButton text={text} />
      <button type="button" onClick={() => void share()} className={btn} aria-label="مشاركة">
        <Share2 className="size-3" /> {shared ? "نُسخ للمشاركة" : "مشاركة"}
      </button>
      <button type="button" onClick={download} className={btn} aria-label="تنزيل">
        <Download className="size-3" /> تنزيل
      </button>
      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={disabled}
          className={btn}
          aria-label="إعادة التوليد"
        >
          <RefreshCw className="size-3" /> أعد التوليد
        </button>
      ) : null}
    </span>
  );
}

/**
 * يقرّر إن كان رد الموظف منشوراً قابلاً للنشر (لا سؤالاً ولا شرحاً قصيراً).
 * يُطبَّق على كل الموظفين بالتساوي: المنشور القصير (تغريدة/كابشن/ستوري) مقبول
 * عندما يطلبه المستخدم صراحةً، والنص الطويل بلا هاشتاق يبقى مقبولاً كمنشور.
 */
function looksPostable(body: string, request?: string | null): boolean {
  const text = body.trim();
  if (text.length < 40) return false;
  if (/^[^\n]{0,200}\?\s*$/.test(text)) return false;
  if (isNonPostReply(text)) return false;
  if (/#[^\s#]{2,}/.test(text)) return true;
  if (/(تغريدة|تويت|tweet|كابشن|caption|ستور(?:ي|يز)|story|سناب|snap)/iu.test(request ?? ""))
    return text.length >= 40;
  return text.length > 220;
}

/** نص زر الاعتماد حسب نوع مخرج كل موظف. */
const APPROVE_COPY: Record<string, [string, string]> = {
  sonny: ["اعتمد المنشور", "المنشور جاهز"],
  eva: ["اعتمد المخرج", "المخرج جاهز"],
  sam: ["اعتمد العرض", "عرض المبيعات جاهز"],
  nour: ["اعتمد المقال", "المقال جاهز"],
  dana: ["اعتمد التصميم", "التصميم جاهز"],
  adam: ["اعتمد التقرير", "التقرير جاهز"],
};

function savedAction(value: unknown): PendingAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<PendingAction>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.provider !== "string" ||
    typeof candidate.label !== "string" ||
    !Array.isArray(candidate.inputs) ||
    !candidate.values ||
    typeof candidate.values !== "object"
  )
    return null;
  return candidate as PendingAction;
}

/** لا تصل أخطاء المزوّدات الخام (إنجليزية/JSON) للمستخدم — سبب عربي واضح وخطوة تالية. */
function friendlyChatError(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  if (!m) return fallback;
  if (/(429|rate.?limit|overloaded|503|502|UNAVAILABLE|quota)/i.test(m))
    return "عليه ضغط لحظي من كثرة الطلبات. اضغط «أعد المحاولة» بعد ثوانٍ قليلة.";
  if (/(timed out|aborted|الوقت المتاح)/i.test(m)) return "الرد أخذ وقتاً أطول من المعتاد. اضغط «أعد المحاولة».";
  if (/(Failed to fetch|NetworkError|network)/i.test(m)) return "انقطع الاتصال بالإنترنت لحظياً. تأكد من الشبكة ثم اضغط «أعد المحاولة».";
  if (/[{}"]|[A-Za-z]{12,}/.test(m) && !/[\u0600-\u06FF]{3,}.*$/.test(m.replace(/\(.*\)/g, ""))) return fallback;
  return m.replace(/\s*\((?:[^()]*[A-Za-z{}][^()]*)\)\s*/g, " ").trim() || fallback;
}

export const Route = createFileRoute("/app/chat/$id")({
  validateSearch: (s: Record<string, unknown>): { prompt?: string } =>
    typeof s["prompt"] === "string" && s["prompt"] ? { prompt: s["prompt"].slice(0, 4000) } : {},
  pendingMs: 60_000,
  loader: ({ params }) => {
    const member = getMember(params.id);
    if (!member) throw notFound();
    return { name: member.name, role: member.role };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `محادثة ${loaderData.name} | سهل` : "محادثة | سهل" },
      {
        name: "description",
        content: loaderData ? `تحدث مع ${loaderData.name} — ${loaderData.role}.` : "محادثة الموظف.",
      },
      {
        property: "og:title",
        content: loaderData ? `محادثة ${loaderData.name} | سهل` : "محادثة | سهل",
      },
      {
        property: "og:description",
        content: loaderData ? `تحدث مع ${loaderData.name} — ${loaderData.role}.` : "محادثة الموظف.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => <ChatMissing />,
  notFoundComponent: () => <ChatMissing />,
  component: ChatPage,
});

function ChatMissing() {
  return (
    <>
      <ChatShellMeta title="الموظف غير موجود" padded />
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <p className="text-ink-soft">لم نعثر على هذا الموظف ضمن فريقك.</p>
        <Link
          to="/app/chat"
          className="mt-5 inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background"
        >
          العودة للمحادثات
        </Link>
      </div>
    </>
  );
}

/** عناوين عربية لمفاتيح JSON عند عرض رد قديم بصيغة غير متوقعة. */
const JSON_LABELS: Record<string, string> = {
  day: "اليوم",
  title: "العنوان",
  content_pillar: "محور المحتوى",
  channel: "المنصة",
  body: "النص",
  caption: "النص",
  hashtags: "الهاشتاجات",
  scheduled: "موعد النشر",
  best_time: "أفضل وقت",
  metrics_to_measure: "مؤشرات القياس",
  call_to_action: "دعوة لاتخاذ إجراء",
  instagram_post: "منشور إنستجرام",
  x_post: "تغريدة إكس",
  linkedin_post: "منشور لينكدإن",
  facebook_post: "منشور فيسبوك",
};
const JSON_HIDDEN = new Set(["image_prompt", "needs_connection", "kind", "provider", "reason"]);

/** يحوّل أي بنية JSON إلى نص عربي مقروء بدل عرض أقواس ومفاتيح. */
function jsonToText(node: unknown, depth = 0): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node.replace(/\\n/g, "\n").trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node))
    return node
      .map((v) => {
        const r = jsonToText(v, depth + 1);
        return r && typeof v !== "object" ? `- ${r}` : r;
      })
      .filter(Boolean)
      .join(depth === 0 ? "\n\n---\n\n" : "\n");
  if (typeof node === "object")
    return Object.entries(node as Record<string, unknown>)
      .filter(([k, v]) => !JSON_HIDDEN.has(k) && v !== null && v !== undefined && v !== "")
      .map(([k, v]) => {
        const r = jsonToText(v, depth + 1);
        if (!r) return "";
        const label = JSON_LABELS[k] ?? k.replace(/_/g, " ");
        if (typeof v === "object") return `${"#".repeat(Math.min(depth + 2, 6))} ${label}\n\n${r}`;
        return r.includes("\n") ? `**${label}:**\n\n${r}` : `**${label}:** ${r}`;
      })
      .filter(Boolean)
      .join("\n\n");
  return "";
}

/** بعض الردود القديمة محفوظة كنص JSON خام — نحوّلها لعرض مقروء. */
/** يفصل بادئة JSON عن أي نص أُلحق بها (صورة، مصادر) في الردود القديمة. */
function splitJsonPrefix(text: string): { parsed: unknown; rest: string } | null {
  const open = text[0];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return { parsed: JSON.parse(text.slice(0, i + 1)), rest: text.slice(i + 1).trim() };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function prettyBody(body: string): string {
  const text = body.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return body;
  try {
    const split = splitJsonPrefix(text);
    if (!split) throw new Error("not json");
    const { parsed, rest } = split;
    const tail = rest ? `\n\n${rest}` : "";
    const items = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{
      reply?: string;
      deliverable?: { title?: string; body?: string } | null;
      deliverables?: Array<{ title?: string; body?: string }> | null;
    }>;
    const parts = items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const chunk: string[] = [];
      if (typeof item.reply === "string" && item.reply.trim()) chunk.push(item.reply.trim());
      for (const d of [
        item.deliverable,
        ...(Array.isArray(item.deliverables) ? item.deliverables : []),
      ])
        if (d?.body) chunk.push(`### ${d.title ?? "المخرج"}\n\n${d.body}`);
      return chunk;
    });
    if (parts.length) return parts.join("\n\n") + tail;
    const readable = jsonToText(parsed);
    return readable.trim().length > 20 ? readable + tail : body;
  } catch {
    return body;
  }
}

function timeOf(iso: string) {
  const parts = new Intl.DateTimeFormat("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("hour")}:${value("minute")} ${value("dayPeriod")}`.trim();
}

type WorkTool = {
  id: string;
  title: string;
  description: string;
  /** مسار داخلي يُعرض داخل المحادثة عبر إطار مدمج. */
  to: string;
  icon: typeof ListChecks;
  sonnyOnly?: boolean;
  employeeOnly?: string;
};

const WORK_TOOLS: WorkTool[] = [
  {
    id: "command-center",
    title: "مركز القيادة",
    description: "تابع العمل والنتائج والمنصات من مكان واحد",
    to: "/app/",
    icon: LayoutDashboard,
  },
  {
    id: "tasks",
    title: "المهام",
    description: "تابع التنفيذ خطوة بخطوة",
    to: "/app/tasks",
    icon: ListChecks,
  },
  {
    id: "browser",
    title: "المتصفح المنفّذ",
    description: "قارن عروض السيارة والرحلة والفندق، واستكمل الطلب مع الموظف حسب الخطوات المتاحة.",
    to: "/app/browser",
    icon: Globe,
  },
  {
    id: "inbox-watch",
    title: "بريد أمَل",
    description: "اعثر على الرسائل المهمة وجهّز رداً تراجعه قبل الإرسال.",
    to: "/app/inbox-watch",
    icon: MailWarning,
    employeeOnly: "eva",
  },
  {
    id: "design-editor",
    title: "محرر دانة",
    description: "حوّل صورتك إلى إعلان عربي جاهز للمنشور أو الستوري.",
    to: "/app/design-editor",
    icon: Palette,
    employeeOnly: "dana",
  },
  {
    id: "autopilot",
    title: "الطيار الآلي",
    description: "شغّل صناعة ونشر المحتوى",
    to: "/app/autopilot",
    icon: Plane,
    sonnyOnly: true,
  },
  {
    id: "calendar",
    title: "تقويم المحتوى",
    description: "خطّط وراجع المحتوى بصريًا",
    to: "/app/calendar",
    icon: CalendarDays,
    sonnyOnly: true,
  },
  {
    id: "automations",
    title: "الجدولة التلقائية",
    description: "كرّر المهام في مواعيدها",
    to: "/app/automations",
    icon: CalendarClock,
  },
  {
    id: "queue",
    title: "طابور النشر",
    description: "راقب المنشورات ومواعيدها",
    to: "/app/queue",
    icon: History,
    sonnyOnly: true,
  },
  {
    id: "approvals",
    title: "الموافقات",
    description: "راجع واعتمد النتائج",
    to: "/app/approvals",
    icon: CheckCircle2,
  },
  {
    id: "proposals",
    title: "مبادرات الفريق",
    description: "ما يقترحه الموظف من نفسه",
    to: "/app/proposals",
    icon: Sparkles,
  },
  {
    id: "decisions",
    title: "سجل القرارات",
    description: "كل ما اتفقتم عليه ملزم",
    to: "/app/decisions",
    icon: ScrollText,
  },
];

/** بقية أقسام المنصة — تُفتح كذلك داخل المحادثة عند ذكر رابطها. */
const ALL_APP_TOOLS: WorkTool[] = [
  {
    id: "integrations",
    title: "التكاملات",
    description: "اربط حساباتك",
    to: "/app/integrations",
    icon: PlugZap,
  },
  {
    id: "brain",
    title: "عقل العلامة",
    description: "ذاكرة علامتك",
    to: "/app/brain",
    icon: BookOpenText,
  },
  {
    id: "reports",
    title: "التقارير",
    description: "أرقامك الحقيقية",
    to: "/app/reports",
    icon: ScrollText,
  },
  {
    id: "rankings",
    title: "تتبّع الترتيب",
    description: "ترتيبك في Google",
    to: "/app/rankings",
    icon: Search,
  },
  {
    id: "settings",
    title: "الإعدادات",
    description: "بيانات علامتك",
    to: "/app/settings",
    icon: SlidersHorizontal,
  },
  { id: "discovery", title: "الاكتشاف", description: "فرص جديدة", to: "/app/discovery", icon: Bot },
];

const EMPLOYEE_COPY: Record<string, { prompts: string[]; greetings: string[] }> = {
  sonny: {
    prompts: [
      "أطلق منتجي الجديد بحملة تبدأ بالتشويق وتنتهي بطلبات حقيقية…",
      "ابنِ لي شهر محتوى يجعل الناس تتذكر علامتي لا مجرد إعلان آخر…",
      "حوّل قصة عميل سعيد إلى منشور يستحق المشاركة…",
      "اكتشف لماذا يشاهدون ولا يشترون، ثم غيّر خطة المحتوى…",
    ],
    greetings: [
      "جاهز نحوّل فكرتك إلى حضور يستحق التوقف عنده.",
      "خلّينا نبني محتوى يبدو منك، لا من آلة.",
      "من أول الفكرة حتى النشر، أنا معك.",
      "قل لي هدفك، وسأرتّب الطريق الأقصر إليه.",
    ],
  },
  eva: {
    prompts: [
      "أنقذيني من زحمة اليوم: ما الرسائل التي تحتاج ردي الآن؟…",
      "جهّزي رداً يحافظ على عميل غاضب، ودعيني أراجعه قبل الإرسال…",
      "ابحثي عن موعد يجمع الفريق والعميل دون تعطيل يومنا…",
      "استخرجي من بريدي القرارات التي لا تحتمل التأجيل…",
    ],
    greetings: [
      "سأحمي وقتك وأرتّب ما يستحق انتباهك أولًا.",
      "اترك التفاصيل لي واحتفظ أنت بالقرارات المهمة.",
      "يوم أهدأ يبدأ من قائمة مرتبة بوضوح.",
      "أنا هنا لأجعل كل شيء في موعده ومكانه.",
    ],
  },
  sam: {
    prompts: [
      "ابحث عن شركات تحتاج حلّنا فعلاً، مع سبب واضح لكل ترشيح…",
      "اكتب رسالة لهذا العميل تُظهر أنك فهمت مشكلته لا أنك تبيع له…",
      "من بين الفرص المفتوحة، من يستحق مكالمة اليوم ولماذا؟…",
      "حلّل أين تتوقف صفقاتنا واقترح خطوة تنقذها…",
    ],
    greetings: [
      "لنبحث عن الفرص التي تستحق وقت فريقك فعلًا.",
      "كل رسالة ستبدو شخصية وواضحة، لا آلية.",
      "سأتابع بهدوء حتى تصبح الفرصة محادثة حقيقية.",
      "ابدأ بالهدف، وسأبني لك طريق الوصول للعميل.",
    ],
  },
  nour: {
    prompts: [
      "اكتشفي سؤالاً يطرحه عملاؤنا ولا يجيب عنه منافسونا جيداً…",
      "اكتبي دليلاً يجعل الزائر يثق بخبرتنا، لا عنواناً مكرراً…",
      "لماذا لا تظهر صفحتي لعملاء يبحثون عن خدمتي؟…",
      "ابني خريطة محتوى تقود الزائر من أول سؤال إلى قرار الشراء…",
    ],
    greetings: [
      "سنكتب للناس أولًا، ثم نجعل محركات البحث تفهمنا.",
      "كل كلمة سنختارها لها سبب ونتيجة قابلة للقياس.",
      "لنحوّل ما يبحث عنه جمهورك إلى محتوى يجدونه فعلًا.",
      "أنا جاهزة لبناء حضور يبقى، لا زيارة عابرة.",
    ],
  },
  dana: {
    prompts: [
      "اصنعي هوية تجعل مشروعي معروفاً من أول نظرة…",
      "حوّلي عرض الافتتاح إلى فكرة إعلان تتوقف عندها العين…",
      "صوّري فكرة حملة واحدة تناسب المنشور والستوري والإعلان…",
      "راجعي هذا التصميم: ماذا أغيّر حتى يفهم العميل العرض في ثانيتين؟…",
    ],
    greetings: [
      "لنحوّل فكرتك إلى شيء يُرى ويُتذكر.",
      "الجمال هنا ليس زينة؛ بل وضوح وثقة.",
      "سأحافظ على روح علامتك في كل مقاس وتفصيلة.",
      "ابدأ بالإحساس الذي تريده، وسأمنحه شكلًا.",
    ],
  },
  adam: {
    prompts: [
      "أي قناة تجلب عملاء يدفعون، لا مجرد مشاهدات؟…",
      "أين يتسرب الإنفاق الإعلاني، وكم يمكن أن نوفر؟…",
      "حوّل تقرير الشهر إلى ثلاثة قرارات تستحق التنفيذ…",
      "لو ضاعفنا ميزانية قناة واحدة، أيها تختار وبأي دليل؟…",
    ],
    greetings: [
      "سأفصل الإشارة عن الضوضاء وأعطيك القرار الواضح.",
      "الأرقام تحكي قصة؛ دوري أن أجعلها مفهومة.",
      "لن ننظر إلى التقارير فقط، بل إلى الخطوة التالية.",
      "دعنا نعرف ما يعمل فعلًا وما يجب أن يتوقف.",
    ],
  },
};

/** أزرار الشريط العلوي المناسبة لكل موظف. */
const BAR_BRAND = new Set(["sonny", "eva", "sam", "nour", "dana", "adam"]);
const BAR_WORK = new Set(["sonny", "eva", "sam", "nour", "adam", "dana"]);

function useTypewriter(lines: string[], pause = 1700, enabled = true) {
  const [line, setLine] = useState(0);
  const [length, setLength] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLine(0);
      setLength(lines[0]?.length ?? 0);
      setDeleting(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLength(lines[0]?.length ?? 0);
      return;
    }
    const current = lines[line] ?? "";
    const complete = length === current.length;
    const empty = length === 0;
    const delay = complete && !deleting ? pause : deleting ? 28 : 52;
    const timer = window.setTimeout(() => {
      if (complete && !deleting) setDeleting(true);
      else if (empty && deleting) {
        setDeleting(false);
        setLine((value) => (value + 1) % lines.length);
      } else setLength((value) => value + (deleting ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [deleting, enabled, length, line, lines, pause]);

  return lines[line]?.slice(0, length) ?? "";
}

function ChatPage() {
  const { id } = Route.useParams();
  const member = getMember(id);
  if (!member) return <ChatMissing />;
  return <ChatView key={id} id={id} member={member} />;
}

function ChatView({
  id,
  member,
}: {
  id: string;
  member: NonNullable<ReturnType<typeof getMember>>;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: workspace } = useChatWorkspace();
  const { data: profile } = useProfile();
  const listTeam = useServerFn(listHumanTeam);
  const { data: humanTeam } = useQuery({
    queryKey: ["human-team", workspace?.id],
    enabled: Boolean(workspace?.id && (workspace as { shared?: boolean } | null)?.shared),
    queryFn: () => listTeam({ data: { workspaceId: workspace?.id ?? "" } }),
  });
  const { data: conversation } = useEmployeeConversation(workspace?.id, id);
  const conversationId = conversation?.id;
  const markConversationRead = useMarkConversationRead(workspace?.id);
  const updateWorkspace = useUpdateWorkspace();
  const { data: messages } = useMessages(workspace?.id, id, conversationId);
  const { data: tasks } = useTasks(workspace?.id);
  const { data: integrations } = useIntegrations(workspace?.id);
  useBrainItems(workspace?.id);
  const { prompt: prefill } = Route.useSearch();
  const [draft, setDraft] = useState(prefill ?? "");
  useEffect(() => {
    if (prefill) setDraft(prefill);
  }, [prefill]);
  const [pending, setPending] = useState<string | null>(null);
  /** البثّ الحقيقي: المرحلة التي ينفّذها الموظف الآن + نص ردّه وهو يُكتب. */
  const [liveStep, setLiveStep] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [liveSteps, setLiveSteps] = useState<string[]>([]);
  const [browser, setBrowser] = useState<BrowserEvent | null>(null);
  const [savedTask, setSavedTask] = useState<string | null>(null);
  /** طلب ربط سياقي: يظهر فقط عندما تحتاج المهمة الحالية حساباً غير مربوط. */
  const [needsConnection, setNeedsConnection] = useState<{
    provider: string;
    reason: string;
  } | null>(null);
  /** إجراء حقيقي جهّزه الموظف على تكامله المربوط — ينتظر اعتماد المالك بضغطة. */
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [dismissedActionMessages, setDismissedActionMessages] = useState<Set<string>>(
    () => new Set(),
  );
  /** أوامر المالك على المخرج الجاهز من الشات نفسه (ابعت/عدّل/إلغاء) وردود الموظف عليها. */
  const [commandLog, setCommandLog] = useState<
    { id: number; role: "user" | "employee"; text: string; tone?: "ok" | "error" | "busy" }[]
  >([]);
  const [actionRunSignal, setActionRunSignal] = useState(0);
  const [actionDone, setActionDone] = useState(false);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [taskCommand, setTaskCommand] = useState<
    { n: number; kind: "approve" | "reject"; reason?: string } | null
  >(null);
  const logSeq = useRef(0);
  const pushLog = (role: "user" | "employee", text: string, tone?: "ok" | "error" | "busy") =>
    setCommandLog((log) => [...log.filter((e) => e.tone !== "busy"), { id: ++logSeq.current, role, text, ...(tone ? { tone } : {}) }]);
  const reviseFn = useServerFn(reviseEmployeeAction);

  const [error, setError] = useState<string | null>(null);

  // حرية الوسائط: مرفقات المستخدم + قراره في الصورة التلقائية + نسبة الأبعاد.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [imageMode, setImageMode] = useState<ImageMode>("auto");
  const [imagePrompt, setImagePrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("square");
  /** طول المنشور: اختياري تماماً — الافتراضي «تلقائي» يترك القرار للموظف. */
  const [postLength, setPostLength] = useState<"auto" | "short" | "medium" | "long">("auto");

  useEffect(() => {
    const latest = [...(messages ?? [])].reverse().find((message) => message.role !== "user");
    setPendingAction(latest ? savedAction(latest.pending_action) : null);
    setDismissedActionMessages(new Set());
  }, [conversationId, messages]);

  useEffect(() => {
    if (conversationId && (messages ?? []).length) markConversationRead.mutate(conversationId);
  }, [conversationId, messages?.length]);

  /** لوحات الشريط العلوي — تُفتح كلها داخل نفس الصفحة. */
  const [barPanel, setBarPanel] = useState<"apps" | "brand" | "work" | null>(null);
  const [barPanelAnchor, setBarPanelAnchor] = useState({ x: 0, top: 0 });
  const barPanelButtonRefs = useRef<
    Record<"apps" | "brand" | "work", HTMLButtonElement | null>
  >({ apps: null, brand: null, work: null });
  const [embeddedTool, setEmbeddedTool] = useState<{
    tool: WorkTool;
    mode: "inline" | "expanded";
  } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  /** كل مسار داخلي يُفتح داخل المحادثة نفسها بدل مغادرتها. */
  const openAppInChat = (path: string) => {
    const clean = path.split("?")[0]!.replace(/\/$/, "");
    const tool =
      WORK_TOOLS.find((item) => item.to.replace(/\/$/, "") === clean) ??
      ALL_APP_TOOLS.find((item) => item.to.replace(/\/$/, "") === clean);
    if (!tool) return false;
    setEmbeddedTool({ tool, mode: "inline" });
    setBarPanel(null);
    return true;
  };
  const [activeTool, setActiveTool] = useState<"media" | "length" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  /** يبقى true وهو عند أسفل المحادثة، ويصير false لحظة ما يقلّب لأعلى بنفسه. */
  const [stickToBottom, setStickToBottom] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** نص المسودة لحظة بدء الإملاء الصوتي — يُلحق به كلام المستخدم. */
  const voiceBase = useRef("");
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  /** يصير true عند إيقاف الطلب بعد الإرسال — فنتجاهل نتيجته. */
  const cancelledRef = useRef(false);

  const ask = useServerFn(askEmployee);
  const runSkillFn = useServerFn(runSkill);
  /** إشارة صامتة للتعلّم: «عدّل» أو «أعد التوليد» تقييمٌ حقيقي لا يحتاج سؤال المالك. */
  const sendChatSignal = useServerFn(saveChatSignal);
  const signal = (messageId: string, kind: "edited" | "rejected", originalText: string) => {
    if (!workspace) return;
    void sendChatSignal({
      data: { workspaceId: workspace.id, employeeId: id, messageId, kind, originalText },
    }).catch(() => undefined);
  };
  const employeeSkills = skillsFor(id);
  const quickSkills = featuredSkillsFor(id).slice(0, 6);
  const employeeCopy: { prompts: string[]; greetings: string[] } =
    EMPLOYEE_COPY[id] ?? EMPLOYEE_COPY["sonny"]!;
  // أثناء وجود رسائل لا نشغّل مؤقتات كتابة مستمرة تعيد رسم صفحة المحادثة كلها.
  const hasMessages = Boolean((messages ?? []).length || pending);
  const rotatingPlaceholder = useTypewriter(employeeCopy.prompts, 1700, !hasMessages);
  const rotatingGreeting = useTypewriter(employeeCopy.greetings, 2400, !hasMessages);
  const userName = profile?.full_name?.trim().split(/\s+/)[0] || "صديقي";
  /** آخر رسالة فشل إرسالها — لزر «أعد المحاولة». */
  const [pendingText, setPendingText] = useState<string | null>(null);

  /** إزاحة سحب لوحة الأداة — يحرّكها المستخدم من رأسها داخل نفس المحادثة. */
  const [toolOffset, setToolOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const positionBarPanel = (panel: "apps" | "brand" | "work") => {
    const button = barPanelButtonRefs.current[panel];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setBarPanelAnchor({ x: rect.left + rect.width / 2, top: rect.bottom + 8 });
  };

  const toggleBarPanel = (panel: "apps" | "brand" | "work") => {
    if (barPanel === panel) {
      setBarPanel(null);
      return;
    }
    positionBarPanel(panel);
    setBarPanel(panel);
  };

  useEffect(() => {
    if (!barPanel) return;
    const reposition = () => positionBarPanel(barPanel);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [barPanel]);

  useEffect(() => {
    setToolOffset({ x: 0, y: 0 });
  }, [embeddedTool?.tool.id, embeddedTool?.mode]);
  const dragHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("button, a, input")) return;
      dragRef.current = {
        px: event.clientX,
        py: event.clientY,
        ox: toolOffset.x,
        oy: toolOffset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const start = dragRef.current;
      if (!start) return;
      setToolOffset({
        x: start.ox + (event.clientX - start.px),
        y: start.oy + (event.clientY - start.py),
      });
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
  };
  const toolStyle = {
    transform: `translate3d(${toolOffset.x}px, ${toolOffset.y}px, 0)`,
  } satisfies React.CSSProperties;

  const owned = (integrations ?? []).filter((i) => i.employee_id === id);
  const wpConnected = (integrations ?? []).some(
    (i) => i.provider === "wordpress" && i.status === "connected",
  );
  /**
   * المنصة التي يحتاجها هذا المخرج للتنفيذ الآلي وغير مربوطة بعد — فيظهر
   * للمستخدم خيار الربط بدل أن يبقى زر الاعتماد بلا وجهة.
   */
  const missingProviderFor = (request: string): string | null => {
    const connected = (provider: string) =>
      (integrations ?? []).some((i) => i.provider === provider && i.status === "connected");
    const wanted = requestedPublishTargets(request)[0] ?? (id === "nour" ? "wordpress" : null);
    if (!wanted) return null;
    return connected(wanted) ? null : wanted;
  };

  const send = useMutation({
    mutationFn: async (message: string) => {
      if (!conversationId) throw new Error("المحادثة ليست جاهزة بعد. حاول مرة أخرى.");
      const activeConversationId = conversationId;
      const payload = {
        workspaceId: workspace!.id,
        employeeId: id,
        conversationId: activeConversationId,
        message,
        attachments,
        imageMode,
        imagePrompt: imagePrompt.trim() || undefined,
        imageAspect: aspect,
        postLength,
      };

      // البثّ الحقيقي: مراحل التنفيذ الفعلية ثم نص الرد وهو يُكتب.
      // الأسئلة والدردشة لا تبثّ شيئاً — تصل كاملة مرة واحدة.
      // لا نعيد الطلب إن كان التنفيذ قد بدأ فعلاً — كي لا تتكرر الرسالة مرتين.
      let started = false;
      // خطوة فورية لحظة الإرسال مبنية على نص الرسالة نفسها — قبل أي رد من الخادم.
      {
        const gist = message.replace(/\s+/g, " ").trim();
        setLiveSteps([`يقرأ طلبك: «${gist.length > 48 ? `${gist.slice(0, 48)}…` : gist}»`]);
      }
      try {
        const result = await streamEmployeeTurn(payload, {
          onStep: (label) => {
            started = true;
            if (cancelledRef.current) return;
            setLiveStep(label);
            setLiveSteps((prev) => (prev[prev.length - 1] === label ? prev : [...prev, label].slice(-12)));
          },
          onDelta: (text) => {
            started = true;
            if (cancelledRef.current) return;
            streamBufferRef.current += text;
            if (streamFrameRef.current === null) {
              streamFrameRef.current = window.requestAnimationFrame(flushStream);
            }
          },
          onBrowser: (e) => {
            started = true;
            if (cancelledRef.current) return;
            setBrowser((prev) => (e.done ? (prev ? { ...prev, done: true } : null) : { ...prev, ...e, screenshotUrl: e.screenshotUrl ?? prev?.screenshotUrl ?? null }));
          },
          onReset: () => {
            streamBufferRef.current = "";
            setLiveText("");
          },
        });
        return { result, activeConversationId };
      } catch (streamError) {
        if (started) throw streamError;
        // تعذّر بدء البثّ (شبكة/جلسة): نُنفّذ الطلب بالمسار العادي كي لا يُفقد.
        console.warn("[chat] stream failed, falling back:", streamError);
        setLiveStep(null);
      setLiveSteps([]);
      setBrowser(null);
        setLiveText("");
        const result = await ask({ data: payload });
        return { result, activeConversationId };
      }
    },

    onSuccess: async ({ result: res, activeConversationId }) => {
      await qc.invalidateQueries({
        queryKey: ["messages", workspace?.id, id, activeConversationId],
      });
      setLiveStep(null);
      setLiveSteps([]);
      setBrowser(null);
      setLiveText("");
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      setPending(null);
      setPendingText(null);

      // المرفقات ووصف الصورة يخصّان الرسالة المُرسلة فقط.
      setAttachments([]);
      setImagePrompt("");

      setSavedTask(res?.createdTaskId ?? null);
      setNeedsConnection(res?.needsConnection ?? null);
      setPendingAction((res?.action as PendingAction | null | undefined) ?? null);
      setActionDone(false);
      setActionNote(null);
      setCommandLog([]);
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["employee-inbox", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown, message) => {
      setPending(null);
      setLiveStep(null);
      setLiveSteps([]);
      setBrowser(null);
      setLiveText("");
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      setPendingText(message);
      setError(friendlyChatError(e, "تعذّر إرسال الطلب"));
    },
  });

  const skillRun = useMutation({
    mutationFn: async (p: { skill: Skill; values: Record<string, string> }) => {
      if (!conversationId) throw new Error("المحادثة ليست جاهزة بعد. حاول مرة أخرى.");
      const activeConversationId = conversationId;
      return runSkillFn({
        data: {
          workspaceId: workspace!.id,
          employeeId: id,
          skillId: p.skill.id,
          values: p.values,
          conversationId: activeConversationId,
        },
      });
    },
    onSuccess: (res) => {
      setSavedTask(res?.taskId ?? null);
      void qc.invalidateQueries({ queryKey: ["messages", workspace?.id, id, conversationId] });
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown) => setError(friendlyChatError(e, "تعذّر تنفيذ المهمة")),
  });

  const busy = send.isPending || skillRun.isPending;

  const messageRequests = useMemo(() => {
    let last = "";
    return (messages ?? []).map((message) => {
      const before = last;
      if (message.role === "user") last = splitUserBody(message.body).text || message.body;
      return before;
    });
  }, [messages]);

  // نحدّث شاشة البث مرة واحدة لكل إطار بدلاً من إعادة رسم المحادثة مع كل جزء صغير.
  const streamBufferRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const flushStream = () => {
    streamFrameRef.current = null;
    const chunk = streamBufferRef.current;
    streamBufferRef.current = "";
    if (chunk && !cancelledRef.current) setLiveText((previous) => previous + chunk);
  };

  useEffect(
    () => () => {
      if (streamFrameRef.current !== null) {
        window.cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      streamBufferRef.current = "";
    },
    [],
  );

  // المستخدم حرّ في التقليب أثناء كتابة الموظف: لا ننزل معه إلا إذا كان أصلاً عند الأسفل.
  useEffect(() => {
    if (!stickToBottom) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [
    messages?.length,
    send.isPending,
    skillRun.isPending,
    liveStep,
    liveText,
    stickToBottom,
  ]);

  const onColumnScroll = () => {
    const el = columnRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distance < 120);
  };

  // إبقاء التركيز في مربع الكتابة + تمدد تلقائي لارتفاع النص.
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, id]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // مربع فارغ = ارتفاع ثابت، حتى لا يتحرك مع تقليب الجُمل.
    if (!draft) {
      el.style.height = "3rem";
      return;
    }
    el.style.height = "auto";
    const safeMaximum = Math.min(window.innerHeight * 0.55, 512);
    el.style.height = `${Math.min(el.scrollHeight, safeMaximum)}px`;
  }, [draft]);

  /** يحاول تنفيذ الرسالة كأمر على المخرج الجاهز؛ يعيد true لو استُهلكت. */
  const handleCommand = (body: string): boolean => {
    const actionAvailable = Boolean(pendingAction);
    const cmd = parseChatCommand(body, actionAvailable || Boolean(savedTask));
    if (!cmd) return false;
    if (actionAvailable && pendingAction && workspace) {
      if (cmd.kind === "approve") {
        if (actionDone) {
          pushLog("user", body);
          pushLog("employee", "الإجراء ده اتنفّذ بالفعل. لو عايز نسخة جديدة اكتب التعديل المطلوب، وهعرضها لاعتماد جديد.", "error");
          return true;
        }
        pushLog("user", body);
        pushLog("employee", `تمام، بنفّذ «${pendingAction.label}» دلوقتي…`, "busy");
        setActionRunSignal((n) => n + 1);
        return true;
      }
      if (cmd.kind === "cancel" || cmd.kind === "reject") {
        pushLog("user", body);
        pushLog("employee", "تمام، لغيت الإجراء ومش هنفّذ حاجة.", "ok");
        setPendingAction(null);
        return true;
      }
      if (cmd.kind === "edit") {
        if (revising) return true;
        pushLog("user", body);
        pushLog("employee", "بعدّل حسب كلامك…", "busy");
        setRevising(true);
        const current = pendingAction;
        void reviseFn({
          data: {
            workspaceId: workspace.id,
            employeeId: id,
            label: current.label,
            inputs: current.inputs.map((i) => ({ name: i.name, label: i.label })),
            values: current.values,
            instruction: cmd.instruction,
          },
        })
          .then((res) => {
            setPendingAction((a) => (a && a.id === current.id ? { ...a, values: res.values } : a));
            if (actionDone) setActionDone(false);
            setActionNote(res.summary);
            if (cmd.thenApprove) {
              pushLog("employee", `${res.summary} وببعته دلوقتي…`, "busy");
              window.setTimeout(() => setActionRunSignal((n) => n + 1), 80);
            } else {
              pushLog("employee", `${res.summary} راجع البطاقة، واكتب «ابعت» لما تكون جاهز أو عدّل تاني.`, "ok");
            }
          })
          .catch((e: unknown) =>
            pushLog("employee", e instanceof Error ? e.message : "تعذّر تطبيق التعديل.", "error"),
          )
          .finally(() => setRevising(false));
        return true;
      }
    }
    if (savedTask && (cmd.kind === "approve" || cmd.kind === "reject" || cmd.kind === "cancel")) {
      pushLog("user", body);
      const kind = cmd.kind === "approve" ? "approve" : "reject";
      setTaskCommand((c) => ({
        n: (c?.n ?? 0) + 1,
        kind,
        ...(cmd.kind === "reject" ? { reason: cmd.reason } : {}),
      }));
      pushLog(
        "employee",
        kind === "approve" ? "اتعتمد ✅ — لو عايز تعديل بعد كده قولّي." : "تمام، رفضته وهتعلّم من ملاحظتك.",
        "ok",
      );
      return true;
    }
    // «عدّل …» على مخرج نصي يذهب للموظف كطلب تعديل عادي مع سياق المحادثة.
    return false;
  };

  const submit = (text: string) => {
    const body = text.trim();
    if (!body || !workspace) return;
    if (busy) {
      setQueuedMessage(body);
      setDraft("");
      return;
    }
    if (handleCommand(body)) {
      setDraft("");
      setStickToBottom(true);
      return;
    }
    setError(null);
    setSavedTask(null);
    setStickToBottom(true);

    cancelledRef.current = false;
    setDraft("");
    setLiveStep(null);
      setLiveSteps([]);
      setBrowser(null);
    setLiveText("");
    setPending(body);
    send.mutate(body);
  };

  useEffect(() => {
    if (busy || !queuedMessage) return;
    const next = queuedMessage;
    setQueuedMessage(null);
    submit(next);
  }, [busy, queuedMessage]);

  /** إيقاف الطلب بعد الإرسال: نُعيد النص إلى مربع الإدخال ونُهمل النتيجة. */
  const stopSending = () => {
    if (!busy) return;
    cancelledRef.current = true;
    if (pending) setDraft(pending);
    setPending(null);
    setPendingText(null);
    setLiveStep(null);
      setLiveSteps([]);
      setBrowser(null);
    setLiveText("");
    setError(null);
    send.reset();
    skillRun.reset();
    inputRef.current?.focus();
  };

  const lastAssistantIdx = (() => {
    const list = messages ?? [];
    for (let i = list.length - 1; i >= 0; i--) if (list[i]!.role !== "user") return i;
    return -1;
  })();
  /**
   * يربط كل رد بالمخرج الذي أنشأه في قاعدة البيانات. الاعتماد على savedTask وحده
   * كان يُفقد الزر فور تحديث الرسائل أو فتح محادثة قديمة.
   */
  const approvalTasksForMessage = (
    messageBody: string,
    messageCreatedAt: string,
    directTaskId?: string | null,
  ) => {
    const prefix = messageBody.slice(0, 400);
    const messageTime = new Date(messageCreatedAt).getTime();
    return (tasks ?? [])
      .filter(
        (task) =>
          task.employee_id === id &&
          task.status === "review" &&
          (task.id === directTaskId ||
            (task.detail === prefix &&
              Math.abs(new Date(task.created_at).getTime() - messageTime) < 120_000)),
      )
      .sort(
        (a, b) =>
          Math.abs(new Date(a.created_at).getTime() - messageTime) -
          Math.abs(new Date(b.created_at).getTime() - messageTime),
      );
  };

  const approvalNode = (taskIds: string[]) => (
    <>
            {!busy ? taskIds.map((taskId) => (
              <InlineApproval
                key={taskId}
                command={taskId === savedTask ? taskCommand : null}
                workspaceId={workspace?.id}
                taskId={taskId}
                employeeName={member.name}
                approveLabel={APPROVE_COPY[member.id]?.[0] ?? "اعتمد المخرج"}
                readyLabel={APPROVE_COPY[member.id]?.[1] ?? "المخرج جاهز"}
                onDone={() => {
                  if (taskId === savedTask) setSavedTask(null);
                }}
              />
            )) : null}

    </>
  );

  return (
    <>
      <ChatShellMeta title={member.name} padded={false} compactTitle hideTitle />
      <ChatShellActions>
        <div className="chat-topbar-actions no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-1.5" dir="rtl">
          <div className="chat-employee-identity">
            <span className="chat-employee-avatar"><Portrait memberId={member.id} name={member.name} className="size-full" /></span>
            <span className="chat-employee-names"><strong>{member.name}</strong><small>{member.role}</small></span>
          </div>
          <div className="chat-employee-navigation" aria-label={`أدوات ${member.name}`}>
            <Button type="button" variant="ghost" size="sm" className="chat-nav-button is-active" aria-label="المحادثة" title="المحادثة" onClick={() => { setBarPanel(null); setEmbeddedTool(null); }}>
              <MessageCircle className="size-4" /><span>المحادثة</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="chat-nav-button" aria-label="التقويم" title="التقويم" onClick={() => void navigate({ to: "/app/calendar", search: { employee: member.id as "sonny" } })}>
              <CalendarDays className="size-4" /><span>التقويم</span>
            </Button>
            <Button ref={(button) => { barPanelButtonRefs.current.brand = button; }} type="button" variant="ghost" size="sm" className={cn("chat-nav-button", barPanel === "brand" && "is-active")} aria-label="التعليمات" title="التعليمات وعقل العلامة" aria-expanded={barPanel === "brand"} onClick={() => toggleBarPanel("brand")}>
              <BookOpenText className="size-4" /><span>التعليمات</span>
            </Button>
            <Button ref={(button) => { barPanelButtonRefs.current.apps = button; }} type="button" variant="ghost" size="sm" className={cn("chat-nav-button", barPanel === "apps" && "is-active")} aria-label="التكاملات" title="تكاملات الموظف" aria-expanded={barPanel === "apps"} onClick={() => toggleBarPanel("apps")}>
              <PlugZap className="size-4" /><span>التكاملات</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="chat-nav-button" aria-label="المتصفح المنفّذ" title={`متصفح ${member.name}`} onClick={() => {
              const browserTool = WORK_TOOLS.find((tool) => tool.id === "browser");
              if (browserTool) setEmbeddedTool({ tool: browserTool, mode: "expanded" });
              setBarPanel(null);
            }}>
              <Globe className="size-4" /><span>المتصفح</span>
            </Button>
          </div>
          <div className="chat-employee-end-actions">
            <Button type="button" variant="ghost" size="icon-sm" className="chat-nav-button" aria-label="الإعدادات" title="الإعدادات" onClick={() => void navigate({ to: "/app/settings" })}>
              <Settings2 className="size-4" />
            </Button>
          </div>
        </div>
      </ChatShellActions>
      <div className="chat-command-layout">
        <div
          className={cn(
            "chat-stage relative flex min-h-[calc(100dvh-4rem)] min-w-0 flex-col",
            ((messages ?? []).length > 0 || pending) && "is-engaged",
          )}
          style={
            {
              "--chat-accent": member.tint,
              "--chat-accent-soft": member.tintSoft,
            } as React.CSSProperties
          }
        >
          <div className="chat-smoke" aria-hidden="true">
            <i />
            <i />
            <i />
            <b />
            <b />
            <b />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div
            ref={columnRef}
            onScroll={onColumnScroll}
            className="chat-message-column relative mx-auto flex w-full max-w-none flex-1 flex-col px-3 sm:px-6 lg:px-8 xl:px-10"
          >
            {(messages ?? []).length === 0 && !pending ? (
              <div className="chat-welcome animate-pop-in">
                <div className="chat-welcome-portraits" aria-hidden="true">
                  <span className="chat-welcome-avatar is-user">
                    <UserAvatar />
                  </span>
                  <span className="chat-welcome-avatar is-employee">
                    <Portrait memberId={member.id} name={member.name} className="size-full" />
                  </span>
                </div>
                <p className="chat-welcome-eyebrow">
                  أنا {member.name}، {member.role}
                </p>
                <h2>أهلًا {userName}</h2>
                <p className="chat-welcome-rotating" aria-live="polite">
                  {rotatingGreeting}
                  <span className="typewriter-caret" aria-hidden="true" />
                </p>
              </div>
            ) : null}

            {(messages ?? []).map((m, idx, arr) => {
              const prev = arr[idx - 1];
              const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
              const isUser = m.role === "user";
              const body = isUser ? m.body : prettyBody(m.body);
              const parsedUser = isUser ? splitUserBody(m.body) : null;
              const sender = isUser && m.sender_id ? humanTeam?.members.find((person) => person.userId === m.sender_id) : null;
              const priorRequest = messageRequests[idx] ?? "";
              return (
                <div key={m.id} className="space-y-4">
                  {newDay ? (
                    <div className="flex items-center gap-3 py-1 text-[0.7rem] font-bold text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      {dayLabel(m.created_at)}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  ) : null}
                  <Message
                    from={isUser ? "user" : "assistant"}
                    className={cn("animate-bubble-in", isUser ? "ms-0 me-auto" : "ms-auto me-0")}
                  >
                    <div
                      className={cn(
                        "chat-message-row group flex min-w-0 gap-3",
                        isUser ? "justify-start" : "justify-end",
                      )}
                    >
                      {!isUser ? (
                        <span className="relative order-2 mt-1 block size-9 shrink-0 overflow-hidden rounded-xl shadow-sm">
                          <Portrait memberId={member.id} name={member.name} className="size-full" />
                        </span>
                      ) : (
                        <span className="relative mt-1 block size-9 shrink-0 overflow-hidden rounded-full border border-border shadow-sm">
                          {(workspace as { shared?: boolean } | null)?.shared ? (
                            <PersonAvatar avatar={sender?.avatar} name={sender?.name ?? m.sender_name ?? "عضو الفريق"} className="size-full rounded-full" />
                          ) : (
                            <UserAvatar />
                          )}
                        </span>
                      )}
                      <div
                        className={cn(
                          "min-w-0",
                          isUser
                            ? "w-fit max-w-[min(34rem,72%)]"
                            : "order-1 w-full max-w-[min(76rem,calc(100%-3rem))]",
                        )}
                      >
                        {isUser ? (
                          <span className="mb-1 block text-[0.7rem] font-bold text-muted-foreground">
                            {(workspace as { shared?: boolean } | null)?.shared
                              ? sender?.name ?? m.sender_name ?? "عضو الفريق"
                              : profile?.full_name ?? "أنت"}
                          </span>
                        ) : null}
                        {parsedUser?.items.length ? (
                          <ChatAttachments items={parsedUser.items} className="mb-2" />
                        ) : null}
                        <MessageContent
                        className={cn(
                           "chat-message-content min-w-0 px-3 py-2 text-[0.82rem] leading-6",
                          isUser
                            ? "bubble-user rounded-xl rounded-ss-sm text-primary-foreground whitespace-pre-wrap shadow-card"
                            : "w-full bg-transparent",
                        )}
                      >
                        {isUser ? (
                          <>
                            {parsedUser?.text ? <p dir="auto">{parsedUser.text}</p> : null}
                            {(m as { source?: string }).source === "telegram" ? (
                              <span className="mt-1 block text-[0.65rem] font-bold opacity-75">
                                ✈️ عبر تيليجرام
                              </span>
                            ) : null}
                          </>

                        ) : (
                          <>
                            <Markdown body={body} onOpenApp={openAppInChat} />
                          </>
                        )}
                        {!isUser &&
                        id === "nour" &&
                        workspace &&
                        m.body.length > 600 &&
                        askedForPublishableOutput(priorRequest) ? (
                          wpConnected ? (
                            <PublishToWordPress workspaceId={workspace.id} body={m.body} />
                          ) : (
                            <span className="mt-3 inline-flex">
                              <ConnectNow
                                workspaceId={workspace.id}
                                provider="wordpress"
                                size="sm"
                                label="اربط ووردبريس وانشر المقال"
                              />
                            </span>
                          )
                        ) : null}
                        {!isUser &&
                        workspace &&
                        !m.body.includes("(/app/tasks)") &&
                        askedForPublishableOutput(priorRequest) &&
                        looksPostable(m.body, priorRequest) ? (
                          <PostCards
                            workspaceId={workspace.id}
                            employeeId={id}
                            taskId={savedTask}
                            channel={requestedPublishTargets(priorRequest)[0] ?? "instagram"}
                            request={priorRequest}
                            body={m.body}
                          />
                        ) : null}

                        {(() => {
                          const req = isUser ? splitUserBody(m.body).text || m.body : priorRequest;
                          const handoff = detectHandoff(req, id);
                          if (!handoff) return null;
                          // الطلب حُوِّل تلقائياً ونُفّذ داخل نفس المحادثة: لا حاجة لزر التوجّه.
                          if (!isUser && m.body.includes("تولّى طلبك تلقائياً")) return null;
                          if (isUser && arr[idx + 1]?.body?.includes("تولّى طلبك تلقائياً")) return null;
                          // تظهر مرة واحدة: مع رسالة المستخدم مباشرة إن كانت آخر رسالة،
                          // أو تحت رد الموظف بعدها.
                          const nextIsAssistant = arr[idx + 1] && arr[idx + 1]!.role !== "user";
                          if (isUser && nextIsAssistant) return null;
                          return (
                            <HandoffCard
                              handoff={handoff}
                              request={req}
                              currentName={member.name}
                            />
                          );
                        })()}

                        {!isUser ? (
                          <div className="chat-reply-approval">
                            {(() => {
                              const linkedIds = approvalTasksForMessage(m.body, m.created_at, m.task_id).map(
                                (task) => task.id,
                              );
                              const taskIds =
                                linkedIds.length || idx !== lastAssistantIdx || !savedTask
                                  ? linkedIds
                                  : [savedTask];
                              return approvalNode(taskIds);
                            })()}
                            {(() => {
                              const persisted = savedAction(m.pending_action);
                              const action = persisted ?? (idx === lastAssistantIdx ? pendingAction : null);
                              if (!action || !workspace || busy || dismissedActionMessages.has(m.id))
                                return null;
                              return (
                                <ActionCard
                                  workspaceId={workspace.id}
                                  action={action}
                                  runSignal={idx === lastAssistantIdx ? actionRunSignal : 0}
                                  revisedNote={idx === lastAssistantIdx ? actionNote : null}
                                  onExecuted={(ok, message) => {
                                    if (ok) {
                                      if (idx === lastAssistantIdx) {
                                        setActionDone(true);
                                        setPendingAction(null);
                                      }
                                      setDismissedActionMessages((current) =>
                                        new Set([...current, m.id]),
                                      );
                                      void supabase
                                        .from("messages")
                                        .update({ pending_action: null })
                                        .eq("id", m.id)
                                        .then(() =>
                                          qc.invalidateQueries({
                                            queryKey: ["messages", workspace.id, id, conversationId],
                                          }),
                                        );
                                    }
                                    pushLog(
                                      "employee",
                                      ok
                                        ? `تم ✅ نفّذت «${action.label}». لو عايز خطوة تانية قولّي.`
                                        : (message ?? "تعذّر التنفيذ."),
                                      ok ? "ok" : "error",
                                    );
                                  }}
                                  onDone={() =>
                                    setDismissedActionMessages((current) =>
                                      new Set([...current, m.id]),
                                    )
                                  }
                                />
                              );
                            })()}
                          </div>
                        ) : null}

                        {!isUser && !busy && body.trim().length > 180 ? (
                          <OutputActions
                            employeeId={id}
                            employeeName={member.name}
                            body={body}
                            workspaceId={workspace?.id}
                            missingProvider={missingProviderFor(priorRequest)}
                          />
                        ) : null}

                        <div
                          className={cn(
                            "mt-1.5 flex flex-wrap items-center gap-2 text-[0.7rem]",
                            isUser ? "text-background/60" : "text-muted-foreground",
                          )}
                        >
                          <span className="whitespace-nowrap tabular-nums" dir="ltr">
                            {timeOf(m.created_at)}
                          </span>
                          {!isUser ? (
                            <span className="ms-auto min-w-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 [&_button]:min-h-9">
                              <MessageActions
                                listen={
                                  workspace && body.trim().length > 2 ? (
                                    <ListenButton workspaceId={workspace.id} text={body} />
                                  ) : null
                                }
                                text={body}
                                disabled={busy}
                                onRegenerate={
                                  priorRequest
                                    ? () => {
                                        signal(m.id, "rejected", m.body);
                                        void submit(
                                          `${priorRequest}\n\n(أعد صياغة الرد السابق بزاوية مختلفة وأقوى، وحافظ على نفس الطلب.)`,
                                        );
                                      }
                                    : null
                                }
                              />
                            </span>
                          ) : null}
                        </div>
                        </MessageContent>
                      </div>
                    </div>
                  </Message>
                </div>
              );
            })}

            {pending &&
            !(messages ?? []).some(
              (m) => m.role === "user" && m.body.trim() === pending.trim(),
            ) ? (
              <div className="flex justify-start gap-3 animate-bubble-in">
                <span className="relative mt-1 block size-9 shrink-0 overflow-hidden rounded-full border border-border shadow-sm">
                  {(workspace as { shared?: boolean } | null)?.shared ? (
                    <PersonAvatar avatar={profile?.avatar_url} name={profile?.full_name ?? "أنت"} className="size-full rounded-full" />
                  ) : (
                    <UserAvatar />
                  )}
                </span>
                <div className="min-w-0 w-fit max-w-[min(34rem,72%)]">
                  <span className="mb-1 block text-[0.7rem] font-bold text-muted-foreground">{profile?.full_name ?? "أنت"}</span>
                  {attachments.length ? (
                    <ChatAttachments items={attachments} className="mb-2" />
                  ) : null}
                  <div className="bubble-user rounded-xl rounded-ss-sm px-3 py-2 text-[0.82rem] leading-6 text-background shadow-card">
                    <p dir="auto" className="whitespace-pre-wrap">{pending}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[0.7rem] text-background/60">
                      <Check className="size-3" /> وصل إلى {member.name}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {busy ? (
              <Thinking
                memberId={member.id}
                name={member.name}
                step={liveStep}
                steps={liveSteps}
                browser={browser}
                text={liveText}
                request={pending ?? pendingText ?? ""}
                imageRequested={
                  imageMode !== "off" && (imageMode !== "auto" || Boolean(imagePrompt.trim()))
                }
                attachments={attachments.length}
              />
            ) : null}

            {commandLog.length ? (
              <div className="space-y-2" aria-live="polite">
                {commandLog.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex animate-pop-in",
                      entry.role === "user" ? "justify-start" : "justify-end",
                    )}
                  >
                    <p
                      dir="auto"
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                        entry.role === "user"
                          ? "bg-foreground text-background"
                          : entry.tone === "error"
                            ? "border border-coral/30 bg-coral/10 text-coral"
                            : "border border-border bg-card text-foreground",
                      )}
                    >
                      {entry.tone === "busy" ? (
                        <Loader2 className="me-1.5 inline size-3.5 animate-spin" />
                      ) : null}
                      {entry.role === "employee" ? <b className="me-1">{member.name}:</b> : null}
                      {entry.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {lastAssistantIdx < 0 ? approvalNode(savedTask ? [savedTask] : []) : null}

            {needsConnection && !busy ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm font-semibold animate-pop-in">
                <AppIcon name={needsConnection.provider} className="size-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  لتنفيذ هذه المهمة فعلياً يحتاج {member.name} ربط{" "}
                  <b>{appLabel(needsConnection.provider)}</b>
                  {needsConnection.reason ? ` — ${needsConnection.reason}` : ""}. دقيقة واحدة عبر
                  OAuth الرسمي.
                </span>
                <ConnectNow
                  workspaceId={workspace?.id}
                  provider={needsConnection.provider}
                  size="sm"
                />
                <button
                  onClick={() => setNeedsConnection(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  لاحقاً
                </button>
              </div>
            ) : null}

            {error ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral animate-pop-in">
                <span className="flex-1">{error}</span>
                {pendingText ? (
                  <button
                    type="button"
                    onClick={() => submit(pendingText)}
                    className="rounded-full bg-coral px-4 py-1.5 text-xs font-bold text-background"
                  >
                    أعد المحاولة
                  </button>
                ) : null}
              </div>
            ) : null}

            {embeddedTool?.mode === "inline" ? (
              <section
                className="chat-inline-tool"
                aria-label={embeddedTool.tool.title}
                style={toolStyle}
              >
                <header className="chat-tool-drag" {...dragHandlers}>
                  <div>
                    <strong>{embeddedTool.tool.title}</strong>
                    <span>تعمل داخل محادثة {member.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmbeddedTool({ tool: embeddedTool.tool, mode: "expanded" })}
                    title="تكبير الأداة داخل المحادثة"
                    aria-label={`تكبير ${embeddedTool.tool.title}`}
                  >
                    <ExternalLink className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmbeddedTool(null)}
                    aria-label="إغلاق الأداة"
                  >
                    <X className="size-4" />
                  </button>
                </header>
                <iframe
                  src={`${embeddedTool.tool.to}?embedded=1`}
                  title={embeddedTool.tool.title}
                />
              </section>
            ) : null}

            <div ref={endRef} className="chat-end-anchor" />
          </div>

          {!stickToBottom ? (
            <button
              type="button"
              onClick={() => {
                setStickToBottom(true);
                endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
              className="chat-jump-bottom"
              aria-label="انزل لأحدث رسالة"
            >
              <ChevronDown className="size-4" />
              أحدث رسالة
            </button>
          ) : null}

          <div className="chat-composer-dock pointer-events-none p-3 sm:p-5">
            {busy ? (
              <LiveStatus
                memberId={member.id}
                name={member.name}
                steps={liveSteps.length ? liveSteps : liveStep ? [liveStep] : []}
                browser={browser}
                writing={Boolean(liveText.trim())}
              />
            ) : null}
            {attachments.length && activeTool !== "media" && !busy ? (
              <div className="pointer-events-auto mb-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
                <ChatAttachments
                  compact
                  items={attachments}
                  onRemove={(url) => setAttachments((list) => list.filter((a) => a.url !== url))}
                />
              </div>
            ) : null}
            <PromptInput
              onSubmit={(message) =>
                submit(
                  message.text ||
                    draft ||
                    (attachments.length ? "راجع المرفقات دي وقولي رأيك فيها." : ""),
                )
              }
              className="chat-composer pointer-events-auto mx-auto w-full max-w-none rounded-2xl border border-border/70 p-2 transition-all focus-within:border-primary/55 focus-within:ring-4 focus-within:ring-primary/10"
            >
              <PromptInputTextarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder=""
                aria-label={`اكتب طلبك لـ${member.name}`}
                dir="auto"
                rows={1}
                className={cn(
                  "chat-composer-textarea field-sizing-fixed min-h-12 resize-none bg-transparent px-3 py-2.5",
                  draft ? "overflow-y-auto" : "overflow-hidden",
                )}
              />
              {!draft ? (
                <span className="chat-composer-placeholder" aria-hidden="true" dir="auto">
                  {rotatingPlaceholder || `اكتب طلبك لـ${member.name}…`}
                  <span className="chat-composer-caret">▌</span>
                </span>
              ) : null}
              {toolsOpen ? (
                <div className="chat-tool-launcher" aria-label="أدوات الطلب">
                  <button
                    type="button"
                    onClick={() => setActiveTool((value) => (value === "media" ? null : "media"))}
                    className={cn("chat-tool-choice", activeTool === "media" && "is-active")}
                    aria-expanded={activeTool === "media"}
                  >
                    <ImagePlus className="size-4" /> الوسائط
                    {attachments.length ? <span>{attachments.length}</span> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTool((value) => (value === "length" ? null : "length"))}
                    className={cn("chat-tool-choice", activeTool === "length" && "is-active")}
                    aria-expanded={activeTool === "length"}
                  >
                    <TextCursorInput className="size-4" /> الطول
                  </button>
                </div>
              ) : null}
              {activeTool ? (
                <div className="chat-tool-popover">
                  <div className="chat-tool-popover-head">
                    <div>
                      <p>{activeTool === "media" ? "الوسائط" : "طول المحتوى"}</p>
                      <span>
                        {activeTool === "media"
                          ? "أرفق أو أنشئ ما يحتاجه الطلب"
                          : "اختر الحجم الأنسب لهذه النتيجة"}
                      </span>
                    </div>
                    <button type="button" onClick={() => setActiveTool(null)} aria-label="إغلاق">
                      <X className="size-4" />
                    </button>
                  </div>
                  {activeTool === "media" ? (
                    <MediaStudio
                      workspaceId={workspace?.id}
                      attachments={attachments}
                      onAttachmentsChange={setAttachments}
                      imageMode={imageMode}
                      onImageModeChange={setImageMode}
                      imagePrompt={imagePrompt}
                      onImagePromptChange={setImagePrompt}
                      aspect={aspect}
                      onAspectChange={setAspect}
                      disabled={busy}
                      defaultOpen
                      hideTrigger
                    />
                  ) : (
                    <div className="chat-length-options">
                      {(
                        [
                          ["auto", "تلقائي", "يقرر الموظف الأنسب"],
                          ["short", "قصير", "مباشر وسريع"],
                          ["medium", "متوسط", "متوازن ومفصل"],
                          ["long", "مطوّل", "شامل ومتعمق"],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={busy}
                          onClick={() => setPostLength(value)}
                          className={cn("chat-length-option", postLength === value && "is-active")}
                        >
                          <span>{label}</span>
                          <small>{hint}</small>
                          {postLength === value ? <Check className="size-4" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputButton
                    type="button"
                    onClick={() => {
                      setToolsOpen((value) => {
                        if (value) setActiveTool(null);
                        return !value;
                      });
                    }}
                    aria-expanded={toolsOpen}
                    aria-label="أدوات الطلب"
                    title="الوسائط وإعدادات الطلب"
                    className={cn("size-9 rounded-lg", toolsOpen && "bg-primary/10 text-primary")}
                  >
                    <SlidersHorizontal className="size-4.5" />
                  </PromptInputButton>
                  <VoiceInput
                    disabled={busy}
                    onState={(st) => {
                      if (st === "recording") voiceBase.current = draft.trim();
                      setVoiceState(st);
                    }}
                    onText={(text, final) => {
                      const base = voiceBase.current;
                      setDraft(text ? (base ? `${base} ${text}` : text) : base);
                      if (final && text) {
                        requestAnimationFrame(() => {
                          const el = inputRef.current;
                          if (el) {
                            el.focus();
                            el.setSelectionRange(el.value.length, el.value.length);
                          }
                        });
                      }
                    }}
                  />
                </PromptInputTools>
                <PromptInputSubmit
                  {...(busy ? { status: "streaming" as const, onStop: stopSending } : {})}
                  disabled={!busy && (voiceState !== "idle" || !workspace || (!draft.trim() && !attachments.length))}
                  aria-label={busy ? "إيقاف" : "إرسال"}
                  title={busy ? "إيقاف الطلب" : "إرسال"}
                  className="size-9 rounded-lg"
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>

        {embeddedTool?.mode === "expanded" ? (
          <section
            className="chat-embedded-tool"
            aria-label={embeddedTool.tool.title}
            style={toolStyle}
          >
            <header className="chat-tool-drag" {...dragHandlers}>
              <button
                type="button"
                onClick={() => setEmbeddedTool(null)}
                aria-label="العودة للمحادثة"
              >
                <ArrowRight className="size-4" />
              </button>
              <div>
                <strong>{embeddedTool.tool.title}</strong>
                <span>مفتوحة داخل نفس محادثة {member.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setEmbeddedTool({ tool: embeddedTool.tool, mode: "inline" })}
                title="تصغير داخل المحادثة"
              >
                <ArrowRight className="size-4" />
                <span>داخل الرسائل</span>
              </button>
            </header>
            <iframe src={`${embeddedTool.tool.to}?embedded=1`} title={embeddedTool.tool.title} />
          </section>
        ) : null}

        {barPanel ? (
          <>
            <button
              type="button"
              aria-label="إغلاق اللوحة"
              onClick={() => setBarPanel(null)}
              className="topbar-sheet-backdrop"
            />
            <section
              className="topbar-sheet"
              style={
                {
                  "--topbar-sheet-anchor-x": `${barPanelAnchor.x}px`,
                  "--topbar-sheet-anchor-top": `${barPanelAnchor.top}px`,
                } as React.CSSProperties
              }
              aria-label={
                barPanel === "apps"
                  ? `تكاملات ${member.name}`
                  : barPanel === "brand"
                    ? "موقع النشاط"
                    : `تشغيل ومتابعة ${member.name}`
              }
            >
              <div className="topbar-sheet-head">
                {barPanel === "apps" ? (
                  <PlugZap className="size-4 text-primary" />
                ) : barPanel === "work" ? (
                  <Bot className="size-4 text-primary" />
                ) : (
                  <Globe className="size-4 text-primary" />
                )}
                <div>
                  <p>
                    {barPanel === "apps"
                      ? `تكاملات ${member.name}`
                      : barPanel === "brand"
                        ? "موقع النشاط"
                       : `تشغيل ومتابعة ${member.name}`}
                  </p>
                  <span>
                    {barPanel === "apps"
                      ? "اربط الحسابات التي يحتاجها من هنا مباشرة"
                      : barPanel === "brand"
                        ? "المصادر التي يقرأها ونبرة كتابته"
                         : "كل ما يستطيع تنفيذه ومتابعته"}
                  </span>
                </div>
                <button type="button" onClick={() => setBarPanel(null)} aria-label="إغلاق">
                  <X className="size-4" />
                </button>
              </div>

              {barPanel === "apps" ? (
                <div className="mt-1">
                  {member.apps.map((provider) => {
                    const row = owned.find((i) => i.provider === provider);
                    const connected = row?.status === "connected";
                    return (
                      <div key={provider} className="topbar-app-row">
                        <AppIcon name={provider} className="size-5 shrink-0" />
                        <span className="truncate">{appLabel(provider)}</span>
                        {connected ? (
                          <span className="is-connected">متصل</span>
                        ) : (
                          <span className="ms-auto shrink-0">
                            <ConnectNow
                              workspaceId={workspace?.id}
                              provider={provider}
                              size="sm"
                              label="اربط"
                            />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : barPanel === "brand" ? (
                <div className="mt-3 space-y-3">
                  {workspace ? (
                    <>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-xs font-bold">
                        <span>استخدام موقع النشاط في ردود كل الموظفين</span>
                        <input
                          type="checkbox"
                          checked={workspace.use_website_context}
                          disabled={updateWorkspace.isPending}
                          onChange={(event) => updateWorkspace.mutate({ id: workspace.id, patch: { use_website_context: event.target.checked } })}
                          className="size-4 accent-primary"
                        />
                      </label>
                      <BusinessProfileCard workspaceId={workspace.id} website={workspace.website} profile={workspace.profile as never} compact className="rounded-lg p-3 sm:p-3" />
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="chat-work-sheet">
                  <div className="chat-work-links" aria-label="أدوات التشغيل الأساسية">
                    {WORK_TOOLS.filter((tool) => (!tool.sonnyOnly || id === "sonny") && (!tool.employeeOnly || tool.employeeOnly === id)).map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <article key={tool.id} className="chat-work-card">
                          <span className="chat-work-card-icon">
                            <Icon className="size-4" />
                          </span>
                          <div>
                            <strong>{tool.title}</strong>
                            <small>{tool.description}</small>
                          </div>
                          <div className="chat-work-card-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setEmbeddedTool({ tool, mode: "inline" });
                                setBarPanel(null);
                              }}
                            >
                              داخل المحادثة
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEmbeddedTool({ tool, mode: "expanded" });
                                setBarPanel(null);
                              }}
                              aria-label={`فتح صفحة ${tool.title} داخل المحادثة`}
                              title="فتح بحجم كامل داخل المحادثة"
                            >
                              <ExternalLink className="size-3.5" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="chat-work-actions">
                    <p>إجراءات {member.name} المباشرة</p>
                    <ActionPanel
                      employeeId={id}
                      workspaceId={workspace?.id}
                      connected={(integrations ?? [])
                        .filter((integration) => integration.status === "connected")
                        .map((integration) => integration.provider)}
                    />
                  </div>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
