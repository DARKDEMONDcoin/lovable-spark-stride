import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, UserCheck, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listMyInbox, markNotificationsRead, respondToInvite } from "@/lib/invite-inbox.functions";
import { PersonAvatar } from "@/components/app/PersonAvatar";
import { cn } from "@/lib/utils";

const when = (iso: string) => new Date(iso).toLocaleString("ar", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** جرس الإشعارات: دعوات مساحات العمل (قبول/رفض) وردود المدعوين. */
export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const load = useServerFn(listMyInbox);
  const respond = useServerFn(respondToInvite);
  const markRead = useServerFn(markNotificationsRead);
  const inbox = useQuery({ queryKey: ["my-inbox"], queryFn: () => load(), refetchInterval: 30000, refetchOnWindowFocus: true });
  const invites = inbox.data?.invites ?? [];
  const notes = inbox.data?.notifications ?? [];
  const unread = invites.length + notes.filter((n) => !n.read_at).length;

  const answer = useMutation({
    mutationFn: (v: { invitationId: string; accept: boolean }) => respond({ data: v }),
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-inbox"] }),
        qc.invalidateQueries({ queryKey: ["human-spaces"] }),
      ]);
      if (result.accepted) {
        try { window.localStorage.setItem("sahl:last-workspace", result.workspaceId); } catch { /* ignore */ }
        toast.success("انضممت إلى مساحة العمل");
        void navigate({ to: "/app/workspace", search: { workspaceId: result.workspaceId } });
      } else toast("تم رفض الدعوة");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر تنفيذ الطلب"),
  });

  return (
    <Popover onOpenChange={(open) => { if (!open && notes.some((n) => !n.read_at)) void markRead().then(() => qc.invalidateQueries({ queryKey: ["my-inbox"] })); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative size-10 shrink-0 rounded-lg" aria-label={unread ? `الإشعارات، ${unread} جديد` : "الإشعارات"}>
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="end" className="w-[min(92vw,24rem)] p-0">
        <div className="border-b border-border px-4 py-3"><p className="font-display text-sm font-black">الإشعارات</p></div>
        <div className="max-h-[26rem] overflow-y-auto">
          {inbox.isLoading ? <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
            : !invites.length && !notes.length ? <div className="px-4 py-10 text-center"><Bell className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">لا إشعارات جديدة.</p></div>
            : <ul className="divide-y divide-border">
              {invites.map((inv) => (
                <li key={inv.id} className="bg-primary/5 px-4 py-3.5">
                  <div className="flex gap-3">
                    <PersonAvatar avatar={inv.inviterAvatar} name={inv.inviterName} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6"><b>{inv.inviterName}</b> دعاك للانضمام إلى <b>«{inv.workspaceName}»</b> {inv.role === "admin" ? "كمدير مشاريع" : "كعضو"}.</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{when(inv.createdAt)}</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ invitationId: inv.id, accept: true })}><Check className="size-4" /> قبول</Button>
                        <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ invitationId: inv.id, accept: false })}><X className="size-4" /> رفض</Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {notes.map((n) => (
                <li key={n.id} className={cn("flex gap-3 px-4 py-3.5", !n.read_at && "bg-secondary/60")}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", n.kind === "invite_declined" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                    {n.kind === "invite_declined" ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                  </span>
                  <button type="button" className="min-w-0 flex-1 text-start" onClick={() => n.workspace_id && navigate({ to: "/app/workspace", search: { workspaceId: n.workspace_id } })}>
                    <p className="text-sm font-bold leading-6">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">{when(n.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
