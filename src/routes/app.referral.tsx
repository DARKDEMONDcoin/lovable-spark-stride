import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CheckCircle2, Clock3, Copy, DollarSign, Gift, Link2, Loader2, MousePointerClick, Share2, Sparkles, TrendingUp, UserCheck, Users, WalletCards } from "lucide-react";
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
      <section className="relative overflow-hidden rounded-lg bg-ink px-5 py-7 text-primary-foreground sm:px-8 sm:py-9">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-gold"><Sparkles className="size-4" /> برنامج شركاء سهل</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-black leading-tight sm:text-4xl">أنت توصي بمن تثق بهم، ونحن نكافئك حتى ٥٠٪.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-primary-foreground/70">عمولتك تُحتسب من المدفوعات المؤكدة لعملائك المحالين. كل رقم وحالة وموعد مراجعة ظاهر لك بوضوح.</p>
          </div>
          <div className="border-r-2 border-gold pr-5"><p className="text-xs font-bold text-primary-foreground/60">عمولتك الحالية</p><p className="mt-1 font-display text-5xl font-black text-gold">{dashboard.rate.toLocaleString("ar")}٪</p><p className="mt-2 text-xs text-primary-foreground/70">مستوى {currentLevel.name}</p></div>
        </div>
      </section>

      <section aria-labelledby="share-title">
        <div className="mb-4"><h2 id="share-title" className="font-display text-xl font-black">رابطك الشخصي</h2><p className="mt-1 text-sm text-muted-foreground">شاركه مع من سيستفيد فعلاً من سهل.</p></div>
        <div className="flex flex-col gap-3 border-y border-border py-5 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-secondary/40 px-4 py-3" dir="ltr"><Link2 className="size-4 shrink-0 text-primary" /><code className="min-w-0 flex-1 truncate text-xs font-bold sm:text-sm">{referralUrl}</code></div>
          <Button variant="outline" className="h-12 font-black" onClick={copyLink}><Copy /> نسخ</Button>
          <Button className="h-12 font-black" onClick={() => void shareLink()}><Share2 /> مشاركة الرابط</Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4" aria-label="ملخص الإحالات">
        {stats.map((stat) => <div key={stat.label} className="bg-card p-4 sm:p-5"><stat.icon className="size-5 text-primary" /><p className="mt-5 font-display text-2xl font-black sm:text-3xl">{stat.value}</p><p className="mt-1 text-xs font-bold text-muted-foreground">{stat.label}</p></div>)}
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