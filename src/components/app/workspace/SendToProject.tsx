import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, FolderInput, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { listMyHumanSpaces } from "@/lib/collaboration.functions";

const field = "mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** يرسل مخرج موظف رقمي من المحادثة إلى مشروع مشترك ليراجعه الفريق. */
export function SendToProject({ employeeId, employeeName, body }: { employeeId: string; employeeName: string; body: string }) {
  const [open, setOpen] = useState(false);
  const [spaceId, setSpaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const firstLine = body.replace(/[#*_>`]/g, "").split("\n").map((l) => l.trim()).find((l) => l.length > 3) ?? "";
  const [title, setTitle] = useState(`${employeeName}: ${firstLine.slice(0, 80)}`);
  const listSpaces = useServerFn(listMyHumanSpaces);
  const spaces = useQuery({ queryKey: ["human-spaces"], queryFn: () => listSpaces(), enabled: open });
  const space = spaceId || spaces.data?.[0]?.id || "";
  const projects = useQuery({ queryKey: ["collaboration-projects", space], enabled: open && !!space,
    queryFn: async () => { const { data, error } = await supabase.from("collaboration_projects").select("id, name, status").eq("workspace_id", space).order("created_at", { ascending: false }); if (error) throw error; return data; } });
  const project = projectId || projects.data?.find((p) => p.status !== "completed")?.id || "";
  const send = useMutation({ mutationFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user || !space || !project) throw new Error("اختر مشروعاً أولاً.");
    const { error } = await supabase.from("collaboration_tasks").insert({ workspace_id: space, project_id: project, title: title.trim().slice(0, 200) || `مخرج من ${employeeName}`, ai_employee_id: employeeId, ai_output: body, ai_status: "done", status: "in_progress", source: "chat", created_by: auth.user.id });
    if (error) throw new Error(error.message);
  } });

  return <>
    <button type="button" onClick={() => { setOpen(true); send.reset(); }} className="output-action-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.72rem] font-bold transition-colors hover:bg-secondary">
      <FolderInput className="size-3.5" /> أرسل لمشروع الفريق
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="w-[min(94vw,30rem)] max-w-none rounded-md">
        <DialogTitle>أرسل المخرج إلى مشروع</DialogTitle>
        <DialogDescription>يظهر كمهمة «قيد التنفيذ» في لوحة المشروع، ليراجعه فريقك ويعلّق عليه.</DialogDescription>
        {send.isSuccess ? <div className="space-y-4 py-2"><p className="flex items-center gap-2 text-sm font-bold text-jade-deep"><Check className="size-4" /> أُرسل إلى المشروع.</p><Button asChild variant="outline"><Link to="/app/workspace" search={{ workspaceId: space }}>افتح مساحة العمل</Link></Button></div>
        : <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-4">
          {spaces.isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : <>
            {(spaces.data?.length ?? 0) > 1 && <label className="block text-sm font-bold">المساحة<select value={space} onChange={(e) => { setSpaceId(e.target.value); setProjectId(""); }} className={field}>{spaces.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            {projects.data && projects.data.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مشاريع بعد. <Link to="/app/workspace" search={{ workspaceId: space }} className="font-bold text-primary">أنشئ مشروعاً</Link> أولاً.</p>
            : <label className="block text-sm font-bold">المشروع<select value={project} onChange={(e) => setProjectId(e.target.value)} className={field}>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === "completed" ? " (مكتمل)" : ""}</option>)}</select></label>}
            <label className="block text-sm font-bold">عنوان المهمة<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={field} /></label>
          </>}
          {send.error && <p role="alert" className="text-sm text-destructive">{send.error.message}</p>}
          <Button type="submit" disabled={send.isPending || !project}>{send.isPending && <Loader2 className="size-4 animate-spin" />}إرسال</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
