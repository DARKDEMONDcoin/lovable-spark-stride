import { useState } from "react";
import { PersonAvatar } from "@/components/app/PersonAvatar";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Bot, CalendarClock, Check, ClipboardCopy, Flag, Loader2, MessageSquare, Plus, Sparkles, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { runCollabTaskWithEmployee } from "@/lib/collab-ai.functions";
import { team, getMember } from "@/data/team";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"collaboration_projects">;
type WorkItem = Tables<"collaboration_tasks">;
type Person = { userId: string; name: string; role: string; avatar?: string | null };
type Status = "todo" | "in_progress" | "done";
type Priority = "urgent" | "high" | "medium" | "low";

const COLUMNS: { id: Status; label: string }[] = [
  { id: "todo", label: "للعمل" },
  { id: "in_progress", label: "قيد التنفيذ" },
  { id: "done", label: "مكتملة" },
];
export const PRIORITY: Record<Priority, { label: string; className: string }> = {
  urgent: { label: "عاجل", className: "bg-destructive/12 text-destructive" },
  high: { label: "مرتفع", className: "bg-primary/12 text-primary" },
  medium: { label: "متوسط", className: "bg-secondary text-foreground" },
  low: { label: "منخفض", className: "bg-muted text-muted-foreground" },
};
const field = "h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function dueLabel(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const text = d.toLocaleDateString("ar", { day: "numeric", month: "short" });
  return { text: diff === 0 ? "اليوم" : diff === 1 ? "غداً" : text, late: diff < 0 };
}

export function EmployeeBadge({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const m = getMember(id);
  if (!m) return null;
  const Icon = m.icon;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full font-bold", size === "sm" ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs")} style={{ background: m.tintSoft, color: m.tint }}><Icon className="size-3.5" />{m.name}</span>;
}

export function ProjectBoard({ project, tasks, people, canManage, workspaceId, onBack, onChanged }: {
  project: Project; tasks: WorkItem[]; people: Person[]; canManage: boolean; workspaceId: string; onBack: () => void; onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [due, setDue] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const open = tasks.find((t) => t.id === openId);

  const create = useMutation({ mutationFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("سجّل الدخول أولاً.");
    const human = assignee.startsWith("u:") ? assignee.slice(2) : null;
    const ai = assignee.startsWith("ai:") ? assignee.slice(3) : null;
    const { error } = await supabase.from("collaboration_tasks").insert({ workspace_id: workspaceId, project_id: project.id, title: title.trim(), assignee_id: human, ai_employee_id: ai, priority, due_date: due || null, created_by: auth.user.id });
    if (error) throw error;
  }, onSuccess: () => { setTitle(""); setAssignee(""); setPriority("medium"); setDue(""); onChanged(); } });
  const move = useMutation({ mutationFn: async ({ id, status }: { id: string; status: Status }) => {
    const { error } = await supabase.from("collaboration_tasks").update({ status }).eq("id", id); if (error) throw error;
  }, onSuccess: onChanged });
  const projectStatus = useMutation({ mutationFn: async () => {
    const { error } = await supabase.from("collaboration_projects").update({ status: project.status === "completed" ? "active" : "completed" }).eq("id", project.id); if (error) throw error;
  }, onSuccess: onChanged });

  return <section aria-label={`لوحة ${project.name}`} className="mt-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ms-2 mb-2 gap-1 text-muted-foreground"><ArrowRight className="size-4" /> كل المشاريع</Button>
        <h3 className="break-words font-display text-2xl font-black">{project.name}</h3>
        {project.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-40"><div className="flex justify-between text-xs font-bold"><span>التقدم</span><span>{pct}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div></div>
        {canManage && <Button variant="outline" size="sm" disabled={projectStatus.isPending} onClick={() => projectStatus.mutate()}>{project.status === "completed" ? "إعادة فتح" : "إنهاء المشروع"}</Button>}
      </div>
    </div>

    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="mt-5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2.5">
      <input required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مهمة جديدة… مثلاً: خطة محتوى أسبوع الإطلاق" aria-label="عنوان المهمة" className={cn(field, "min-w-[14rem] flex-1")} />
      <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="المسؤول عن المهمة" className={field}>
        <option value="">بدون مسؤول</option>
        <optgroup label="الموظفون الرقميون">{team.map((m) => <option key={m.id} value={`ai:${m.id}`}>{m.name} — {m.role}</option>)}</optgroup>
        <optgroup label="الفريق">{people.map((p) => <option key={p.userId} value={`u:${p.userId}`}>{p.name}</option>)}</optgroup>
      </select>
      <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="الأولوية" className={field}>{(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}</select>
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="تاريخ الاستحقاق" className={field} />
      <Button type="submit" size="sm" disabled={create.isPending || title.trim().length < 2}><Plus className="size-4" /> إضافة</Button>
    </form>
    {(create.error || move.error) && <p role="alert" className="mt-2 text-sm text-destructive">{(create.error ?? move.error)?.message}</p>}

    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.id);
        return <div key={col.id} onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }} onDragLeave={() => setOverCol(null)} onDrop={(e) => { e.preventDefault(); setOverCol(null); if (dragId) move.mutate({ id: dragId, status: col.id }); setDragId(null); }}
          className={cn("min-h-48 rounded-md border bg-secondary/40 p-2.5 transition-colors", overCol === col.id ? "border-primary bg-primary/5" : "border-border")} aria-label={col.label}>
          <div className="mb-2.5 flex items-center justify-between px-1"><h4 className="text-sm font-black">{col.label}</h4><span className="rounded-full bg-background px-2 text-xs font-bold text-muted-foreground">{items.length}</span></div>
          <div className="space-y-2">
            {items.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">اسحب مهمة إلى هنا</p>}
            {items.map((t) => {
              const due = dueLabel(t.due_date);
              const human = people.find((p) => p.userId === t.assignee_id);
              return <article key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} className="group cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing">
                <button type="button" onClick={() => setOpenId(t.id)} className="block w-full text-start"><p className="break-words text-sm font-bold leading-6">{t.title}</p></button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-bold", PRIORITY[(t.priority as Priority) ?? "medium"].className)}><Flag className="me-1 inline size-3" />{PRIORITY[(t.priority as Priority) ?? "medium"].label}</span>
                  {due && <span className={cn("inline-flex items-center gap-1 text-[0.7rem] font-bold", due.late && t.status !== "done" ? "text-destructive" : "text-muted-foreground")}><CalendarClock className="size-3" />{due.text}</span>}
                  {t.ai_employee_id && <EmployeeBadge id={t.ai_employee_id} />}
                  {t.ai_status === "running" && <Loader2 className="size-3.5 animate-spin text-primary" aria-label="الموظف يعمل" />}
                  {t.ai_output && <span className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-jade-deep"><Sparkles className="size-3" /> نتيجة جاهزة</span>}
                  {human && <PersonAvatar avatar={human.avatar} name={human.name} className="ms-auto size-6" />}
                </div>
                <select value={t.status} onChange={(e) => move.mutate({ id: t.id, status: e.target.value as Status })} aria-label={`حالة ${t.title}`} className="mt-2 h-7 w-full rounded border border-border bg-background px-1.5 text-xs lg:hidden">{COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              </article>;
            })}
          </div>
        </div>;
      })}
    </div>

    {open && <TaskDetail key={open.id} task={open} people={people} onClose={() => setOpenId(null)} onChanged={onChanged} />}
  </section>;
}

function TaskDetail({ task, people, onClose, onChanged }: { task: WorkItem; people: Person[]; onClose: () => void; onChanged: () => void }) {
  const run = useServerFn(runCollabTaskWithEmployee);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [copied, setCopied] = useState(false);
  const update = useMutation({ mutationFn: async (patch: Partial<WorkItem>) => {
    const { error } = await supabase.from("collaboration_tasks").update(patch).eq("id", task.id); if (error) throw error;
  }, onSuccess: onChanged });
  const execute = useMutation({ mutationFn: () => run({ data: { taskId: task.id } }), onSettled: onChanged });
  const remove = useMutation({ mutationFn: async () => { const { error } = await supabase.from("collaboration_tasks").delete().eq("id", task.id); if (error) throw error; }, onSuccess: () => { onChanged(); onClose(); } });
  const running = execute.isPending || task.ai_status === "running";
  const err = update.error ?? execute.error ?? remove.error;

  return <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent dir="rtl" className="max-h-[90dvh] w-[min(96vw,48rem)] max-w-none overflow-y-auto rounded-md">
      <DialogTitle className="break-words pe-6 text-xl leading-8">{task.title}</DialogTitle>
      <DialogDescription>{task.source === "chat" ? "مخرج أُرسل من محادثة موظف رقمي" : "تفاصيل المهمة"}</DialogDescription>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-muted-foreground">الحالة<select value={task.status} onChange={(e) => update.mutate({ status: e.target.value })} className={cn(field, "mt-1 w-full text-foreground")}>{COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label className="text-xs font-bold text-muted-foreground">الأولوية<select value={task.priority} onChange={(e) => update.mutate({ priority: e.target.value })} className={cn(field, "mt-1 w-full text-foreground")}>{(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}</select></label>
        <label className="text-xs font-bold text-muted-foreground">المسؤول من الفريق<select value={task.assignee_id ?? ""} onChange={(e) => update.mutate({ assignee_id: e.target.value || null })} className={cn(field, "mt-1 w-full text-foreground")}><option value="">بدون</option>{people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}</select></label>
        <label className="text-xs font-bold text-muted-foreground">تاريخ الاستحقاق<input type="date" value={task.due_date ?? ""} onChange={(e) => update.mutate({ due_date: e.target.value || null })} className={cn(field, "mt-1 w-full text-foreground")} /></label>
      </div>

      <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Bot className="size-5 text-primary" /><h4 className="text-sm font-black">الموظف الرقمي المسؤول</h4></div>
          <select value={task.ai_employee_id ?? ""} onChange={(e) => update.mutate({ ai_employee_id: e.target.value || null })} aria-label="الموظف الرقمي" className={field}><option value="">بدون موظف رقمي</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}</select>
        </div>
        {task.ai_employee_id ? <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => execute.mutate()} disabled={running} className="gap-1.5">{running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{running ? `${getMember(task.ai_employee_id)?.name ?? "الموظف"} يعمل على المهمة…` : task.ai_output ? "أعد التنفيذ" : `نفّذها مع ${getMember(task.ai_employee_id)?.name ?? "الموظف"}`}</Button>
          <Button size="sm" variant="outline" asChild><Link to="/app/chat/$id" params={{ id: task.ai_employee_id }} search={{ prompt: `بخصوص مهمة الفريق «${task.title}»:\n` } as never}><MessageSquare className="size-4" /> ناقشها في المحادثة</Link></Button>
          {task.ai_status === "failed" && !running && <span className="text-xs font-bold text-destructive">تعذّر التنفيذ في المحاولة الأخيرة.</span>}
        </div> : <p className="mt-2 text-xs text-muted-foreground">اختر موظفاً رقمياً لينفّذ المهمة ويضع نتيجتها هنا ليراجعها الفريق.</p>}
      </div>

      {task.ai_output && <div className="rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><span className="flex items-center gap-2 text-sm font-black"><Sparkles className="size-4 text-primary" /> المخرج {task.ai_employee_id && <EmployeeBadge id={task.ai_employee_id} />}</span><Button size="sm" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(task.ai_output ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* manual copy */ } }}>{copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}{copied ? "نُسخ" : "نسخ"}</Button></div>
        <div className="break-words p-4 text-sm leading-7"><MessageResponse>{task.ai_output}</MessageResponse></div>
      </div>}

      <label className="block text-sm font-black"><span className="flex items-center gap-2"><StickyNote className="size-4" /> ملاحظات الفريق</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (task.notes ?? "")) update.mutate({ notes }); }} rows={3} maxLength={4000} placeholder="سياق، روابط، أو ملاحظات للمراجعة — يستخدمها الموظف الرقمي عند التنفيذ." className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm font-normal" />
      </label>
      {err && <p role="alert" className="text-sm text-destructive">{err.message}</p>}
      <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm("حذف هذه المهمة؟")) remove.mutate(); }}>حذف المهمة</Button></div>
    </DialogContent>
  </Dialog>;
}
