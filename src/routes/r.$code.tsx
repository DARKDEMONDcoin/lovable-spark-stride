import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Coins, Crown, ShieldCheck, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/LogoMark";

export const Route = createFileRoute("/r/$code")({
  head: () => ({ meta: [
    { title: "دعوة إلى سهل | فريقك الذكي للعمل" },
    { name: "description", content: "دعوة شخصية لتجربة سهل وبناء فريق موظفين ذكاء اصطناعي يعمل بالعربية." },
    { property: "og:title", content: "دعوة إلى سهل" },
    { property: "og:description", content: "ابدأ مع فريق موظفين ذكاء اصطناعي يعمل بالعربية، عبر دعوة شخصية." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ReferralLanding,
});

function ReferralLanding() {
  const { code } = Route.useParams();
  const validCode = /^[A-Z0-9]{8,16}$/.test(code.toUpperCase()) ? code.toUpperCase() : "";
  useEffect(() => {
    if (!validCode) return;
    try { window.localStorage.setItem("sahl:referral-code", validCode); } catch { /* Storage is optional. */ }
    void fetch("/api/public/referral-click", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: validCode, path: window.location.pathname }) });
  }, [validCode]);

  return <main className="min-h-screen bg-secondary/40 px-4 py-6 sm:grid sm:place-items-center sm:py-12" dir="rtl">
    <section className="w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-lift">
      <header className="relative overflow-hidden bg-ink px-6 py-10 text-primary-foreground sm:px-12 sm:py-14">
        <motion.div className="absolute -left-16 -top-16 size-64 rounded-full border border-gold/20" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 5, repeat: Infinity }} aria-hidden="true" />
        <motion.div className="absolute bottom-8 left-10 text-gold/20" animate={{ y: [0, -10, 0], rotate: [0, 6, 0] }} transition={{ duration: 4, repeat: Infinity }} aria-hidden="true"><Coins className="size-28" /></motion.div>
        <div className="relative z-10 max-w-2xl">
          <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm font-black"><LogoMark className="size-9" size={36} /> سهل.</Link>
           <p className="mb-3 flex items-center gap-2 text-sm font-bold text-gold"><Crown className="size-4" /> وصلك ترشيح شخصي</p>
          <h1 className="font-display text-3xl font-black leading-tight sm:text-5xl">كوّن فريقك الذكي، وخلّي الشغل يتحرّك.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-primary-foreground/75 sm:text-base">ستة موظفين ذكاء اصطناعي بالعربية يساعدونك في التسويق والمبيعات وخدمة العملاء والتنظيم، وكل خطوة حساسة تبقى تحت موافقتك.</p>
        </div>
      </header>
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid gap-4 sm:grid-cols-3">
          {[{ icon: Users, title: "فريق متكامل", text: "اختصاصات واضحة تعمل معاً" }, { icon: Check, title: "أنت صاحب القرار", text: "لا نشر أو إرسال دون موافقتك" }, { icon: ShieldCheck, title: "مساحتك محفوظة", text: "عملك منفصل ومحمي" }].map((item) => <div key={item.title} className="border-t border-border pt-4"><item.icon className="size-5 text-jade" /><h2 className="mt-3 text-sm font-black">{item.title}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{item.text}</p></div>)}
        </div>
        <div className="space-y-3"><Button asChild size="lg" className="h-12 w-full rounded-md px-7 font-black"><Link to="/auth" search={{ mode: "signup", ref: validCode || undefined }}>ابدأ مجاناً <ArrowLeft /></Link></Button><Link to="/referral-terms" className="block text-center text-xs font-bold text-muted-foreground hover:text-primary">شروط برنامج الإحالة</Link></div>
      </div>
    </section>
  </main>;
}