import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { GUEST_EMAIL } from "@/lib/guest.functions";
import { BrandLoader } from "@/components/site/BrandLoader";
import { LiveWorkspaceSync } from "@/lib/live-sync";
import { AppShell } from "@/components/app/AppShell";

/** تحقّق الخادم مرة واحدة فقط؛ التنقّل الداخلي يقرأ الجلسة المحلية فورًا (تجربة واتساب). */
let verifiedUserId: string | null = null;
let verifiedUser: import("@supabase/supabase-js").User | null = null;
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    verifiedUserId = null;
    verifiedUser = null;
  }
});

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    /** بعد التحقق الأول: التنقل الداخلي فوري بلا أي انتظار أو شاشة تحميل (تجربة واتساب). */
    if (verifiedUser) return { user: verifiedUser };
    const { data: local } = await supabase.auth.getSession();
    const sessionUser = local.session?.user;
    if (sessionUser && verifiedUserId === sessionUser.id && sessionUser.email !== GUEST_EMAIL)
      return { user: (verifiedUser = sessionUser) };
    const { data } = await supabase.auth.getUser();
    if (data.user && data.user.email !== GUEST_EMAIL) {
      verifiedUserId = data.user.id;
      verifiedUser = data.user;
      return { user: data.user };
    }
    verifiedUserId = null;
    if (data.user) await supabase.auth.signOut();
    throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  pendingMs: 150,
  pendingComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div className="flex flex-col items-center">
        <BrandLoader size="lg" label={null} />
        <p className="mt-4 font-display text-lg font-black">نجهّز مساحة عملك…</p>
        <p className="mt-1 text-sm text-muted-foreground">ثوانٍ قليلة ويكون فريقك جاهزًا.</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-lg font-black">تعذّر فتح مساحة العمل</p>
        <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        <Link
          to="/app"
          className="mt-4 inline-block rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background"
        >
          حاول مرة أخرى
        </Link>
      </div>
    </div>
  ),
  component: () => (
    <>
      <LiveWorkspaceSync />
      <AppShell title="مساحة العمل"><Outlet /></AppShell>
    </>
  ),
});
