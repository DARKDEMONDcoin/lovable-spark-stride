import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { CheckCircle2, Heart, Lightbulb, Loader2, MessageSquareText, Send, Sparkles, Star, Wrench } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/lib/data";
import { submitProductFeedback } from "@/lib/support.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/feedback")({
  head: () => ({ meta: [
    { title: "الملاحظات والآراء | سهل" },
    { name: "description", content: "شارك رأيك أو بلّغ فريق سهل عن مشكلة." },
    { property: "og:title", content: "الملاحظات والآراء | سهل" },
    { property: "og:description", content: "شارك رأيك أو بلّغ فريق سهل عن مشكلة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const send = useServerFn(submitProductFeedback);
  const { data: workspace } = useWorkspace();
  const [kind, setKind] = useState<"idea" | "improvement" | "issue" | "praise">("improvement");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const kinds = [
    { value: "idea" as const, label: "فكرة جديدة", icon: Lightbulb, tone: "text-gold-deep bg-gold-soft" },
    { value: "improvement" as const, label: "تحسين تجربة", icon: Sparkles, tone: "text-jade-deep bg-jade/10" },
    { value: "issue" as const, label: "مشكلة واجهتني", icon: Wrench, tone: "text-coral bg-coral/10" },
    { value: "praise" as const, label: "شيء أعجبني", icon: Heart, tone: "text-primary bg-primary/10" },
  ];

  async function submit() {
    if (!rating || message.trim().length < 10) return;
    setSending(true); setError("");
    try {
      await send({ data: { workspaceId: workspace?.id ?? null, kind, rating, message, pagePath: window.location.pathname } });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر الإرسال الآن.");
    } finally { setSending(false); }
  }

  return <AppShell title="الملاحظات والآراء" lead="صوتك يصل مباشرة إلى فريق المنتج">
    <div className="mx-auto max-w-5xl pb-14">
      <section className="relative overflow-hidden rounded-lg border border-border bg-ink px-6 py-9 text-primary-foreground sm:px-10">
        <div className="feedback-signal" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 text-sm font-black text-gold"><MessageSquareText className="size-4" /> نبني سهل معك</span>
          <h2 className="mt-3 font-display text-3xl font-black leading-tight sm:text-4xl">قلها كما هي. كل ملاحظة تصنع قراراً أفضل.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-primary-foreground/70">لا توجد إجابات مثالية هنا. أخبرنا ما الذي سهّل عملك، وما الذي عطّلك، وما الذي تتمنى رؤيته.</p>
        </div>
      </section>

      <section className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-7">
          {sent ? <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid min-h-[28rem] place-items-center text-center">
            <div><span className="mx-auto grid size-16 place-items-center rounded-full bg-jade/10 text-jade-deep"><CheckCircle2 className="size-8" /></span><h2 className="mt-5 font-display text-2xl font-black">وصل صوتك</h2><p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">شكراً لأنك تساعدنا على تحسين سهل. سيفحص فريق المنتج ملاحظتك ضمن المراجعة القادمة.</p><Button variant="outline" className="mt-6" onClick={() => { setSent(false); setMessage(""); setRating(0); }}>إرسال ملاحظة أخرى</Button></div>
          </motion.div> : <>
            <div><p className="text-xs font-black text-muted-foreground">١. اختر نوع الملاحظة</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{kinds.map((item) => <Button key={item.value} type="button" variant="outline" onClick={() => setKind(item.value)} className={cn("h-auto min-h-24 flex-col gap-3 whitespace-normal border-border px-2 py-4", kind === item.value && "border-primary bg-primary/5 ring-1 ring-primary")}><span className={cn("grid size-9 place-items-center rounded-full", item.tone)}><item.icon className="size-4" /></span><span className="text-xs font-black">{item.label}</span></Button>)}</div></div>
            <div className="mt-7"><p className="text-xs font-black text-muted-foreground">٢. كيف كانت تجربتك إجمالاً؟</p><div className="mt-3 flex gap-1" dir="ltr">{[1,2,3,4,5].map((value) => <Button key={value} type="button" variant="ghost" size="icon" aria-label={`${value} من 5`} onClick={() => setRating(value)} className="size-11"><Star className={cn("size-7 transition-all", value <= rating ? "fill-gold text-gold" : "text-border")} /></Button>)}</div></div>
            <div className="mt-7"><label htmlFor="feedback-message" className="text-xs font-black text-muted-foreground">٣. احكِ لنا بالتفصيل</label><Textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} className="mt-3 min-h-40 resize-y bg-background p-4 leading-7" placeholder="ما الذي حدث؟ وما الذي كنت تتوقعه؟ وكيف نجعل التجربة أفضل؟" /><div className="mt-2 flex justify-between gap-3 text-[0.7rem] text-muted-foreground"><span>لا ترسل كلمات مرور أو بيانات دفع.</span><span>{message.length.toLocaleString("ar")} / ٤٠٠٠</span></div></div>
            {error ? <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">{error}</p> : null}
            <Button className="mt-6 h-12 w-full font-black sm:w-auto sm:min-w-44" disabled={!rating || message.trim().length < 10 || sending} onClick={() => void submit()}>{sending ? <Loader2 className="animate-spin" /> : <Send />} إرسال الملاحظة</Button>
          </>}
        </div>
        <aside className="space-y-4">
          <div className="border-t-2 border-primary pt-5"><p className="font-display text-lg font-black">ما الذي يحدث بعدها؟</p><ol className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground"><li><b className="text-foreground">١. نقرأها</b><br />تصل إلى فريق المنتج مرتبطة بمساحة عملك.</li><li><b className="text-foreground">٢. نصنّفها</b><br />نبحث عن الأثر والتكرار والأولوية.</li><li><b className="text-foreground">٣. نتصرف</b><br />نصلح العطل أو نضع التحسين في المسار المناسب.</li></ol></div>
          <div className="rounded-lg bg-secondary/70 p-5"><p className="text-sm font-black">تحتاج مساعدة عاجلة؟</p><p className="mt-1 text-xs leading-6 text-muted-foreground">صفحة الدعم أنسب للمشكلات التي تمنعك من العمل وتحتاج رداً.</p></div>
        </aside>
      </section>
    </div>
  </AppShell>;
}