import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, CalendarClock, Clock3, Gavel, Lightbulb, ListChecks, Send, Workflow, CheckCircle2, Inbox, Loader2, MessageCircle, Sparkles, Users } from "lucide-react";

import { Portrait } from "@/components/site/Portrait";
import { PersonAvatar } from "@/components/app/PersonAvatar";
import { getMember, team } from "@/data/team";
import type { Tables } from "@/integrations/supabase/types";
import { useTasks } from "@/lib/data";
import { splitReview } from "@/lib/task-freshness";
import { cn } from "@/lib/utils";

type WorkItem = Tables<"collaboration_tasks">;
type Project = Tables<"collaboration_projects">;
type Person = { userId: string; name: string; avatar?: string | null; role: string };

/** «النهاردة»: إجابة واحدة على سؤال «فريقك عمل إيه، ومستني منك إيه؟». */
export function WorkspaceToday({ tasks, projects, people, meId, ownWorkspaceId, isOwnSpace, onOpenProject }: {
  tasks: WorkItem[];
  projects: Project[];
  people: Person[];
  meId: string | null | undefined;
  ownWorkspaceId?: string | undefined;
  isOwnSpace: boolean;
  onOpenProject: (id: string) => void;
}) {
  const { data: approvals } = useTasks(isOwnSpace ? ownWorkspaceId : undefined);
  const pendingApprovals = isOwnSpace ? splitReview((approvals ?? []).filter((t) => t.status === "review")).live : [];
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
  const open = tasks.filter((t) => t.status !== "done");
  const aiReady = open.filter((t) => t.ai_employee_id && t.ai_status === "done");
  const aiFailed = open.filter((t) => t.ai_employee_id && t.ai_status === "failed");
  const aiRunning = open.filter((t) => t.ai_status === "running");
  const myDue = open.filter((t) => t.assignee_id === meId && t.due_date && t.due_date <= soon);
  const weekAgo = Date.now() - 7 * 86400_000;
  const doneWeek = tasks.filter((t) => t.status === "done" && new Date(t.updated_at).getTime() > weekAgo).length;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
  const waitingCount = pendingApprovals.length + aiReady.length + aiFailed.length + myDue.length;

  const row = (t: WorkItem, note: string, tone?: "late" | "fail") => (
    <li key={t.id}>
      <button type="button" onClick={() => onOpenProject(t.project_id)} className="flex w-full items-center gap-3 py-3 text-start hover:text-primary">
        {t.ai_employee_id ? <EmployeeDot id={t.ai_employee_id} /> : <CalendarClock className="size-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-bold">{t.title}</span>
          <span className="text-xs text-muted-foreground">{projectName(t.project_id)}</span>
        </span>
        <span className={cn("shrink-0 text-xs font-bold", tone === "late" || tone === "fail" ? "text-destructive" : "text-primary")}>{note}</span>
      </button>
    </li>
  );

  return (
    <section className="mt-7 space-y-6" aria-label="النهاردة">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Inbox} label="مستني قرارك" value={waitingCount} urgent={waitingCount > 0} />
        <Stat icon={Loader2} label="موظفون يعملون الآن" value={aiRunning.length} />
        <Stat icon={CheckCircle2} label="أُنجز هذا الأسبوع" value={doneWeek} />
      </div>

      <div className="rounded-md border border-border p-5">
        <h3 className="flex items-center gap-2 font-display text-lg font-black"><Inbox className="size-5 text-primary" /> مستني منك</h3>
        {waitingCount === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا شيء ينتظرك الآن. اطلب عملاً جديداً من أي موظف 👇</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {pendingApprovals.length > 0 && (
              <li>
                <Link to="/app/approvals" className="flex items-center gap-3 py-3 hover:text-primary">
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  <span className="flex-1 text-sm font-bold">{pendingApprovals.length} عمل جاهز من الموظفين ينتظر موافقتك قبل النشر أو الإرسال</span>
                  <ArrowLeft className="size-4" />
                </Link>
              </li>
            )}
            {aiReady.map((t) => row(t, `جاهز من ${getMember(t.ai_employee_id ?? "")?.name ?? "الموظف"} — راجعه`))}
            {aiFailed.map((t) => row(t, "تعثّر — أعد المحاولة", "fail"))}
            {myDue.map((t) => row(t, t.due_date! < today ? "متأخرة" : t.due_date === today ? "اليوم" : "قريباً", t.due_date! < today ? "late" : undefined))}
          </ul>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-border p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-black"><Sparkles className="size-5 text-primary" /> فريقك الرقمي</h3>
          <ul className="mt-3 divide-y divide-border">
            {team.map((m) => {
              const mineRunning = aiRunning.filter((t) => t.ai_employee_id === m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <EmployeeDot id={m.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{m.name} <span className="font-normal text-muted-foreground">· {m.role}</span></span>
                    <span className="block truncate text-xs text-muted-foreground">{mineRunning.length ? `يعمل على: ${mineRunning[0]?.title}` : "متاح"}</span>
                  </span>
                  <Link to="/app/chat/$id" params={{ id: m.id }} aria-label={`تحدث مع ${m.name}`} className="grid size-8 place-items-center rounded-md text-primary hover:bg-secondary"><MessageCircle className="size-4" /></Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-md border border-border p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-black"><Users className="size-5 text-primary" /> فريقك البشري</h3>
          {people.length <= 1 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">أنت وحدك هنا الآن. ادعُ زميلاً من زر «دعوة شخص» لتتشاركوا المشاريع.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {people.map((p) => {
                const theirs = open.filter((t) => t.assignee_id === p.userId);
                return (
                  <li key={p.userId} className="flex items-center gap-3 py-2.5">
                    <PersonAvatar avatar={p.avatar} name={p.name} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{p.name}{p.userId === meId ? " (أنت)" : ""}</span>
                      <span className="block truncate text-xs text-muted-foreground">{theirs.length ? `${theirs.length} مهمة مفتوحة · ${theirs[0]?.title}` : "لا مهام مفتوحة"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border p-5">
        <h3 className="font-display text-lg font-black">كل أدوات المتابعة</h3>
        <p className="mt-1 text-xs text-muted-foreground">كل ما يخص شغل فريقك في مكان واحد.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            { to: "/app/approvals", label: "الموافقات", icon: CheckCircle2 },
            { to: "/app/tasks", label: "كل المهام", icon: ListChecks },
            { to: "/app/queue", label: "جدول النشر", icon: Send },
            { to: "/app/proposals", label: "اقتراحات الفريق", icon: Lightbulb },
            { to: "/app/decisions", label: "القرارات", icon: Gavel },
            { to: "/app/autopilot", label: "النشر التلقائي", icon: Bot },
            { to: "/app/automations", label: "المهام المتكررة", icon: Clock3 },
            { to: "/app/team-tasks", label: "مهام جماعية", icon: Workflow },
          ] as const).map((l) => (
            <Link key={l.to} to={l.to} className="flex items-center gap-2 rounded-md border border-border px-3 py-3 text-sm font-bold hover:border-primary hover:text-primary">
              <l.icon className="size-4 shrink-0 text-primary" />{l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmployeeDot({ id }: { id: string }) {
  const m = getMember(id);
  return <span className="block size-8 shrink-0 overflow-hidden rounded-full" style={{ background: m?.tintSoft }}><Portrait memberId={id} name={m?.name ?? ""} className="size-full" /></span>;
}

function Stat({ icon: Icon, label, value, urgent }: { icon: typeof Inbox; label: string; value: number; urgent?: boolean }) {
  return (
    <div className={cn("rounded-md border p-4", urgent ? "border-primary bg-primary/5" : "border-border")}>
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Icon className="size-3.5" />{label}</p>
      <p className="mt-1 font-display text-3xl font-black">{value}</p>
    </div>
  );
}
