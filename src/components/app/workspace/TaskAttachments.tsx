import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const MAX = 20 * 1024 * 1024;
const size = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(n / 1024))} ك.ب`;

/** مرفقات المهمة: ملفات خاصة بأعضاء المساحة فقط. */
export function TaskAttachments({ taskId, workspaceId, meId }: { taskId: string; workspaceId: string; meId: string | null | undefined }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const key = ["collab-attachments", taskId];
  const list = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from("collaboration_attachments").select("*").eq("task_id", taskId).order("created_at");
    if (error) throw error; return data;
  } });
  const upload = useMutation({ mutationFn: async (files: File[]) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("سجّل الدخول أولاً.");
    for (const file of files) {
      if (file.size > MAX) throw new Error(`«${file.name}» أكبر من 20 م.ب.`);
      const safe = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-80);
      const path = `${workspaceId}/${taskId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("collab-files").upload(path, file, file.type ? { contentType: file.type } : {});
      if (upErr) throw new Error(`تعذّر رفع الملف. ${upErr.message}`);
      const { error } = await supabase.from("collaboration_attachments").insert({ task_id: taskId, workspace_id: workspaceId, uploaded_by: auth.user.id, name: file.name.slice(0, 200), path, size: file.size });
      if (error) throw error;
    }
  }, onSettled: () => { if (input.current) input.current.value = ""; void qc.invalidateQueries({ queryKey: key }); } });
  const remove = useMutation({ mutationFn: async (a: { id: string; path: string }) => {
    await supabase.storage.from("collab-files").remove([a.path]);
    const { error } = await supabase.from("collaboration_attachments").delete().eq("id", a.id); if (error) throw error;
  }, onSuccess: () => void qc.invalidateQueries({ queryKey: key }) });
  async function open(path: string) {
    const { data } = await supabase.storage.from("collab-files").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  const err = upload.error ?? remove.error;
  return <div className="space-y-2">
    <div className="flex items-center justify-between">
      <h4 className="flex items-center gap-2 text-sm font-black"><Paperclip className="size-4" /> المرفقات {list.data?.length ? <span className="text-xs text-muted-foreground">{list.data.length}</span> : null}</h4>
      <input ref={input} type="file" multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) upload.mutate(f); }} />
      <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>{upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}إرفاق ملف</Button>
    </div>
    {list.data?.length ? <ul className="divide-y divide-border rounded-md border border-border">{list.data.map((a) => <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
      <button type="button" onClick={() => void open(a.path)} className="min-w-0 flex-1 truncate text-start font-bold hover:text-primary">{a.name}</button>
      <span className="text-xs text-muted-foreground">{size(a.size)}</span>
      <Button size="icon" variant="ghost" className="size-7" aria-label={`تنزيل ${a.name}`} onClick={() => void open(a.path)}><Download className="size-3.5" /></Button>
      {a.uploaded_by === meId && <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={`حذف ${a.name}`} onClick={() => { if (window.confirm(`حذف «${a.name}»؟`)) remove.mutate(a); }}><Trash2 className="size-3.5" /></Button>}
    </li>)}</ul> : <p className="text-xs text-muted-foreground">أرفق ملفات أو صوراً تخص المهمة (حتى 20 م.ب للملف). يراها أعضاء المساحة فقط.</p>}
    {err && <p role="alert" className="text-xs text-destructive">{err.message}</p>}
  </div>;
}
