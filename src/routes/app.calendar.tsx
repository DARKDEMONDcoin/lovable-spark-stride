import { friendlyPublishError } from "@/lib/publish-errors";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeamAgenda, setArticleDate, type AgendaItem } from "@/lib/team-agenda.functions";
import { AgendaChip, AgendaItemDialog, TeamAgendaList } from "@/components/app/TeamAgenda";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Lightbulb,
  Loader2,
  Pencil,
  Eye,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Video,
  X,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PlatformPreviewDialog } from "@/components/app/PlatformPreview";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { Portrait } from "@/components/site/Portrait";
import { getMember } from "@/data/team";
import { useConnectedAccounts, useSocialPosts, useWorkspace, type SocialPost } from "@/lib/data";
import {
  generateCalendarPost,
  learnFromPerformanceNow,
  planContentCalendar,
  publishCalendarPost,
  updateCalendarPost,
} from "@/lib/content-calendar.functions";
import { cn } from "@/lib/utils";
import { BrandLoader } from "@/components/site/BrandLoader";

export const Route = createFileRoute("/app/calendar")({
  head: () => ({
    meta: [
      { title: "تقويم المحتوى | سهل" },
      {
        name: "description",
        content: "خطة محتوى شهرية جاهزة بالنصوص والصور من سِراج — راجع، عدّل، وانشر بضغطة.",
      },
      { property: "og:title", content: "تقويم المحتوى | سهل" },
      {
        property: "og:description",
        content: "شهر كامل من المنشورات بالصور — يبقى لك زر النشر فقط.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { employee?: EmployeeLens } =>
    typeof s["employee"] === "string" && s["employee"] in LENSES
      ? { employee: s["employee"] as EmployeeLens }
      : {},
  component: CalendarPage,
});

type EmployeeLens = "sonny" | "dana" | "nour" | "eva" | "sam" | "adam";
/** عدسة تقويم كل موظف: ما يظهر فيه يطابق مخرجات تخصصه فقط. */
const LENSES: Record<
  EmployeeLens,
  { view: "content" | "meetings"; title: string; lead: string; empty: string; kinds?: AgendaItem["kind"][] }
> = {
  sonny: {
    view: "content",
    title: "تقويم منشورات سِراج",
    lead: "منشورات السوشيال: أفكار، مسودات للمراجعة، مجدول ومنشور — اسحب لتعيد الجدولة.",
    empty: "اطلب من سِراج خطة محتوى وستظهر منشوراتها هنا يوماً بيوم.",
  },
  dana: {
    view: "content",
    title: "تقويم تصاميم دانة",
    lead: "كل منشور بصورة أو تصميم من دانة، بموعد نشره ومعاينته.",
    empty: "اطلب من دانة تصميماً لمنشور قادم وسيظهر هنا.",
  },
  nour: {
    view: "content",
    title: "التقويم التحريري لنور",
    lead: "مقالات المدونة وتشغيلات السيو المتكررة — اسحب أي مقال لتحديد موعد نشره.",
    empty: "اطلب من نور مقالاً وحدد له موعداً بالسحب إلى أي يوم.",
  },
  eva: {
    view: "meetings",
    title: "أجندة أمَل",
    lead: "مواعيدك واجتماعاتك من تقويم جوجل، ومهام المتابعة المتكررة.",
    empty: "اربط تقويم جوجل لتظهر مواعيدك هنا وتجهّز لها أمَل.",
    kinds: ["meeting", "cadence"],
  },
  sam: {
    view: "meetings",
    title: "أجندة مبيعات سالم",
    lead: "اجتماعات العملاء والعروض ومواعيد المتابعة البيعية.",
    empty: "عند ربط التقويم تظهر هنا اجتماعات العملاء ومتابعاتها.",
    kinds: ["meeting", "cadence"],
  },
  adam: {
    view: "meetings",
    title: "تقويم تقارير آدم",
    lead: "مواعيد التقارير الدورية وقراءات الأداء القادمة.",
    empty: "اطلب من آدم تقريراً أسبوعياً وسيظهر موعده القادم هنا.",
    kinds: ["cadence"],
  },
};

type Meta = {
  title?: string;
  pillar?: string;
  hook?: string;
  angle?: string;
  error?: string;
  batch?: string;
  videoUrl?: string;
  video_url?: string;
  attachments?: Array<{ url?: string; type?: string }>;
};
type Post = SocialPost & {
  meta?: Meta | null;
  metrics?: { likes?: number; comments?: number } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  idea: { label: "فكرة", cls: "bg-amber/15 text-amber" },
  draft: { label: "جاهز للمراجعة", cls: "bg-sky/15 text-sky" },
  scheduled: { label: "مجدول", cls: "bg-jade/12 text-jade-deep" },
  published: { label: "منشور", cls: "bg-foreground text-background" },
  failed: { label: "فشل", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "ملغى", cls: "bg-secondary text-muted-foreground" },
};

const PROVIDERS = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest"];
const DAYS_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const postTitle = (post: Post) =>
  post.meta?.title?.trim() ||
  post.body
    .split("\n")
    .find((line) => line.trim())
    ?.trim() ||
  "طلب محتوى بلا عنوان";
const videoOf = (post: Post) => {
  const direct = post.meta?.videoUrl ?? post.meta?.video_url;
  if (direct) return direct;
  return post.meta?.attachments?.find((item) => item.type === "video" && item.url)?.url ?? null;
};

function CalendarPage() {
  const { data: workspace } = useWorkspace();
  const { data: posts, isLoading } = useSocialPosts(workspace?.id);
  const { data: accounts } = useConnectedAccounts(workspace?.id);
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["social-posts", workspace?.id] });

  const plan = useServerFn(planContentCalendar);
  const gen = useServerFn(generateCalendarPost);
  const update = useServerFn(updateCalendarPost);
  const publish = useServerFn(publishCalendarPost);
  const learn = useServerFn(learnFromPerformanceNow);

  const connected = new Set((accounts ?? []).map((a) => a.provider));
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    current?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // نموذج الخطة
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [perDay, setPerDay] = useState(1);
  const [providers, setProviders] = useState<string[]>(["instagram"]);
  const [topic, setTopic] = useState("");
  const [withImage, setWithImage] = useState(true);

  const { employee } = Route.useSearch();
  const lens = employee ? LENSES[employee] : null;
  const [view, setView] = useState<"content" | "meetings">(lens?.view ?? "content");
  const [openItem, setOpenItem] = useState<AgendaItem | null>(null);
  const [dayOpen, setDayOpen] = useState<Date | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [member, setMember] = useState<"all" | "sonny" | "dana" | "nour">(
    employee === "sonny" || employee === "dana" || employee === "nour" ? employee : "all",
  );
  useEffect(() => {
    setView(lens?.view ?? "content");
    setMember(employee === "sonny" || employee === "dana" || employee === "nour" ? employee : "all");
  }, [employee, lens?.view]);
  const [span, setSpan] = useState<"month" | "week">("month");
  const [weekIdx, setWeekIdx] = useState(() => {
    const d = new Date();
    return Math.floor((new Date(d.getFullYear(), d.getMonth(), 1).getDay() + d.getDate() - 1) / 7);
  });
  const agendaFn = useServerFn(getTeamAgenda);
  const setArticleDateFn = useServerFn(setArticleDate);
  const agendaRange = useMemo(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [cursor]);
  const agenda = useQuery({
    queryKey: ["team-agenda", workspace?.id, agendaRange.from],
    enabled: !!workspace?.id,
    staleTime: 60_000,
    queryFn: () => agendaFn({ data: { workspaceId: workspace!.id, ...agendaRange } }),
  });
  const agendaItems = agenda.data?.items ?? [];
  const articles = agendaItems.filter((i) => i.kind === "article");
  const meetings = agendaItems.filter(
    (i) =>
      i.kind !== "article" &&
      (!employee || (i.employeeId === employee && (!lens?.kinds || lens.kinds.includes(i.kind)))),
  );
  const articlesByDay = useMemo(() => {
    const m: Record<string, AgendaItem[]> = {};
    if (member === "all" || member === "nour")
      for (const a of articles) (m[dayKey(new Date(a.start))] ??= []).push(a);
    return m;
  }, [articles, member]);

  const allPosts = (posts ?? []) as Post[];
  const list = useMemo(
    () =>
      member === "all"
        ? allPosts
        : member === "nour"
          ? []
          : allPosts.filter((p) =>
              member === "dana" ? p.employee_id === "dana" || Boolean(p.image_url) : p.employee_id !== "dana",
            ),
    [allPosts, member],
  );
  const byDay = useMemo(() => {
    const m: Record<string, Post[]> = {};
    for (const p of list) (m[dayKey(new Date(p.scheduled_at))] ??= []).push(p);
    return m;
  }, [list]);

  const grid = useMemo(() => {
    const first = new Date(cursor);
    const startOffset = first.getDay(); // الأحد = 0
    const cells: (Date | null)[] = Array.from({ length: startOffset }, () => null);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d += 1)
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [cursor]);

  const ideas = list.filter((p) => p.status === "idea");
  const drafts = list.filter((p) => p.status === "draft");
  const failed = list.filter((p) => p.status === "failed");
  const selectedPost = list.find((p) => p.id === selected) ?? null;
  const todayKey = dayKey(new Date());

  const generateAll = async (targets: Post[]) => {
    if (!workspace) return;
    setError(null);
    setProgress({ done: 0, total: targets.length });
    let done = 0;
    for (const t of targets) {
      setProgress({ done, total: targets.length, current: t.meta?.title ?? t.provider });
      try {
        await gen({ data: { workspaceId: workspace.id, id: t.id, withImage } });
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر توليد منشور");
      }
      done += 1;
      setProgress({ done, total: targets.length });
      invalidate();
    }
    setProgress(null);
  };

  const planMutation = useMutation({
    mutationFn: () =>
      plan({
        data: {
          workspaceId: workspace!.id,
          days,
          perDay,
          providers,
          topic: topic.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
        },
      }),
    onSuccess: async () => {
      setPlanOpen(false);
      invalidate();
      const fresh = await qc.fetchQuery<Post[]>({ queryKey: ["social-posts", workspace?.id] });
      const newIdeas = (fresh ?? []).filter((p) => p.status === "idea");
      await generateAll(newIdeas);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "تعذّر التخطيط"),
  });

  const learnMutation = useMutation({
    mutationFn: () => learn({ data: { workspaceId: workspace!.id } }),
    onError: (e) => setError(e instanceof Error ? e.message : "تعذّر التعلّم"),
  });

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تنفيذ الطلب");
    } finally {
      setBusy(null);
    }
  };

  /** سحب منشور إلى يوم آخر: يحتفظ بالساعة نفسها، ولا ينقل إلى الماضي ولا يحرّك المنشور. */
  const moveToDay = async (id: string, day: Date) => {
    const post = allPosts.find((p) => p.id === id);
    if (!post || !workspace || post.status === "published") return;
    const old = new Date(post.scheduled_at);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), old.getHours(), old.getMinutes());
    if (dayKey(next) === dayKey(old)) return;
    if (next.getTime() < Date.now() - 60_000) {
      setError("لا يمكن نقل منشور إلى وقت مضى — اختر اليوم أو يوماً قادماً.");
      return;
    }
    // تحديث متفائل حتى يتحرك الكرت فوراً، ثم يُثبَّت من الخادم.
    qc.setQueryData<Post[]>(["social-posts", workspace.id], (cur) =>
      (cur ?? []).map((p) => (p.id === id ? { ...p, scheduled_at: next.toISOString() } : p)),
    );
    await act(id, () =>
      update({ data: { workspaceId: workspace.id, id, action: "edit", scheduledAt: next.toISOString() } }),
    );
  };

  /** سحب مقال نور إلى يوم = موعد نشر مخطط (الساعة ١٠ صباحاً). */
  const moveArticle = async (taskId: string, day: Date) => {
    if (!workspace) return;
    const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0);
    setError(null);
    // تحديث متفائل: يتحرك المقال فوراً ثم يُثبَّت من الخادم.
    qc.setQueryData<{ items: AgendaItem[] }>(["team-agenda", workspace.id, agendaRange.from], (cur) =>
      cur
        ? { ...cur, items: cur.items.map((i) => (i.taskId === taskId ? { ...i, start: date.toISOString() } : i)) }
        : cur,
    );
    try {
      await setArticleDateFn({ data: { workspaceId: workspace.id, taskId, date: date.toISOString() } });
      await qc.invalidateQueries({ queryKey: ["team-agenda"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تحديد موعد المقال");
    }
  };

  const retryFailed = async () => {
    if (!workspace) return;
    if (!window.confirm(`إعادة جدولة ${failed.length} منشور فاشل؟`)) return;
    const skipped = new Set<string>();
    for (const f of failed) {
      if (!connected.has(f.provider)) {
        skipped.add(appLabel(f.provider));
        continue;
      }
      await act(f.id, () => update({ data: { workspaceId: workspace.id, id: f.id, action: "approve" } }));
    }
    if (skipped.size)
      setError(`لم نُعد محاولة منشورات ${[...skipped].join("، ")} لأن الحساب غير مربوط — اربطه أولاً.`);
  };

  const approveAll = async () => {
    if (!workspace) return;
    if (!window.confirm(`اعتماد ${drafts.length} منشور للنشر في مواعيدها؟`)) return;
    const skipped = new Set<string>();
    for (const d of drafts) {
      if (!connected.has(d.provider)) {
        skipped.add(appLabel(d.provider));
        continue;
      }
      await act(d.id, () =>
        update({ data: { workspaceId: workspace.id, id: d.id, action: "approve" } }),
      );
    }
    if (skipped.size)
      setError(`لم نعتمد منشورات ${[...skipped].join("، ")} لأن الحساب غير مربوط — اربطه أولاً.`);
  };

  const weekCount = grid.length / 7;
  const shownCells = span === "week" ? grid.slice(Math.min(weekIdx, weekCount - 1) * 7, Math.min(weekIdx, weekCount - 1) * 7 + 7) : grid;
  const goPrev = () => {
    if (span === "week" && weekIdx > 0) return setWeekIdx(weekIdx - 1);
    const prev = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    setCursor(prev);
    if (span === "week") {
      const cells = prev.getDay() + new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
      setWeekIdx(Math.ceil(cells / 7) - 1);
    }
  };
  const goNext = () => {
    if (span === "week" && weekIdx < weekCount - 1) return setWeekIdx(weekIdx + 1);
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    setCursor(next);
    if (span === "week") setWeekIdx(0);
  };
  const goToday = () => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    setCursor(first);
    setWeekIdx(Math.floor((first.getDay() + d.getDate() - 1) / 7));
  };

  const monthLabel = cursor.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
  const monthPosts = useMemo(
    () =>
      list
        .filter((post) => {
          const date = new Date(post.scheduled_at);
          return (
            date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth()
          );
        })
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [list, cursor],
  );
  const siraj = getMember("sonny");

  return (
    <AppShell
      title={lens?.title ?? "تقويم الفريق"}
      lead={lens?.lead ?? "كل ما يُنشر للجمهور، وكل مواعيدك وأعمالك — كلٌّ حسب موظفه"}
      actions={
        lens?.view === "meetings" ? undefined : <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => learnMutation.mutate()}
            disabled={!workspace || learnMutation.isPending}
            title="يقرأ أداء منشوراتك الحقيقية ويتعلّم ما ينجح"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-bold hover:bg-secondary disabled:opacity-50"
          >
            {learnMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <TrendingUp className="size-4" />
            )}
            تعلّم من الأداء
          </button>
          <button
            onClick={() => setPlanOpen(true)}
            disabled={!workspace || Boolean(progress)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-bold text-background disabled:opacity-50"
          >
            <Sparkles className="size-4" /> خطّط لي المحتوى
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
          <span>
            {error}
            {/مربوط|اربط|ربط/.test(error) ? (
              <>
                {" "}
                <Link to="/app/integrations" className="underline underline-offset-4">
                  اربط الحساب الآن ←
                </Link>
              </>
            ) : null}
          </span>
          <button onClick={() => setError(null)} aria-label="إغلاق">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {learnMutation.data ? (
        <section className="mb-4 rounded-3xl border border-jade/30 bg-jade/6 p-5">
          <p className="flex items-center gap-2 text-sm font-black">
            <TrendingUp className="size-4 text-jade-deep" /> ما تعلّمه سِراج من{" "}
            {learnMutation.data.analyzed} منشوراً
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.68rem] font-bold text-muted-foreground">
              {learnMutation.data.source === "live"
                ? "من حساباتك المربوطة"
                : learnMutation.data.source === "internal"
                  ? "من منشورات سهل"
                  : "لا بيانات بعد"}
            </span>
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {learnMutation.data.summary}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            حُفظ في «عقل العلامة» وسيُطبَّق تلقائياً في كل منشور قادم.
          </p>
        </section>
      ) : null}

      {progress ? (
        <section className="mb-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="size-10 shrink-0 overflow-hidden rounded-2xl">
              {siraj ? <Portrait memberId="sonny" name={siraj.name} className="size-full" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">
                سِراج يكتب ويصمّم… {progress.done}/{progress.total}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {progress.current ? `الآن: ${progress.current}` : "جارٍ التجهيز"}
              </p>
            </div>
            <Loader2 className="size-5 animate-spin text-jade" />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-jade transition-all"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
        </section>
      ) : null}

      {lens && employee ? (
        <EmployeeLensBar employee={employee} lens={lens} count={lens.view === "meetings" ? meetings.length : employee === "nour" ? articles.length : list.length} />
      ) : null}
      {/* تبويب نوع التقويم */}
      <div className={cn("mb-4 flex flex-wrap items-center gap-2", lens && "hidden")}>
        <div role="tablist" className="inline-flex rounded-xl border border-border bg-secondary/40 p-1">
          {(
            [
              ["content", "محتوى ونشر", "سِراج · دانة · نور"],
              ["meetings", "مواعيد وأعمال", "أمَل · سالم · آدم"],
            ] as const
          ).map(([id, label, who]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-start text-sm font-bold transition-colors",
                view === id ? "bg-card shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="block text-[0.62rem] font-medium text-muted-foreground">{who}</span>
            </button>
          ))}
        </div>
        {view === "content" ? (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ["all", "الكل"],
                ["sonny", "منشورات سِراج"],
                ["dana", "تصاميم دانة"],
                ["nour", `مقالات نور${articles.length ? ` (${articles.length})` : ""}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMember(id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-bold",
                  member === id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {view === "meetings" ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={goPrev}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-border hover:bg-secondary"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="size-5" />
            </button>
            <h2 className="font-display text-lg font-black">{monthLabel}</h2>
            <button
              onClick={goNext}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-border hover:bg-secondary"
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="size-5" />
            </button>
          </div>
          <TeamAgendaList
            items={meetings}
            loading={agenda.isLoading}
            calendarConnected={agenda.data?.calendarConnected ?? false}
            calendarError={agenda.data?.calendarError ?? (agenda.error ? "تعذّر تحميل أجندة الفريق." : null)}
          />
        </section>
      ) : (
      <>
      {/* شريط الحالة */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Stat label="أفكار" n={ideas.length} cls="bg-amber/15 text-amber" />
        <Stat label="جاهز للمراجعة" n={drafts.length} cls="bg-sky/15 text-sky" />
        <Stat
          label="مجدول"
          n={list.filter((p) => p.status === "scheduled").length}
          cls="bg-jade/12 text-jade-deep"
        />
        <Stat
          label="منشور"
          n={list.filter((p) => p.status === "published").length}
          cls="bg-foreground text-background"
        />
        <span className="flex-1" />
        {drafts.length ? (
          <button
            onClick={() => void approveAll()}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 rounded-full bg-jade px-3 py-1.5 font-bold text-background disabled:opacity-50"
          >
            <CheckCheck className="size-3.5" /> اعتمد {drafts.length} للنشر
          </button>
        ) : null}
        {failed.length ? (
          <button
            onClick={() => void retryFailed()}
            disabled={Boolean(busy)}
            title="يعيد جدولة المنشورات الفاشلة بعد ٥ دقائق على الحسابات المربوطة"
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 font-bold text-destructive disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" /> أعد محاولة {failed.length} فاشل
          </button>
        ) : null}
      </div>
      <p className="-mt-2 mb-3 hidden text-[0.68rem] text-muted-foreground md:block">
        اسحب أي منشور غير منشور إلى يوم آخر لإعادة جدولته بنفس الساعة، واسحب مقالات نور لتحديد موعد نشرها.
      </p>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* الشبكة */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-secondary/35 px-4 py-4 sm:px-5">
            <button
              onClick={goPrev}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-border bg-card hover:bg-secondary"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="min-w-0 text-center">
              <h2 className="truncate font-display text-lg font-black">{monthLabel}</h2>
              <div className="mt-1.5 inline-flex rounded-full border border-border bg-card p-0.5 text-[0.7rem] font-bold">
                {(["month", "week"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpan(s)}
                    className={cn("rounded-full px-3 py-1", span === s ? "bg-foreground text-background" : "text-muted-foreground")}
                  >
                    {s === "month" ? "شهر" : "أسبوع"}
                  </button>
                ))}
              </div>
              <button
                onClick={goToday}
                className="mt-1 inline-flex min-h-9 items-center justify-center px-2 text-xs font-bold text-primary hover:underline"
              >
                العودة إلى اليوم
              </button>
            </div>
            <button
              onClick={goNext}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-border bg-card hover:bg-secondary"
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="size-5" />
            </button>
          </div>
          <div className="hidden overflow-x-auto pb-1 md:block">
            <div className="min-w-[760px] p-3 sm:p-4">
              <div className="grid grid-cols-7 border-b border-border text-center text-[0.68rem] font-bold text-muted-foreground">
                {DAYS_AR.map((d) => (
                  <div key={d} className="py-2.5">
                    {d}
                  </div>
                ))}
              </div>
              {isLoading ? (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <BrandLoader size="sm" />
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {shownCells.map((d, i) => {
                    if (!d)
                      return (
                        <div
                          key={`e${i}`}
                          className={cn("border-b border-s border-border/60 bg-secondary/25", span === "week" ? "min-h-80" : "min-h-36")}
                        />
                      );
                    const k = dayKey(d);
                    const items = byDay[k] ?? [];
                    const dayArticles = articlesByDay[k] ?? [];
                    return (
                      <div
                        key={k}
                        onDragOver={(e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          setDropKey(k);
                        }}
                        onDragLeave={() => setDropKey((cur) => (cur === k ? null : cur))}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropKey(null);
                          const id = dragId;
                          setDragId(null);
                          if (id?.startsWith("art:")) void moveArticle(id.slice(4), d);
                          else if (id) void moveToDay(id, d);
                        }}
                        className={cn(
                          "border-b border-s border-border/60 p-1.5 transition-colors",
                          span === "week" ? "min-h-80" : "min-h-36",
                          k === todayKey && "bg-jade/5",
                          dropKey === k && "bg-primary/10 ring-2 ring-inset ring-primary/40",
                        )}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span
                            className={cn(
                              "grid size-6 place-items-center rounded-full text-[0.68rem] font-bold",
                              k === todayKey ? "bg-jade text-background" : "text-muted-foreground",
                            )}
                          >
                            {d.getDate()}
                          </span>
                          {items.length ? (
                            <span className="text-[0.58rem] font-bold text-muted-foreground">
                              {items.length} محتوى
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          {items.slice(0, span === "week" ? 99 : 2).map((p) => (
                            <div
                              key={p.id}
                              draggable={p.status !== "published"}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setDragId(p.id);
                              }}
                              onDragEnd={() => {
                                setDragId(null);
                                setDropKey(null);
                              }}
                              className={cn(p.status !== "published" && "cursor-grab active:cursor-grabbing")}
                            >
                            <CalendarPostCard
                              post={p}
                              selected={selected === p.id}
                              onSelect={() => setSelected(p.id)}
                            />
                            </div>
                          ))}
                          {span === "month" && items.length > 2 ? (
                            <button
                              type="button"
                              onClick={() => setDayOpen(d)}
                              className="px-1 text-[0.6rem] font-bold text-primary hover:underline"
                            >
                              +{items.length - 2} طلبات أخرى
                            </button>
                          ) : null}
                          {dayArticles.slice(0, span === "week" ? 99 : 2).map((a) => (
                            <div
                              key={a.id}
                              draggable={Boolean(a.taskId)}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setDragId(`art:${a.taskId}`);
                              }}
                              onDragEnd={() => {
                                setDragId(null);
                                setDropKey(null);
                              }}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <AgendaChip item={a} onOpen={setOpenItem} />
                            </div>
                          ))}
                          {span === "month" && dayArticles.length > 2 ? (
                            <button
                              type="button"
                              onClick={() => setDayOpen(d)}
                              className="px-1 text-[0.6rem] font-bold text-coral hover:underline"
                            >
                              +{dayArticles.length - 2} مقالات أخرى
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {monthPosts.map((post) => {
              const date = new Date(post.scheduled_at);
              return (
                <div key={post.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                  <div className="pt-1 text-center">
                    <p className="font-display text-xl font-black">
                      {date.toLocaleDateString("ar-EG", { day: "numeric" })}
                    </p>
                    <p className="text-[0.62rem] font-bold text-muted-foreground">
                      {date.toLocaleDateString("ar-EG", { weekday: "short" })}
                    </p>
                  </div>
                  <CalendarPostCard
                    post={post}
                    selected={selected === post.id}
                    onSelect={() => setSelected(post.id)}
                    mobile
                  />
                </div>
              );
            })}
            {Object.values(articlesByDay).flat().length ? (
              <div className="space-y-1.5 rounded-xl border border-coral/25 bg-coral/5 p-3">
                <p className="text-xs font-black">مقالات نور هذا الشهر</p>
                {Object.values(articlesByDay)
                  .flat()
                  .map((a) => (
                    <AgendaChip key={a.id} item={a} onOpen={setOpenItem} />
                  ))}
              </div>
            ) : null}
            {!isLoading && monthPosts.length === 0 && !Object.keys(articlesByDay).length ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary">
                  <CalendarDays className="size-6 text-ink-soft" />
                </span>
                <p className="mt-3 font-black">تقويمك فارغ</p>
                <p className="mt-1 text-sm text-ink-soft">
                  خطّط محتوى الشهر ليظهر هنا بالصور والعناوين والمواعيد.
                </p>
              </div>
            ) : null}
          </div>
          {!isLoading && list.length === 0 && articles.length === 0 ? (
            <div className="m-4 hidden rounded-xl border border-dashed border-border p-8 text-center md:block">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary">
                <CalendarDays className="size-6 text-ink-soft" />
              </span>
              <p className="mt-3 font-black">تقويمك فارغ</p>
              <p className="mt-1 text-sm text-ink-soft">
                اضغط «خطّط لي المحتوى» وسيجهّز سِراج أسبوعاً أو شهراً كاملاً بالنصوص والصور خلال
                دقائق.
              </p>
            </div>
          ) : null}
        </section>

        {/* اللوحة الجانبية */}
        <aside className="space-y-4">
          {selectedPost ? (
            <SheetOnSmall onClose={() => setSelected(null)}>
            <div
              className="max-xl:fixed max-xl:inset-0 max-xl:z-50 max-xl:overflow-y-auto max-xl:overscroll-contain max-xl:bg-foreground/50 max-xl:p-3 max-xl:pt-14 max-xl:backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelected(null);
              }}
            >
            <PostPanel
              key={selectedPost.id}
              post={selectedPost}
              accountName={workspace?.name ?? null}
              connected={connected.has(selectedPost.provider)}
              busy={busy === selectedPost.id}
              onClose={() => setSelected(null)}
              onGenerate={() =>
                void act(selectedPost.id, () =>
                  gen({
                    data: { workspaceId: workspace!.id, id: selectedPost.id, withImage: true },
                  }),
                )
              }
              onRegenerate={() =>
                void act(selectedPost.id, async () => {
                  await update({
                    data: {
                      workspaceId: workspace!.id,
                      id: selectedPost.id,
                      action: "unapprove",
                      imageUrl: null,
                    },
                  });
                  await gen({
                    data: { workspaceId: workspace!.id, id: selectedPost.id, withImage: true },
                  });
                })
              }
              onApprove={() =>
                void act(selectedPost.id, () =>
                  update({
                    data: { workspaceId: workspace!.id, id: selectedPost.id, action: "approve" },
                  }),
                )
              }
              onUnapprove={() =>
                void act(selectedPost.id, () =>
                  update({
                    data: { workspaceId: workspace!.id, id: selectedPost.id, action: "unapprove" },
                  }),
                )
              }
              onPublish={() =>
                void act(selectedPost.id, () =>
                  publish({ data: { workspaceId: workspace!.id, id: selectedPost.id } }),
                )
              }
              onDelete={() =>
                void act(selectedPost.id, async () => {
                  await update({
                    data: { workspaceId: workspace!.id, id: selectedPost.id, action: "delete" },
                  });
                  setSelected(null);
                })
              }
              onSave={(body, scheduledAt) =>
                void act(selectedPost.id, () =>
                  update({
                    data: {
                      workspaceId: workspace!.id,
                      id: selectedPost.id,
                      action: "edit",
                      body,
                      scheduledAt,
                    },
                  }),
                )
              }
            />
            </div>
            </SheetOnSmall>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="size-12 shrink-0 overflow-hidden rounded-2xl">
                  {siraj ? (
                    <Portrait memberId="sonny" name={siraj.name} className="size-full" />
                  ) : null}
                </span>
                <div>
                  <p className="font-display font-black">سِراج</p>
                  <p className="text-xs text-muted-foreground">مدير السوشيال ميديا</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                اختر منشوراً من التقويم لمعاينته بالصورة، تعديله، اعتماده أو نشره فوراً. أو اطلب مني
                خطة جديدة بمحور معيّن.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-ink-soft">
                <li className="flex gap-2">
                  <Lightbulb className="size-3.5 shrink-0 text-amber" /> فكرة → أكتبها وأصمّم صورتها
                  على هوية علامتك.
                </li>
                <li className="flex gap-2">
                  <Check className="size-3.5 shrink-0 text-sky" /> جاهز → تراجعه وتعتمده، فيُنشر في
                  موعده تلقائياً.
                </li>
                <li className="flex gap-2">
                  <TrendingUp className="size-3.5 shrink-0 text-jade" /> أتعلّم من أداء منشوراتك
                  وأعدّل الخطة تلقائياً.
                </li>
              </ul>
              <Link
                to="/app/chat/$id"
                params={{ id: "sonny" }}
                className="mt-4 inline-flex min-h-10 items-center gap-1.5 px-1 text-sm font-bold text-primary"
              >
                تحدّث مع سِراج
              </Link>
            </section>
          )}
          {!connected.size ? (
            <section className="rounded-3xl border border-amber/40 bg-amber/8 p-4 text-sm">
              <p className="font-black">لا حسابات مربوطة بعد</p>
              <p className="mt-1 text-ink-soft">
                تستطيع التخطيط والمعاينة الآن، وعند النشر سيطلب سِراج ربط المنصة بضغطة واحدة.
              </p>
              <Link
                to="/app/integrations"
                className="mt-2 inline-block text-xs font-bold text-primary"
              >
                اربط إنستجرام/فيسبوك/لينكدإن ←
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
      </>
      )}

      {/* نافذة الخطة */}
      {planOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
          onClick={() => !planMutation.isPending && setPlanOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (providers.length) planMutation.mutate();
            }}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl"
          >
            <h2 className="font-display text-xl font-black">خطة محتوى جديدة</h2>
            <p className="mt-1 text-sm text-ink-soft">
              سيخطّط سِراج الأفكار على أعمدة المحتوى وأفضل الأوقات، ثم يكتب كل منشور ويصمّم صورته.
            </p>

            <p className="mt-4 text-xs font-bold text-muted-foreground">المدة</p>
            <div className="mt-1 flex gap-2">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-bold",
                    days === d
                      ? "border-foreground bg-foreground text-background"
                      : "border-border",
                  )}
                >
                  {d === 7 ? "أسبوع" : d === 14 ? "أسبوعان" : "شهر"}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold text-muted-foreground">منشورات في اليوم</p>
            <div className="mt-1 flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPerDay(n)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-bold",
                    perDay === n
                      ? "border-foreground bg-foreground text-background"
                      : "border-border",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold text-muted-foreground">المنصات</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {PROVIDERS.map((p) => {
                const on = providers.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setProviders(on ? providers.filter((x) => x !== p) : [...providers, p])
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
                      on ? "border-jade bg-jade/10 text-jade-deep" : "border-border",
                    )}
                  >
                    <AppIcon name={p} className="size-3.5" /> {appLabel(p)}
                    {connected.has(p) ? (
                      <span className="size-1.5 rounded-full bg-jade" title="مربوط" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-muted-foreground">
                محور اختياري (عرض، إطلاق، موسم…)
              </span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: عروض رمضان على المنيو الجديد"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withImage}
                onChange={(e) => setWithImage(e.target.checked)}
              />{" "}
              صمّم صورة لكل منشور
            </label>

            <p className="mt-3 text-xs text-muted-foreground">
              سيُنشأ {Math.min(days * perDay, 45)} منشوراً. الكتابة والتصميم يأخذان نحو 20 ثانية
              للمنشور — يمكنك متابعة التقدّم هنا.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanOpen(false)}
                disabled={planMutation.isPending}
                className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-secondary"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={planMutation.isPending || !providers.length}
                className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background disabled:opacity-60"
              >
                {planMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {planMutation.isPending ? "سِراج يخطّط…" : "ابدأ التخطيط"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {dayOpen ? (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-foreground/40 p-3 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setDayOpen(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <p className="font-display font-black">
                {dayOpen.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <button onClick={() => setDayOpen(null)} aria-label="إغلاق اليوم" className="grid size-9 place-items-center rounded-lg hover:bg-secondary">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {(byDay[dayKey(dayOpen)] ?? []).map((p) => (
                <CalendarPostCard
                  key={p.id}
                  post={p}
                  mobile
                  selected={selected === p.id}
                  onSelect={() => {
                    setDayOpen(null);
                    setSelected(p.id);
                  }}
                />
              ))}
              {(articlesByDay[dayKey(dayOpen)] ?? []).map((a) => (
                <AgendaChip
                  key={a.id}
                  item={a}
                  onOpen={(i) => {
                    setDayOpen(null);
                    setOpenItem(i);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {openItem ? <AgendaItemDialog item={openItem} onClose={() => setOpenItem(null)} /> : null}
    </AppShell>
  );
}

function Stat({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 font-bold", cls)}>
      {n} {label}
    </span>
  );
}

function CalendarPostCard({
  post,
  selected,
  onSelect,
  mobile = false,
}: {
  post: Post;
  selected: boolean;
  onSelect: () => void;
  mobile?: boolean;
}) {
  const videoUrl = videoOf(post);
  const title = postTitle(post);
  const status = STATUS[post.status] ?? STATUS["draft"]!;
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group w-full overflow-hidden rounded-lg border bg-background text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card",
        selected
          ? "border-primary ring-2 ring-primary/15"
          : "border-border/70 hover:border-primary/50",
      )}
      title={title}
    >
      <span
        className={cn(
          "relative block overflow-hidden bg-secondary",
          mobile ? "aspect-[2/1]" : "aspect-video",
        )}
      >
        {post.image_url ? (
          <img
            src={post.image_url}
            alt={`معاينة ${title}`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : videoUrl ? (
          <video
            src={videoUrl}
            className="size-full object-cover"
            muted
            preload="metadata"
            aria-label={`فيديو ${title}`}
          />
        ) : (
          <span className={cn("grid size-full place-items-center", status.cls)}>
            <AppIcon name={post.provider} className="size-5" />
          </span>
        )}
        {videoUrl ? (
          <span
            className="absolute bottom-1 end-1 grid size-6 place-items-center rounded-full bg-foreground/85 text-background shadow-card"
            title="يتضمن فيديو"
          >
            <Play className="size-3 fill-current" />
          </span>
        ) : null}
        {post.image_url && videoUrl ? (
          <span className="absolute start-1 top-1 rounded-md bg-background/90 px-1.5 py-0.5 text-[0.52rem] font-black text-foreground">
            صورة + فيديو
          </span>
        ) : null}
      </span>
      <span className={cn("block", mobile ? "p-3" : "p-1.5")}>
        <span
          className={cn(
            "line-clamp-2 font-black leading-snug",
            mobile ? "min-h-10 text-sm" : "min-h-7 text-[0.62rem]",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "mt-1 flex items-center justify-between gap-1 text-muted-foreground",
            mobile ? "text-xs" : "text-[0.54rem]",
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-1">
            <AppIcon name={post.provider} className="size-3 shrink-0" />
            <span className="truncate">{appLabel(post.provider)}</span>
          </span>
          <span className="shrink-0">
            {new Date(post.scheduled_at).toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
        <span
          className={cn(
            "mt-1 inline-flex rounded px-1.5 py-0.5 text-[0.52rem] font-bold",
            status.cls,
          )}
        >
          {status.label}
        </span>
      </span>
    </button>
  );
}

function PostPanel(props: {
  post: Post;
  connected: boolean;
  busy: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onUnapprove: () => void;
  onPublish: () => void;
  onDelete: () => void;
  onSave: (body: string, scheduledAt?: string) => void;
  accountName?: string | null;
}) {
  const { post } = props;
  const [editing, setEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [body, setBody] = useState(post.body);
  const [when, setWhen] = useState(() => toLocalInput(post.scheduled_at));
  const st = STATUS[post.status] ?? STATUS["draft"]!;
  const isIdea = post.status === "idea";
  const videoUrl = videoOf(post);
  const title = postTitle(post);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card xl:sticky xl:top-24">
      {post.image_url && videoUrl ? (
        <div className="grid grid-cols-2 gap-px bg-border">
          <img
            src={post.image_url}
            alt={`صورة ${title}`}
            className="aspect-square size-full object-cover"
          />
          <div className="relative aspect-square overflow-hidden bg-foreground">
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="size-full object-cover"
              aria-label={`فيديو ${title}`}
            />
            <span className="pointer-events-none absolute end-2 top-2 inline-flex items-center gap-1 rounded-md bg-foreground/80 px-2 py-1 text-[0.62rem] font-bold text-background">
              <Video className="size-3" /> فيديو
            </span>
          </div>
        </div>
      ) : videoUrl ? (
        <video
          src={videoUrl}
          controls
          preload="metadata"
          className="aspect-square w-full bg-foreground object-contain"
          aria-label={`فيديو ${title}`}
        />
      ) : post.image_url ? (
        <img
          src={post.image_url}
          alt={`صورة ${title}`}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <div className="grid aspect-[4/2] place-items-center bg-secondary/60 text-muted-foreground">
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImageIcon className="size-6" /> {isIdea ? "الصورة تُصمَّم عند الكتابة" : "بلا صورة"}
          </span>
        </div>
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <AppIcon name={post.provider} className="size-4" /> {appLabel(post.provider)}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 font-bold", st.cls)}>{st.label}</span>
          {post.meta?.pillar ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-bold text-muted-foreground">
              {post.meta.pillar}
            </span>
          ) : null}
          <button
            onClick={props.onClose}
            className="ms-auto rounded-lg p-1 hover:bg-secondary"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>
        {post.body.trim() ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5"
          >
            <Eye className="size-4" /> معاينة بشكل {appLabel(post.provider)}
          </button>
        ) : null}
        <PlatformPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          accountName={props.accountName ?? null}
          post={{
            provider: post.provider,
            body: editing ? body : post.body,
            image_url: post.image_url,
            video_url: videoUrl,
            scheduled_at: post.scheduled_at,
          }}
        />
        <div className="mt-4">
          <p className="text-[0.65rem] font-black text-primary">عنوان الطلب</p>
          <h2 className="mt-1 font-display text-base font-black leading-relaxed">{title}</h2>
        </div>
        {post.meta?.error ? (
          <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
            {post.meta.error}
          </p>
        ) : null}
        {post.last_error ? (
          <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
            {friendlyPublishError(post.last_error)}
          </p>
        ) : null}
        {post.metrics?.likes != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            الأداء: {post.metrics.likes} إعجاب · {post.metrics.comments ?? 0} تعليق
          </p>
        ) : null}

        {editing ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed"
            />
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              dir="ltr"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  props.onSave(body, when ? new Date(when).toISOString() : undefined);
                  setEditing(false);
                }}
                className="flex-1 rounded-xl bg-foreground py-2 text-sm font-bold text-background"
              >
                حفظ
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-xl px-4 py-2 text-sm font-bold hover:bg-secondary"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {post.body}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(post.scheduled_at).toLocaleString("ar-EG", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          </>
        )}

        {post.status !== "published" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {isIdea ? (
              <Btn
                primary
                onClick={props.onGenerate}
                busy={props.busy}
                icon={Sparkles}
                className="col-span-2"
              >
                اكتب وصمّم الآن
              </Btn>
            ) : null}
            {post.status === "draft" || post.status === "failed" ? (
              <Btn
                primary
                onClick={props.onApprove}
                busy={props.busy}
                icon={post.status === "failed" ? RefreshCw : Check}
                title={props.connected ? "" : "سيطلب ربط الحساب"}
              >
                {post.status === "failed" ? "أعد المحاولة" : "اعتمد للنشر"}
              </Btn>
            ) : null}
            {post.status === "scheduled" ? (
              <Btn onClick={props.onUnapprove} busy={props.busy} icon={X}>
                ألغِ الجدولة
              </Btn>
            ) : null}
            {!isIdea ? (
              <Btn
                primary={post.status === "scheduled"}
                onClick={() => {
                  if (window.confirm("سيُنشر هذا المنشور فوراً على المنصة. متأكد؟")) props.onPublish();
                }}
                busy={props.busy}
                icon={Send}
              >
                انشر الآن
              </Btn>
            ) : null}
            {!isIdea ? (
              <Btn onClick={() => setEditing(true)} icon={Pencil}>
                عدّل
              </Btn>
            ) : null}
            {!isIdea ? (
              <Btn onClick={props.onRegenerate} busy={props.busy} icon={RefreshCw}>
                أعد التوليد
              </Btn>
            ) : null}
            <Btn
              onClick={() => {
                if (window.confirm("حذف هذا المنشور نهائياً؟")) props.onDelete();
              }}
              icon={Trash2}
              className="col-span-2 text-coral"
            >
              احذف
            </Btn>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-xs text-jade-deep">نُشر بنجاح ✓</p>
            {post.remote_ref?.startsWith("http") ? (
              <a
                href={post.remote_ref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Eye className="size-3.5" /> شاهده على {appLabel(post.provider)}
              </a>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function Btn({
  children,
  onClick,
  busy,
  icon: Icon,
  primary,
  className,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  icon: typeof Send;
  primary?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60",
        primary ? "bg-foreground text-background" : "border border-border hover:bg-secondary",
        className,
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
      {children}
    </button>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** على الهاتف والتابلت تُعرض تفاصيل المنشور كنافذة فوق الصفحة (خارج أي عنصر متحرك). */
function SheetOnSmall({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!small) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [small, onClose]);
  return small ? createPortal(children, document.body) : <>{children}</>;
}

function EmployeeLensBar({ employee, lens, count }: { employee: EmployeeLens; lens: (typeof LENSES)[EmployeeLens]; count: number }) {
  const m = getMember(employee);
  return (
    <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
      <span className="size-11 shrink-0 overflow-hidden rounded-2xl">
        {m ? <Portrait memberId={employee} name={m.name} className="size-full" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{lens.title}</p>
        <p className="text-xs text-muted-foreground">
          {count ? `${count} عنصر هذا الشهر من ${m?.name ?? "الموظف"}` : lens.empty}
        </p>
      </div>
      <Link to="/app/chat/$id" params={{ id: employee }} className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary">
        اطلب من {m?.name ?? "الموظف"}
      </Link>
      <Link to="/app/calendar" className="rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary">
        تقويم الفريق كله
      </Link>
    </section>
  );
}
