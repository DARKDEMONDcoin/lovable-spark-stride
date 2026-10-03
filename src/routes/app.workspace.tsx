import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Archive, CalendarClock, CalendarDays, Check, ListTodo, RotateCw, FolderKanban, Link2, LogOut, Plus, Settings2, Sparkles, Trash2, UserPlus, Users, X } from "lucide-react";
import { WorkspaceCalendar } from "@/components/app/workspace/WorkspaceCalendar";
import { WorkspaceToday } from "@/components/app/workspace/WorkspaceToday";
import { WorkspaceTour } from "@/components/app/workspace/WorkspaceTour";
import { ProjectBoard, EmployeeBadge } from "@/components/app/workspace/ProjectBoard";
import { getMember } from "@/data/team";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/data";
import { inviteHuman, listHumanTeam, listMyHumanSpaces, removeHumanMember, revokeHumanInvite, changeMemberRole } from "@/lib/collaboration.functions";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/app/PersonAvatar";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/workspace")({
  validateSearch: (search: Record<string, unknown>) => ({ workspaceId: typeof search["workspaceId"] === "string" ? search["workspaceId"] : undefined }),
  head: () => ({ meta: [
    { title: "مساحة عمل الفريق | سهل" },
    { name: "description", content: "ادعُ زملاءك إلى مساحة العمل وتعاونوا في المشاريع والمهام." },
    { property: "og:title", content: "مساحة عمل الفريق | سهل" },
    { property: "og:description", content: "ادعُ زملاءك إلى مساحة العمل وتعاونوا في المشاريع والمهام." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: WorkspacePage,
});

type Project = Tables<"collaboration_projects">;
type WorkItem = Tables<"collaboration_tasks">;
type Invite = Tables<"workspace_invitations">;
const TEMPLATES: { id: string; label: string; name: string; tasks: [string, string | null, string][] }[] = [
  { id: "blank", label: "مشروع فارغ", name: "", tasks: [] },
  { id: "launch", label: "إطلاق منتج", name: "إطلاق منتج جديد", tasks: [["تحديد الجمهور والرسالة الأساسية", "sonny", "high"], ["كتابة صفحة المنتج", "eva", "high"], ["خطة منشورات أسبوع الإطلاق", "nour", "medium"], ["تجهيز رسالة بريدية للعملاء", "dana", "medium"], ["مراجعة نهائية قبل الإطلاق", null, "urgent"]] },
  { id: "social", label: "حملة سوشيال", name: "حملة سوشيال شهرية", tasks: [["تقويم محتوى للشهر", "nour", "high"], ["كتابة ١٠ منشورات", "nour", "medium"], ["أفكار لصور وفيديوهات قصيرة", "eva", "medium"], ["قياس النتائج آخر الشهر", null, "low"]] },
  { id: "seo", label: "تحسين الظهور في جوجل", name: "تحسين الظهور في جوجل", tasks: [["بحث الكلمات المفتاحية", "sam", "high"], ["تحسين عناوين ووصف الصفحات", "sam", "medium"], ["كتابة مقالين للمدونة", "eva", "medium"], ["متابعة الترتيب أسبوعياً", null, "low"]] },
];
const inputClass = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function WorkspacePage() {
  const { workspaceId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: ownWorkspace } = useWorkspace();
  const listSpaces = useServerFn(listMyHumanSpaces);
  const spaces = useQuery({ queryKey: ["human-spaces"], queryFn: () => listSpaces() });
  // المساحة النشطة تتبع مبدّل المساحات في الشريط الجانبي؛ رابط ?workspaceId= يُستخدم فقط لفتح مساحة محددة مباشرة.
  const currentId = workspaceId && (!spaces.data || spaces.data.some((space) => space.id === workspaceId)) ? workspaceId : ownWorkspace?.id ?? spaces.data?.[0]?.id;
  const currentSpace = spaces.data?.find((s) => s.id === currentId);
  const isProject = currentSpace?.kind === "project";
  const loadingWorkspace = spaces.isLoading;
  const listTeam = useServerFn(listHumanTeam);
  const invite = useServerFn(inviteHuman);
  const remove = useServerFn(removeHumanMember);
  const revoke = useServerFn(revokeHumanInvite);
  const setRole = useServerFn(changeMemberRole);
  const [showArchived, setShowArchived] = useState(false);
  const [template, setTemplate] = useState("blank");
  const [view, setView] = useState<"today" | "projects" | "mine" | "calendar" | "activity" | "people" | "settings">("today");
  const [spaceName, setSpaceName] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [error, setError] = useState("");

  const humanTeam = useQuery({ queryKey: ["human-team", currentId], enabled: !!currentId,
    queryFn: () => listTeam({ data: { workspaceId: currentId ?? "" } }) });
  const projects = useQuery({ queryKey: ["collaboration-projects", currentId], enabled: !!currentId,
    queryFn: async () => { const { data, error } = await supabase.from("collaboration_projects").select("*").eq("workspace_id", currentId ?? "").order("created_at", { ascending: false }); if (error) throw error; return data as Project[]; } });
  const tasks = useQuery({ queryKey: ["collaboration-tasks", currentId], enabled: !!currentId, refetchInterval: 15000,
    queryFn: async () => { const { data, error } = await supabase.from("collaboration_tasks").select("*").eq("workspace_id", currentId ?? "").order("created_at", { ascending: false }); if (error) throw error; return data as WorkItem[]; } });
  const invitations = useQuery({ queryKey: ["human-invites", currentId], enabled: !!currentId && humanTeam.data?.owner === true,
    queryFn: async () => { const { data, error } = await supabase.from("workspace_invitations").select("*").eq("workspace_id", currentId ?? "").is("revoked_at", null).is("accepted_at", null).is("declined_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }); if (error) throw error; return data as Invite[]; } });
  const people = humanTeam.data?.members ?? [];
  const active = selectedProject ? projects.data?.find((p) => p.id === selectedProject) : undefined;
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["collaboration-projects", currentId] }); void qc.invalidateQueries({ queryKey: ["collaboration-tasks", currentId] }); void qc.invalidateQueries({ queryKey: ["collaboration-activity", currentId] }); };

  const createProject = useMutation({ mutationFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user || !currentId) throw new Error("سجّل الدخول أولاً.");
    const { data: created, error } = await supabase.from("collaboration_projects").insert({ workspace_id: currentId, name: projectName.trim(), description: projectDescription.trim(), created_by: auth.user.id }).select("id").single();
    if (error) throw error;
    const preset = TEMPLATES.find((t) => t.id === template);
    if (preset?.tasks.length) { const { error: taskError } = await supabase.from("collaboration_tasks").insert(preset.tasks.map(([title, ai, priority]) => ({ workspace_id: currentId, project_id: created.id, title, ai_employee_id: ai, priority, created_by: auth.user!.id }))); if (taskError) throw taskError; }
  }, onSuccess: () => { setProjectOpen(false); setProjectName(""); setProjectDescription(""); setTemplate("blank"); refresh(); } });
  const me = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const myRole = people.find((p) => p.userId === me.data)?.role;
  const canManage = humanTeam.data?.owner === true || myRole === "admin";
  const activity = useQuery({ queryKey: ["collaboration-activity", currentId], enabled: !!currentId, refetchInterval: 20000,
    queryFn: async () => { const { data, error } = await supabase.from("collaboration_activity").select("*").eq("workspace_id", currentId ?? "").order("created_at", { ascending: false }).limit(60); if (error) throw error; return data; } });
  const renameSpace = useMutation({ mutationFn: async () => { const { error } = await supabase.from("workspaces").update({ name: spaceName.trim() }).eq("id", currentId ?? ""); if (error) throw error; },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["human-team", currentId] }); void qc.invalidateQueries({ queryKey: ["human-spaces"] }); } });
  const leaveSpace = useMutation({ mutationFn: async () => { if (!me.data) throw new Error("سجّل الدخول أولاً."); const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", currentId ?? "").eq("user_id", me.data); if (error) throw error; },
    onSuccess: () => { try { window.localStorage.removeItem("sahl:last-workspace"); } catch { /* ignore */ } void qc.invalidateQueries({ queryKey: ["human-spaces"] }); void navigate({ to: "/app/workspace", search: { workspaceId: undefined } }); } });

  async function sendInvite() {
    if (!currentId) return;
    setError("");
    try {
      const result = await invite({ data: { workspaceId: currentId, email: email.trim(), role: inviteRole } });
      setInviteUrl(`${window.location.origin}/invite?token=${result.token}`);
      await qc.invalidateQueries({ queryKey: ["human-invites", currentId] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إنشاء الدعوة."); }
  }

  return <AppShell title="مساحة العمل" lead={humanTeam.data?.workspaceName ?? "فريقك الحقيقي ومشاريعك"}>
    <div dir="rtl" className="mx-auto w-full max-w-6xl pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-7">
        <div className="min-w-0"><p className="text-xs font-bold text-primary">مساحة العمل / {humanTeam.data?.workspaceName ?? "الفريق"}</p><h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">{isProject ? "شغل مشروعنا، في مكان واحد." : "شغلك، في مكان واحد."}</h2><p className="mt-2 text-sm text-muted-foreground">{isProject ? "فريق المشروع وموظفوه الرقميون على نفس المهام: أسندوا، خلّوا الموظف ينفّذ، وراجعوا النتائج مع بعض." : "مساحتك الشخصية: موظفوك الرقميون، مهامك، والموافقات اللي مستنياك."}</p></div>
        {humanTeam.data?.owner && <Button onClick={() => { setInviteOpen(true); setInviteUrl(""); setError(""); }} className="gap-2"><UserPlus className="size-4" /> دعوة شخص</Button>}
      </div>
      {currentSpace?.archived ? <p role="status" className="mt-5 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">المشروع ده مؤرشف. تقدر ترجّعه من «إعدادات المشروع» في قايمة المشاريع فوق الشريط الجانبي.</p> : null}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="أقسام مساحة العمل">
        {([{ id: "today", label: "النهاردة", icon: Sparkles, count: null }, { id: "projects", label: "المشاريع", icon: FolderKanban, count: projects.data?.length ?? 0 }, { id: "mine", label: "مهامي", icon: ListTodo, count: (tasks.data ?? []).filter((t) => t.assignee_id === me.data && t.status !== "done").length }, { id: "calendar", label: "التقويم", icon: CalendarDays, count: null }, { id: "activity", label: "النشاط", icon: Activity, count: activity.data?.length ?? 0 }, { id: "people", label: "الأعضاء", icon: Users, count: people.length }, { id: "settings", label: "الإعدادات", icon: Settings2, count: null }] as const).map((tab) => <Button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} variant="ghost" onClick={() => setView(tab.id)} className={cn("h-11 rounded-none border-b-2 px-4", view === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground")}><tab.icon className="size-4" />{tab.label}{tab.count !== null && <span className="text-xs opacity-60">{tab.count}</span>}</Button>)}
      </div>
      {view === "today" && <WorkspaceTour />}
      {(projects.error || tasks.error || humanTeam.error) && <p role="alert" className="mt-5 text-sm text-destructive">تعذّر تحميل مساحة العمل. أعد فتح الصفحة للمحاولة.</p>}
      {view === "today" ? <WorkspaceToday tasks={tasks.data ?? []} projects={projects.data ?? []} people={people} meId={me.data} ownWorkspaceId={ownWorkspace?.id} isOwnSpace={!isProject} onOpenProject={(id) => { setSelectedProject(id); setView("projects"); }} /> : view === "projects" && active && currentId ? <ProjectBoard project={active} tasks={(tasks.data ?? []).filter((t) => t.project_id === active.id)} people={people} canManage={canManage} workspaceId={currentId} onBack={() => setSelectedProject(null)} onChanged={refresh} /> : view === "projects" ? <section className="mt-7" aria-label="المشاريع">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-xl font-black">المشاريع</h3><p className="mt-1 text-sm text-muted-foreground">افتح مشروعاً لترى لوحة مهامه، وأسند المهام لزملائك أو لموظفيك الرقميين.</p></div>{canManage && <Button size="sm" onClick={() => setProjectOpen(true)}><Plus className="size-4" /> مشروع جديد</Button>}</div>
        {loadingWorkspace || projects.isLoading ? <p role="status" className="py-14 text-center text-sm text-muted-foreground">جارٍ تحميل المشاريع…</p> : !projects.data?.length ? <div className="border-y border-border py-16 text-center"><FolderKanban className="mx-auto size-9 text-primary" /><h4 className="mt-4 font-display text-xl font-black">أول مشروع يبدأ هنا</h4><p className="mt-2 text-sm text-muted-foreground">اجمع أعمال فريقك البشري في مشروع، ثم أضف المهام ووزّعها عليهم.</p>{canManage && <Button className="mt-5" onClick={() => setProjectOpen(true)}><Plus className="size-4" /> إنشاء مشروع</Button>}</div> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{projects.data.filter((p) => showArchived ? p.status === "archived" : p.status !== "archived").map((project) => <Button key={project.id} type="button" variant="outline" onClick={() => setSelectedProject(project.id)} className="group h-auto min-h-40 w-full flex-col items-stretch justify-start rounded-md p-5 text-start whitespace-normal hover:border-primary"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary"><FolderKanban className="size-5" /></span><span className={cn("text-xs font-bold", project.status === "completed" ? "text-jade-deep" : "text-muted-foreground")}>{project.status === "completed" ? "مكتمل" : project.status === "archived" ? "مؤرشف" : project.status === "paused" ? "متوقف" : "نشط"}</span></div><span className="mt-4 block break-words font-display text-lg font-black">{project.name}</span><span className="mt-1 block line-clamp-2 text-xs font-normal text-muted-foreground">{project.description || "مشروع الفريق"}</span>{(() => { const list = (tasks.data ?? []).filter((task) => task.project_id === project.id); const doneCount = list.filter((t) => t.status === "done").length; const ai = list.filter((t) => t.ai_employee_id).length; return <span className="mt-auto block pt-4"><span className="flex justify-between text-xs text-muted-foreground"><span>{doneCount}/{list.length} مكتملة</span>{ai > 0 && <span className="inline-flex items-center gap-1 text-primary"><Sparkles className="size-3" />{ai} مع موظفين رقميين</span>}</span><span className="mt-2 block h-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full bg-primary" style={{ width: `${list.length ? Math.round((doneCount / list.length) * 100) : 0}%` }} /></span><span className="mt-3 flex -space-x-2 space-x-reverse">{people.filter((p) => list.some((t) => t.assignee_id === p.userId)).slice(0, 5).map((p) => <PersonAvatar key={p.userId} avatar={p.avatar} name={p.name} className="size-6 ring-2 ring-background" />)}</span></span>; })()}</Button>)}</div>{projects.data.some((p) => p.status === "archived") && <Button variant="ghost" size="sm" className="mt-4 gap-1.5 text-muted-foreground" onClick={() => setShowArchived((v) => !v)}><Archive className="size-4" />{showArchived ? "عرض المشاريع الحالية" : `المؤرشفة (${projects.data.filter((p) => p.status === "archived").length})`}</Button>}</>}
      </section> : view === "mine" ? <section className="mt-7" aria-label="مهامي">
        <h3 className="font-display text-xl font-black">مهامي</h3><p className="mt-1 text-sm text-muted-foreground">كل ما أُسند إليك في مشاريع هذه المساحة، مرتباً حسب الموعد.</p>
        {(() => { const mine = (tasks.data ?? []).filter((t) => t.assignee_id === me.data && t.status !== "done").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")); const today = new Date().toISOString().slice(0, 10);
          return !mine.length ? <p className="mt-6 border-y border-border py-12 text-center text-sm text-muted-foreground">لا مهام مفتوحة عليك. يوم هادئ!</p> : <ul className="mt-5 divide-y divide-border border-y border-border">{mine.map((t) => { const project = projects.data?.find((p) => p.id === t.project_id); const late = t.due_date && t.due_date < today; return <li key={t.id}><button type="button" onClick={() => { setSelectedProject(t.project_id); setView("projects"); }} className="flex w-full items-center gap-3 py-3.5 text-start hover:text-primary"><span className={cn("size-2 shrink-0 rounded-full", t.status === "in_progress" ? "bg-primary" : "bg-muted-foreground/40")} /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-bold">{t.title}</span><span className="text-xs text-muted-foreground">{project?.name}{t.status === "in_progress" ? " · قيد التنفيذ" : ""}</span></span>{t.due_date && <span className={cn("inline-flex items-center gap-1 text-xs font-bold", late ? "text-destructive" : "text-muted-foreground")}><CalendarClock className="size-3.5" />{late ? "متأخرة · " : ""}{new Date(`${t.due_date}T00:00:00`).toLocaleDateString("ar", { day: "numeric", month: "short" })}</span>}</button></li>; })}</ul>; })()}
      </section> : view === "calendar" ? <WorkspaceCalendar tasks={tasks.data ?? []} onOpen={(id) => { setSelectedProject(id); setView("projects"); }} /> : view === "activity" ? <section className="mt-7" aria-label="النشاط">
        <h3 className="font-display text-xl font-black">ما الذي حدث مؤخراً</h3><p className="mt-1 text-sm text-muted-foreground">كل تحرك في المشاريع — من الفريق ومن الموظفين الرقميين — يظهر هنا تلقائياً.</p>
        {activity.isLoading ? <p role="status" className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p> : !activity.data?.length ? <p className="mt-6 border-y border-border py-12 text-center text-sm text-muted-foreground">لا نشاط بعد. أنشئ مشروعاً أو مهمة لتبدأ القصة.</p> : <ol className="mt-5 divide-y divide-border border-y border-border">{activity.data.map((item) => { const actorPerson = people.find((p) => p.userId === item.actor_id); const actor = actorPerson?.name ?? "عضو"; const emp = item.employee_id ? getMember(item.employee_id)?.name : null; const project = projects.data?.find((p) => p.id === item.project_id); const verb: Record<string, string> = { project_created: `أنشأ ${actor} مشروعاً`, project_completed: `أنهى ${actor} المشروع`, project_active: `أعاد ${actor} فتح المشروع`, task_created: `أضاف ${actor} مهمة`, output_shared: `أرسل ${actor} مخرجاً من محادثة ${emp ?? "موظف"}`, ai_assigned: `أسند ${actor} إلى ${emp ?? "موظف رقمي"} مهمة`, ai_done: `أنجز ${emp ?? "الموظف الرقمي"} مهمة`, task_todo: `أعاد ${actor} مهمة إلى «للعمل»`, task_in_progress: `بدأ ${actor} العمل على`, task_done: `أكمل ${actor} مهمة` }; return <li key={item.id} className="flex items-start gap-3 py-3.5">{item.kind === "ai_done" && item.employee_id ? <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Sparkles className="size-4" /></span> : <PersonAvatar avatar={actorPerson?.avatar} name={actor} className="mt-0.5 size-8" />}<div className="min-w-0 flex-1 text-sm"><p className="break-words"><span className="text-muted-foreground">{verb[item.kind] ?? actor}</span> <button type="button" className="font-bold hover:text-primary" onClick={() => { if (item.project_id) { setSelectedProject(item.project_id); setView("projects"); } }}>«{item.summary}»</button>{project && !item.kind.startsWith("project") ? <span className="text-muted-foreground"> في {project.name}</span> : null}</p><p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("ar", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{item.employee_id && <EmployeeBadge id={item.employee_id} />}</p></div></li>; })}</ol>}
      </section> : view === "settings" ? <section className="mt-7 max-w-xl space-y-8" aria-label="الإعدادات">
        {humanTeam.data?.owner ? <form onSubmit={(e) => { e.preventDefault(); renameSpace.mutate(); }} className="space-y-3"><h3 className="font-display text-xl font-black">اسم المساحة</h3><p className="text-sm text-muted-foreground">يظهر لكل أعضاء الفريق في مبدّل المساحات.</p><div className="flex gap-2"><input value={spaceName || humanTeam.data?.workspaceName || ""} onChange={(e) => setSpaceName(e.target.value)} minLength={2} maxLength={80} aria-label="اسم المساحة" className={inputClass} /><Button type="submit" disabled={renameSpace.isPending || spaceName.trim().length < 2}>{renameSpace.isSuccess && !renameSpace.isPending ? <Check className="size-4" /> : null}حفظ</Button></div>{renameSpace.error && <p role="alert" className="text-sm text-destructive">{renameSpace.error.message}</p>}</form>
        : <div className="space-y-3"><h3 className="font-display text-xl font-black">مغادرة المساحة</h3><p className="text-sm text-muted-foreground">ستفقد الوصول لمشاريع ومهام «{humanTeam.data?.workspaceName}». يمكن للمالك دعوتك مجدداً لاحقاً.</p><Button variant="outline" className="gap-2 text-destructive" disabled={leaveSpace.isPending} onClick={() => { if (window.confirm("مغادرة مساحة العمل؟")) leaveSpace.mutate(); }}><LogOut className="size-4" /> غادر المساحة</Button>{leaveSpace.error && <p role="alert" className="text-sm text-destructive">{leaveSpace.error.message}</p>}</div>}
        <div className="rounded-md border border-border p-4 text-sm leading-7 text-muted-foreground"><p className="font-bold text-foreground">الأدوار</p><p><b>المالك:</b> كل شيء، بما فيه الدعوات والإعدادات.</p><p><b>مدير المشاريع:</b> ينشئ المشاريع ويديرها، ويسند المهام للفريق وللموظفين الرقميين.</p><p><b>العضو:</b> يضيف المهام ويحدّثها ويشغّل الموظفين الرقميين عليها.</p><p className="mt-2 text-xs">لا يصل أي عضو إلى محادثاتك الخاصة أو حساباتك المتصلة.</p></div>
      </section> : <section className="mt-7" aria-label="الأعضاء">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-xl font-black">الأشخاص في المساحة</h3><p className="mt-1 text-sm text-muted-foreground">كل عضو يدخل نفس المشروع: محادثات الموظفين ومهامه وملفاته مشتركة بين الفريق، ومساحتك الشخصية تبقى خاصة بك.</p></div>{humanTeam.data?.owner && <Button variant="outline" size="sm" onClick={() => { setInviteOpen(true); setInviteUrl(""); setError(""); }}><UserPlus className="size-4" /> دعوة شخص</Button>}</div>
        <div className="divide-y divide-border border-y border-border">{people.map((person) => <div key={person.userId} className="flex min-w-0 items-center gap-3 py-4"><PersonAvatar avatar={person.avatar} name={person.name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{person.name}</p>{humanTeam.data?.owner && person.role !== "owner" ? <select value={person.role} aria-label={`دور ${person.name}`} onChange={async (e) => { if (!currentId) return; try { await setRole({ data: { workspaceId: currentId, userId: person.userId, role: e.target.value as "admin" | "member" } }); await qc.invalidateQueries({ queryKey: ["human-team", currentId] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تغيير الدور."); } }} className="mt-1 h-7 rounded border border-border bg-background px-1.5 text-xs"><option value="member">عضو</option><option value="admin">مدير مشاريع</option></select> : <p className="text-xs text-muted-foreground">{person.role === "owner" ? "مالك المساحة" : person.role === "admin" ? "مدير مشاريع" : "عضو"}</p>}</div>{humanTeam.data?.owner && person.role !== "owner" && <Button size="icon" variant="ghost" aria-label={`إزالة ${person.name}`} title="إزالة من المساحة" onClick={async () => { if (!currentId || !window.confirm(`إزالة ${person.name} من مساحة العمل؟`)) return; try { await remove({ data: { workspaceId: currentId, userId: person.userId } }); await qc.invalidateQueries({ queryKey: ["human-team", currentId] }); refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّرت الإزالة."); } }}><Trash2 className="size-4" /></Button>}</div>)}</div>
        {humanTeam.data?.owner && Boolean(invitations.data?.length) && <div className="mt-8"><h4 className="mb-3 text-sm font-bold">دعوات بانتظار القبول</h4><div className="divide-y divide-border border-y border-border">{invitations.data?.map((entry) => <div key={entry.id} className="flex min-w-0 items-center gap-3 py-3 text-sm"><span className="min-w-0 flex-1 truncate" dir="ltr">{entry.email}</span><span className="text-xs text-muted-foreground">{entry.role === "admin" ? "مدير مشاريع" : "عضو"}</span><Button variant="ghost" size="icon" title="إعادة إرسال الدعوة" aria-label={`إعادة إرسال دعوة ${entry.email}`} onClick={async () => { if (!currentId) return; try { const result = await invite({ data: { workspaceId: currentId, email: entry.email, role: entry.role as "admin" | "member" } }); setEmail(entry.email); setInviteUrl(`${window.location.origin}/invite?token=${result.token}`); setCopied(false); setInviteOpen(true); await qc.invalidateQueries({ queryKey: ["human-invites", currentId] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّرت إعادة الإرسال."); } }}><RotateCw className="size-4" /></Button><Button variant="ghost" size="icon" title="إلغاء الدعوة" aria-label={`إلغاء دعوة ${entry.email}`} onClick={async () => { if (!currentId) return; try { await revoke({ data: { workspaceId: currentId, invitationId: entry.id } }); await qc.invalidateQueries({ queryKey: ["human-invites", currentId] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر إلغاء الدعوة."); } }}><X className="size-4" /></Button></div>)}</div></div>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>}
    </div>

    <Dialog open={projectOpen} onOpenChange={setProjectOpen}><DialogContent dir="rtl" className="w-[min(94vw,30rem)] max-w-none rounded-md"><DialogTitle>مشروع جديد</DialogTitle><DialogDescription>اجمع عمل الأشخاص الحقيقيين في مكان واحد.</DialogDescription><form onSubmit={(event) => { event.preventDefault(); createProject.mutate(); }} className="space-y-4"><div><p className="text-sm font-bold">ابدأ من قالب</p><div className="mt-2 grid grid-cols-2 gap-2">{TEMPLATES.map((t) => <button key={t.id} type="button" onClick={() => { setTemplate(t.id); if (t.name && !projectName.trim()) setProjectName(t.name); }} className={cn("rounded-md border p-2.5 text-start text-sm", template === t.id ? "border-primary bg-primary/5 font-bold" : "border-border")}>{t.label}{t.tasks.length > 0 && <span className="block text-xs font-normal text-muted-foreground">{t.tasks.length} مهام جاهزة</span>}</button>)}</div></div><label className="block text-sm font-bold">اسم المشروع<input required minLength={2} maxLength={120} value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="مثلاً: إطلاق المتجر" className={cn(inputClass, "mt-2")} /></label><label className="block text-sm font-bold">وصف مختصر<textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} rows={3} maxLength={1000} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm" /></label><Button type="submit" disabled={createProject.isPending || projectName.trim().length < 2}>{createProject.isPending ? "جارٍ الإنشاء…" : "إنشاء المشروع"}</Button>{createProject.error && <p role="alert" className="text-sm text-destructive">{createProject.error.message}</p>}</form></DialogContent></Dialog>

    <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) { setInviteUrl(""); setCopied(false); } }}><DialogContent dir="rtl" className="w-[min(94vw,32rem)] max-w-none rounded-md"><DialogTitle>دعوة شخص إلى الفريق</DialogTitle><DialogDescription>سيصل للمدعو إشعار داخل سهل فور دخوله بهذا البريد ليقبل أو يرفض، وستصلك أنت إشعار بقراره. تنتهي الدعوة بعد ٧ أيام.</DialogDescription>{!inviteUrl ? <form onSubmit={(event) => { event.preventDefault(); void sendInvite(); }} className="space-y-4"><label className="block text-sm font-bold">البريد الإلكتروني<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" dir="ltr" className={cn(inputClass, "mt-2")} /></label><label className="block text-sm font-bold">الدور<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "admin" | "member")} className={cn(inputClass, "mt-2")}><option value="member">عضو — يعمل على المشاريع والمهام</option><option value="admin">مدير مشاريع — ينشئ المشاريع ويديرها</option></select></label><p className="text-xs leading-6 text-muted-foreground">المدعو يشارك الفريق محادثات الموظفين ومهام هذا المشروع فقط — لا يرى مساحتك الشخصية أو مشاريعك الأخرى.</p><Button type="submit" disabled={!email.trim()}><Link2 className="size-4" /> إرسال الدعوة</Button></form> : <div className="space-y-4"><p className="text-sm font-semibold">أُرسلت الدعوة إلى {email.trim()} — ستظهر له في الإشعارات فور دخوله بهذا البريد ليقبل أو يرفض، وستصلك أنت إشعار بقراره.</p><Button variant="outline" onClick={() => { setInviteOpen(false); setInviteUrl(""); setCopied(false); }}><Check className="size-4" /> تم</Button></div>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>


  </AppShell>;
}