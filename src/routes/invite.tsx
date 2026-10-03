import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { acceptHumanInvite } from "@/lib/collaboration.functions";

export const Route = createFileRoute("/invite")({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search["token"] === "string" ? search["token"] : "" }),
  head: () => ({ meta: [
    { title: "دعوة مساحة العمل | سهل" },
    { name: "description", content: "اقبل دعوتك للانضمام إلى مساحة عمل فريقك في سهل." },
    { property: "og:title", content: "دعوة مساحة العمل | سهل" },
    { property: "og:description", content: "اقبل دعوتك للانضمام إلى مساحة عمل فريقك في سهل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = Route.useSearch();
  const { user, loading } = useSession();
  const accept = useServerFn(acceptHumanInvite);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function join() {
    setBusy(true); setError("");
    try {
      const result = await accept({ data: { token } });
      setDone(true);
      try { window.localStorage.setItem("sahl:last-workspace", result.workspaceId); } catch { /* ignore */ }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workspace"] }),
        qc.invalidateQueries({ queryKey: ["human-spaces"] }),
      ]);
      void navigate({ to: "/app/workspace", search: { workspaceId: result.workspaceId } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر قبول الدعوة."); }
    finally { setBusy(false); }
  }

  return <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-5 py-12 text-foreground">
    <div className="w-full max-w-lg border-t-4 border-primary bg-card px-6 py-9 shadow-card sm:px-10">
      <Users className="size-10 text-primary" />
      <h1 className="mt-5 font-display text-3xl font-black">انضم إلى مساحة العمل</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">اعمل مع فريقك البشري على المشاريع والمهام المشتركة. ادخل بنفس البريد الإلكتروني الذي وصلت إليه الدعوة.</p>
      {!token || !/^[a-f0-9]{64}$/.test(token) ? <p role="alert" className="mt-5 text-sm text-destructive">رابط الدعوة غير صحيح.</p> : loading ? <p role="status" className="mt-5 text-sm">نتحقق من حسابك…</p> : !user ? <div className="mt-6 space-y-3"><p className="text-sm">سجّل الدخول أولاً بالبريد المدعو، ثم ارجع إلى الدعوة.</p><Button asChild><Link to="/auth" search={{ mode: "signin", invite: token }}>تسجيل الدخول</Link></Button><Button asChild variant="outline"><Link to="/auth" search={{ mode: "signup", invite: token }}>إنشاء حساب</Link></Button></div> : <div className="mt-6"><p className="mb-4 text-sm text-muted-foreground" dir="ltr">{user.email}</p><Button onClick={join} disabled={busy || done}>{busy ? "جارٍ الانضمام…" : done ? "تم الانضمام" : "قبول الدعوة"}</Button></div>}
      {done && <p role="status" className="mt-4 flex gap-2 text-sm text-jade-deep"><CheckCircle2 className="size-4" /> انضممت للفريق.</p>}
      {error && <p role="alert" className="mt-4 flex gap-2 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" /> {error}</p>}
    </div>
  </main>;
}