import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { ArrowLeft, Check, CheckCircle2, Clock3, Coins, Copy, Crown, DollarSign, Gift, Link2, Loader2, MousePointerClick, Scale, Share2, Sparkles, TrendingUp, UserCheck, Users, WalletCards, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getReferralDashboard, requestReferralPayout } from "@/lib/referral.functions";
import { SITE_ORIGIN } from "@/lib/site-origin";

export const Route = createFileRoute("/app/referral")({
  head: () => ({ meta: [
    { title: "شارك واربح حتى ٥٠٪ | سهل" },
    { name: "description", content: "لوحة إحالات سهل: شارك رابطك، تابع عملاءك وأرباحك، وارتقِ بعمولتك حتى ٥٠٪." },
    { property: "og:title", content: "شارك واربح حتى ٥٠٪ | سهل" },
    { property: "og:description", content: "تابع الإحالات والعمولات وطلبات السحب من مكان واحد." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ReferralPage,
});

const levels = [
  { count: 0, rate: 20, name: "البداية" },
  { count: 5, rate: 30, name: "الشريك" },
  { count: 10, rate: 40, name: "المحترف" },
  { count: 25, rate: 50, name: "النخبة" },
] as const;

const referralStatuses: Record<string, { label: string; className: string }> = {
  signed_up: { label: "سجّل", className: "bg-secondary text-secondary-foreground" },
  trial: { label: "يجرب الآن", className: "bg-gold-soft text-gold-deep" },
  active: { label: "عميل نشط", className: "bg-jade/10 text-jade-deep" },
  cancelled: { label: "غير نشط", className: "bg-muted text-muted-foreground" },
  held: { label: "قيد المراجعة", className: "bg-coral/10 text-coral" },
};

function money(cents: number) {
  return new Intl.NumberFormat("ar", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100);
}

function WealthOrbit() {
  const coins = ["$", "٪", "+", "$", "↑", "٪"];
  return <div className="relative mx-auto aspect-square w-full max-w-72" aria-hidden="true">
    <motion.div className="absolute inset-[12%] rounded-full border border-gold/25" animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }}>
      {coins.map((coin, index) => <motion.span key={`${coin}-${index}`} className="absolute grid size-10 place-items-center rounded-full border border-gold/30 bg-gold-soft font-display text-lg font-black text-gold-deep shadow-card first:left-1/2 first:top-0 first:-translate-x-1/2 [&:nth-child(2)]:right-0 [&:nth-child(2)]:top-1/3 [&:nth-child(3)]:bottom-0 [&:nth-child(3)]:right-1/4 [&:nth-child(4)]:bottom-3 [&:nth-child(4)]:left-2 [&:nth-child(5)]:left-0 [&:nth-child(5)]:top-1/3 [&:nth-child(6)]:right-4 [&:nth-child(6)]:top-3" animate={{ rotate: -360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }}>{coin}</motion.span>)}
    </motion.div>
    <motion.div className="absolute inset-[29%] grid place-items-center rounded-full border border-primary-foreground/15 bg-card text-foreground shadow-lift" animate={{ y: [0, -7, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}><div className="text-center"><Crown className="mx-auto size-8 text-gold" /><strong className="mt-1 block font-display text-4xl font-black">٥٠٪</strong><span className="text-[0.65rem] font-black text-muted-foreground">أعلى عمولة</span></div></motion.div>
  </div>;
}

function ReferralPage() {
  const load = useServerFn(getReferralDashboard);
  const payout = useServerFn(requestReferralPayout);
  const qc = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [method, setMethod] = useState<"bank" | "paypal" | "wallet">("bank");
  const [destination, setDestination] = useState("");
  const query = useQuery({ queryKey: ["referral-dashboard"], queryFn: () => load() });
  const dashboard = query.data;
  const referralUrl = dashboard ? `${SITE_ORIGIN}/r/${dashboard.code}` : "";
  const currentLevelIndex = dashboard ? levels.reduce((found, level, index) => dashboard.active >= level.count ? index : found, 0) : 0;
  const currentLevel = levels[Math.max(0, currentLevelIndex)] ?? levels[0];
  const nextLevel = levels[currentLevelIndex + 1];
  const progress = nextLevel ? ((dashboard?.active ?? 0) - currentLevel.count) / (nextLevel.count - currentLevel.count) * 100 : 100;
  const conversionRate = dashboard?.clicks ? Math.round((dashboard.signups / dashboard.clicks) * 100) : 0;
  const withdrawal = useMutation({
    mutationFn: () => payout({ data: { method, destination } }),
    onSuccess: async () => {
      setWithdrawOpen(false);
      setDestination("");
      toast.success("تم إرسال طلب السحب للمراجعة");
      await qc.invalidateQueries({ queryKey: ["referral-dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر إرسال الطلب"),
  });
  const stats = useMemo(() => dashboard ? [
    { label: "زيارات الرابط", value: dashboard.clicks.toLocaleString("ar"), icon: MousePointerClick },
    { label: "حسابات جديدة", value: dashboard.signups.toLocaleString("ar"), icon: Users },
    { label: "عملاء نشطون", value: dashboard.active.toLocaleString("ar"), icon: UserCheck },
    { label: "معدل التحويل", value: `${conversionRate.toLocaleString("ar")}٪`, icon: TrendingUp },
  ] : [], [dashboard, conversionRate]);

  async function copyLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    toast.success("تم نسخ رابطك");
  }

  async function shareLink() {
    if (!referralUrl) return;
    if (navigator.share) await navigator.share({ title: "جرّب سهل", text: "هذا ترشيحي لك لتجربة سهل وفريقه الذكي.", url: referralUrl });
    else await copyLink();
  }

  return <AppShell title="شارك واربح" lead="حوّل توصيتك إلى دخل واضح ومستمر">
    {query.isLoading ? <div className="grid min-h-[50vh] place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div> : query.isError || !dashboard ? <div className="border-t border-border py-12"><h2 className="font-display text-xl font-black">تعذّر تحميل لوحة الإحالة</h2><Button className="mt-5" onClick={() => void query.refetch()}>حاول مرة أخرى</Button></div> : <div className="space-y-8 pb-12">
      <section className="relative overflow-hidden rounded-lg bg-ink px-5 py-8 text-primary-foreground sm:px-9 sm:py-10">
        <motion.div className="absolute inset-x-0 bottom-0 h-px bg-gold" animate={{ scaleX: [0.15, 1, 0.15], opacity: [0.3, 1, 0.3] }} transition={{ duration: 5, repeat: Infinity }} aria-hidden="true" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-center">
          <div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm font-black text-gold"><Sparkles className="size-4" /> نادي شركاء سهل</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }} className="mt-3 max-w-3xl font-display text-3xl font-black leading-tight sm:text-5xl">كل ترشيح صادق يمكن أن يبني لك دخلاً يتكرر.</motion.h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-primary-foreground/70">شارك سهل مع أصحاب الأعمال الذين تثق بهم، واربح من مدفوعاتهم المؤكدة بنسبة تبدأ من ٢٠٪ وتصل إلى ٥٠٪.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full border border-primary-foreground/15 px-3 py-1.5"><Zap className="me-1 inline size-3.5 text-gold" /> تتبع لحظي</span><span className="rounded-full border border-primary-foreground/15 px-3 py-1.5"><CheckCircle2 className="me-1 inline size-3.5 text-jade" /> مدفوعات موثقة</span><span className="rounded-full border border-primary-foreground/15 px-3 py-1.5"><Scale className="me-1 inline size-3.5 text-gold" /> شروط شفافة</span></div>
          </div>
          <WealthOrbit />
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3" aria-label="حالة أرباحك">
        <div className="bg-card p-5"><p className="text-xs font-black text-muted-foreground">عمولتك الآن</p><p className="mt-2 font-display text-4xl font-black text-primary">{dashboard.rate.toLocaleString("ar")}٪</p><p className="mt-1 text-xs text-muted-foreground">مستوى {currentLevel.name}</p></div>
        <div className="bg-card p-5"><p className="text-xs font-black text-muted-foreground">إجمالي ما كسبته</p><p className="mt-2 font-display text-4xl font-black">{money(dashboard.totals.earned)}</p><p className="mt-1 text-xs text-muted-foreground">من مدفوعات مؤكدة فقط</p></div>
        <div className="relative overflow-hidden bg-gold-soft p-5"><Coins className="absolute -bottom-3 -left-3 size-24 text-gold/15" /><p className="relative text-xs font-black text-gold-deep">الرصيد الجاهز للسحب</p><p className="relative mt-2 font-display text-4xl font-black text-gold-deep">{money(dashboard.totals.available)}</p><p className="relative mt-1 text-xs text-gold-deep/70">الحد الأدنى ٥٠ دولاراً</p></div>
      </section>

      <section aria-labelledby="share-title">
        <div className="mb-4 flex items-end justify-between gap-4"><div><h2 id="share-title" className="font-display text-xl font-black">أرسل أول دعوة الآن</h2><p className="mt-1 text-sm text-muted-foreground">اختر شخصاً سيستفيد فعلاً؛ الثقة تحوّل أفضل من الإرسال العشوائي.</p></div><Gift className="size-6 text-primary" /></div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-secondary/40 px-4 py-3" dir="ltr"><Link2 className="size-4 shrink-0 text-primary" /><code className="min-w-0 flex-1 truncate text-xs font-bold sm:text-sm">{referralUrl}</code></div>
          <Button variant="outline" className="h-12 font-black" onClick={copyLink}><Copy /> نسخ</Button>
          <Button className="h-12 font-black" onClick={() => void shareLink()}><Share2 /> مشاركة الرابط</Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4" aria-label="ملخص الإحالات">
        {stats.map((stat, index) => <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }} className="bg-card p-4 sm:p-5"><stat.icon className="size-5 text-primary" /><p className="mt-5 font-display text-2xl font-black sm:text-3xl">{stat.value}</p><p className="mt-1 text-xs font-bold text-muted-foreground">{stat.label}</p></motion.div>)}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="border-t border-border pt-6">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-black">طريقك إلى ٥٠٪</h2><p className="mt-1 text-sm text-muted-foreground">المستوى يعتمد على عدد العملاء النشطين.</p></div>{nextLevel ? <span className="text-xs font-black text-primary">باقي {(nextLevel.count - dashboard.active).toLocaleString("ar")}</span> : <span className="text-xs font-black text-jade">أعلى مستوى</span>}</div>
          <Progress value={Math.max(0, Math.min(100, progress))} className="mt-6 h-2" />
          <div className="mt-5 grid grid-cols-4 gap-2">
            {levels.map((level) => { const reached = dashboard.active >= level.count; return <div key={level.rate} className="text-center"><span className={`mx-auto grid size-7 place-items-center rounded-full border text-xs font-black ${reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{reached ? <Check className="size-4" /> : level.count.toLocaleString("ar")}</span><p className="mt-2 text-xs font-black">{level.rate.toLocaleString("ar")}٪</p><p className="hidden text-[0.65rem] text-muted-foreground sm:block">{level.name}</p></div>; })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-secondary/35 p-5">
          <div className="flex items-center gap-3"><WalletCards className="size-5 text-jade" /><h2 className="font-display text-lg font-black">الرصيد المتاح</h2></div>
          <p className="mt-5 font-display text-4xl font-black">{money(dashboard.totals.available)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">قيد الانتظار</p><p className="mt-1 font-black">{money(dashboard.totals.pending)}</p></div><div><p className="text-muted-foreground">تم دفعه</p><p className="mt-1 font-black">{money(dashboard.totals.paid)}</p></div></div>
          <Button className="mt-6 w-full font-black" disabled={dashboard.totals.available < 5000 || dashboard.totals.reserved > 0} onClick={() => setWithdrawOpen(true)}>طلب سحب الأرباح <ArrowLeft /></Button>
          <p className="mt-3 text-center text-[0.68rem] leading-5 text-muted-foreground">الحد الأدنى ٥٠ دولاراً. العمولات تصبح متاحة بعد فترة مراجعة ٣٠ يوماً.</p>
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-xl font-black">آخر الإحالات</h2><p className="mt-1 text-sm text-muted-foreground">لا نعرض بيانات شخصية لعملائك.</p></div><Gift className="size-5 text-primary" /></div>
        {dashboard.referrals.length ? <Table><TableHeader><TableRow><TableHead className="text-right">الإحالة</TableHead><TableHead className="text-right">الحالة</TableHead><TableHead className="text-right">تاريخ التسجيل</TableHead><TableHead className="text-right">أول دفعة</TableHead></TableRow></TableHeader><TableBody>{dashboard.referrals.slice(0, 8).map((referral) => { const status = referralStatuses[referral.status] ?? { label: "سجّل", className: "bg-secondary text-secondary-foreground" }; return <TableRow key={referral.id}><TableCell className="font-bold">{referral.label}</TableCell><TableCell><span className={`inline-flex rounded-full px-2 py-1 text-[0.68rem] font-black ${status.className}`}>{status.label}</span></TableCell><TableCell className="text-muted-foreground">{new Date(referral.attributedAt).toLocaleDateString("ar")}</TableCell><TableCell className="text-muted-foreground">{referral.firstPaidAt ? new Date(referral.firstPaidAt).toLocaleDateString("ar") : "—"}</TableCell></TableRow>; })}</TableBody></Table> : <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-border bg-secondary/20 px-6 text-center"><div><Users className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-black">أول إحالة تبدأ من مشاركة واحدة</p><p className="mt-1 text-xs text-muted-foreground">انسخ رابطك وأرسله لشخص تعرف أنه سيستفيد.</p></div></div>}
      </section>

      <section className="grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
        {[{ icon: DollarSign, title: "عمولة على المدفوع", text: "تُحتسب العمولة فقط بعد دفع العميل فعلياً، وليست على مجرد التسجيل." }, { icon: Clock3, title: "مراجعة ٣٠ يوماً", text: "تبقى العمولة معلّقة خلال فترة الاسترداد، ثم تنتقل إلى رصيدك المتاح." }, { icon: CheckCircle2, title: "أرقام قابلة للتدقيق", text: "الاسترداد أو إلغاء الدفع يعكس العمولة تلقائياً ويحفظ السبب في السجل." }].map((item) => <article key={item.title} className="border-r-2 border-border pr-4"><item.icon className="size-5 text-primary" /><h3 className="mt-3 text-sm font-black">{item.title}</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">{item.text}</p></article>)}
      </section>
      <section className="flex flex-col items-start justify-between gap-4 rounded-lg border border-border bg-secondary/40 p-5 sm:flex-row sm:items-center"><div><h2 className="font-display text-lg font-black">أرباح واضحة، بلا مفاجآت</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">راجع قواعد احتساب العمولة، الاسترداد، السحب والترويج المسموح قبل المشاركة.</p></div><Button asChild variant="outline" className="shrink-0 font-black"><Link to="/referral-terms"><Scale /> شروط برنامج الإحالة</Link></Button></section>
    </div>}

    <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
      <DialogContent className="max-w-md" dir="rtl" aria-describedby="withdraw-description">
        <DialogTitle className="font-display text-xl font-black">سحب الأرباح</DialogTitle>
        <DialogDescription id="withdraw-description">سيُرسل كامل رصيدك المتاح، وقد يستغرق التحقق والتحويل عدة أيام عمل.</DialogDescription>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="طريقة السحب">
          {([{ value: "bank", label: "حساب بنكي" }, { value: "paypal", label: "PayPal" }, { value: "wallet", label: "محفظة" }] as const).map((option) => <Button key={option.value} type="button" variant={method === option.value ? "default" : "outline"} className="h-11 px-2 text-xs" onClick={() => setMethod(option.value)}>{option.label}</Button>)}
        </div>
        <div><label htmlFor="payout-destination" className="mb-2 block text-xs font-black">بيانات الاستلام</label><Input id="payout-destination" value={destination} onChange={(event) => setDestination(event.target.value)} className="h-11" placeholder={method === "bank" ? "رقم الحساب أو IBAN" : method === "paypal" ? "بريد PayPal" : "رقم المحفظة"} /></div>
        <div className="rounded-md bg-secondary px-4 py-3 text-sm"><span className="text-muted-foreground">المبلغ المطلوب: </span><strong>{money(dashboard?.totals.available ?? 0)}</strong></div>
        <Button className="h-11 w-full font-black" disabled={destination.trim().length < 5 || withdrawal.isPending} onClick={() => withdrawal.mutate()}>{withdrawal.isPending ? <Loader2 className="animate-spin" /> : null} تأكيد طلب السحب</Button>
      </DialogContent>
    </Dialog>
  </AppShell>;
}