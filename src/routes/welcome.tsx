import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Globe2, Loader2, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { team } from "@/data/team";
import { Portrait } from "@/components/site/Portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getWelcomePreview } from "@/lib/welcome-preview.functions";
import type { WelcomePreview } from "@/lib/welcome-preview.server";
import { getWelcomeRecommendation } from "@/lib/welcome-recommendation.functions";
import type { WelcomeRecommendation } from "@/lib/welcome-recommendation.server";
import { welcomeIndustries } from "@/lib/welcome-industries";
import { purposeCopy, purposeMembers, type WelcomePurpose } from "@/lib/welcome-purpose";

const draftKey = "sahl-welcome-draft";
export type WelcomeDraft = { purpose: string; website: string; industry: string; step?: number };
const industries = welcomeIndustries;
const scanStages = ["جاري الفحص", "قريبًا تظهر النتيجة"];
type FindingTab = "offer" | "brand" | "team" | "reach";
const lastStep = 10;

export const Route = createFileRoute("/welcome")({
  ssr: false,
  validateSearch: z.object({ plan: z.enum(["start", "growth"]).optional() }),
  head: () => ({ meta: [
    { title: "تعرّف على فريقك قبل التسجيل | سهل" },
    { name: "description", content: "اكتشف فريق سهل وحلّل موقعك واختَر نشاطك قبل إنشاء حسابك." },
    { property: "og:title", content: "تعرّف على فريقك الرقمي — سهل" },
    { property: "og:description", content: "جولة تفاعلية للتعرف على فريق سهل واكتشاف نشاطك من موقعك قبل التسجيل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Welcome,
});

function Welcome() {
  const { plan } = Route.useSearch();
  const inspect = useServerFn(getWelcomePreview);
  const recommend = useServerFn(getWelcomeRecommendation);
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState("");
  const chosenPurpose: WelcomePurpose = purpose === "job" || purpose === "personal" ? purpose : "business";
  const copy = purposeCopy[chosenPurpose];
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [otherSelected, setOtherSelected] = useState(false);
  const [query, setQuery] = useState("");
  const [example, setExample] = useState(false);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<WelcomePreview | null>(null);
  const [findingTab, setFindingTab] = useState<FindingTab>("offer");
  const [scanStage, setScanStage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recommendation, setRecommendation] = useState<WelcomeRecommendation | null>(null);
  const [recommendationState, setRecommendationState] = useState<"loading" | "ready" | "fallback">("loading");
  const recommendationCache = useRef(new Map<string, WelcomeRecommendation>());
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<WelcomeDraft>;
        setPurpose(typeof draft.purpose === "string" ? draft.purpose : "");
        setWebsite(typeof draft.website === "string" ? draft.website : "");
        setIndustry(typeof draft.industry === "string" ? draft.industry : "");
        setOtherSelected(draft.industry === "أخرى" || (typeof draft.industry === "string" && !!draft.industry && !industries.includes(draft.industry)));
        if (typeof draft.step === "number" && Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= lastStep) setStep(draft.step);
      }
    } catch { /* Storage is optional. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ purpose, website, industry, step } satisfies WelcomeDraft)); } catch { /* Storage is optional. */ }
  }, [ready, purpose, website, industry, step]);
  useEffect(() => { setExample(false); }, [step]);
  const next = () => setStep((current) => Math.min(current + 1, lastStep));
  const back = () => setStep((current) => Math.max(current - 1, 0));
  const member = step >= 2 && step <= 7 ? team[step - 2] : undefined;
  const description = member ? purposeMembers[chosenPurpose][member.id] : undefined;
  const filtered = industries.filter((item) => item.includes(query.trim()) || item === "أخرى");
  const customIndustry = otherSelected;
  const industryValid = industry !== "أخرى" && z.string().trim().min(2).max(60).regex(/^[\p{L}\p{N}\s\-،&/().]+$/u).safeParse(industry).success;
  const canContinue = step === 0 ? Boolean(purpose) : step === 8 ? industryValid : true;
  const showPreview = preview && preview.url === website.trim();
  useEffect(() => {
    if (step !== 9 || !industryValid || !ready) return;
    let cancelled = false;
    setRecommendation(null);
    setRecommendationState("loading");
    const input = {
      industry: industry.trim(),
      purpose: chosenPurpose,
      ...(showPreview ? { site: { name: preview.name.slice(0, 90), summary: (preview.profile?.oneLiner || preview.summary).slice(0, 180), products: (preview.profile?.offerings.length ? preview.profile.offerings : preview.products).slice(0, 3).map((v) => v.slice(0, 80)), actions: preview.actions.slice(0, 2), platform: preview.platform } } : {}),
    };
    const cacheKey = JSON.stringify(input);
    const cached = recommendationCache.current.get(cacheKey);
    if (cached) { setRecommendation(cached); setRecommendationState("ready"); return; }
    recommend({ data: input }).then((result) => {
      recommendationCache.current.set(cacheKey, result);
      if (!cancelled) { setRecommendation(result); setRecommendationState("ready"); }
    }).catch(async () => {
      const { fallbackRecommendation } = await import("@/lib/welcome-recommendation-fallback");
      if (!cancelled) { setRecommendation(fallbackRecommendation(input)); setRecommendationState("fallback"); }
    });
    return () => { cancelled = true; };
  }, [step, industry, chosenPurpose, preview, website, ready]);

  async function scan() {
    if (!website.trim() || loading) return;
    setError(""); setLoading(true); setPreview(null); setFindingTab("offer"); setScanStage(0);
    const timer = window.setInterval(() => setScanStage((s) => Math.min(s + 1, scanStages.length - 1)), 2800);
    try {
      const result = await inspect({ data: { url: website.trim() } });
      setPreview(result);
      setWebsite(result.url);
      if (result.industry && welcomeIndustries.includes(result.industry) && result.industry !== "أخرى") { setIndustry(result.industry); setOtherSelected(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر فحص الموقع الآن. يمكنك المتابعة دون فحص."); }
    finally { window.clearInterval(timer); setLoading(false); }
  }

  return <div className="welcome-stage" dir="rtl">
    <header className="welcome-header">
      <Link to="/" className="font-display text-xl font-black" aria-label="سهل — الرئيسية">سهل<span className="text-primary">.</span></Link>
      <span className="welcome-header-note">مساحة تبدأ منك</span>
      <Link to="/auth" search={{ mode: "signin" }} className="text-xs font-bold text-foreground underline decoration-primary/50 underline-offset-4">لديك حساب؟ ادخل</Link>
    </header>
    <main className="welcome-main">
      <div className="welcome-progress"><div className="flex justify-between text-xs font-bold text-muted-foreground"><span>{step < 2 ? "اكتشف نشاطك" : step < 8 ? "تعرّف على فريقك" : "لنبدأ معًا"}</span><span dir="ltr">{String(step + 1).padStart(2, "0")} / 11</span></div><div className="welcome-progress-track" role="progressbar" aria-label="تقدم الجولة" aria-valuemin={0} aria-valuemax={11} aria-valuenow={step + 1}><span style={{ width: `${((step + 1) / 11) * 100}%` }} /></div></div>
      <div key={step} className="welcome-appear welcome-content">
        {step === 0 && <section className="welcome-centered">
          <span className="welcome-eyebrow"><Sparkles className="size-4" /> البداية</span>
          <h1 className="welcome-title">فريقك يبدأ من قصتك.</h1>
          <p className="welcome-lead">كيف تريد أن يساعدك سهل؟</p>
           <div className="welcome-choices">{[["business", "لإدارة مشروعي", "تسويق ومبيعات وتنظيم في مكان واحد"], ["job", "لعملي اليومي", "فريق يساعدك في المهام ويوفر وقتك"], ["personal", "لاستكشاف الإمكانيات", "تعرّف على الفريق ثم قرر"]].map(([value, label, hint]) => <Button key={value} type="button" variant="outline" aria-pressed={purpose === value} onClick={() => { if (purpose !== value) { setWebsite(""); setPreview(null); setIndustry(""); setOtherSelected(false); setRecommendation(null); } setPurpose(value ?? ""); }} className={cn("welcome-choice", purpose === value && "welcome-choice-active")}><span className="min-w-0 flex-1 text-start"><strong className="block text-sm sm:text-base">{label}</strong><span className="block whitespace-normal text-xs font-normal text-muted-foreground">{hint}</span></span><span className="welcome-radio">{purpose === value && <Check className="size-3" />}</span></Button>)}</div>
        </section>}
        {step === 1 && <section className="welcome-centered welcome-website">
           <span className="welcome-eyebrow"><Globe2 className="size-4" /> {chosenPurpose === "personal" ? "فكرتك" : "بدايتك"}</span>
           <h1 className="welcome-title">{copy.website}</h1>
           <p className="welcome-lead">{copy.websiteLead}</p>
          <form className="welcome-url-form" onSubmit={(e) => { e.preventDefault(); void scan(); }}><label className="sr-only" htmlFor="welcome-url">رابط موقعك</label><input id="welcome-url" className="welcome-input" dir="ltr" type="text" inputMode="url" value={website} onChange={(e) => { setWebsite(e.target.value); setError(""); setPreview(null); }} placeholder="yourbusiness.com" autoComplete="url" /><Button type="submit" disabled={!website.trim() || loading} className="welcome-scan-btn">{loading ? <Loader2 className="animate-spin" /> : <Search />}<span>{loading ? "نفحص…" : "اكتشف"}</span></Button></form>
           {loading && <div className="welcome-scan-progress" role="status" aria-live="polite"><Loader2 className="size-4 animate-spin" /> {scanStages[scanStage]}</div>}
          {error && <p className="welcome-error" role="alert">{error}</p>}
          {showPreview && <SiteCard preview={preview} tab={findingTab} onTab={setFindingTab} />}
          <p className="welcome-disclaimer">هذه قراءة أولية لما يظهر علنًا، وقد تغيب معلومات عن صفحات محمية أو غير متاحة. الفحص الأعمق بعد التسجيل.</p>
           <Button type="button" variant="ghost" className="welcome-skip" onClick={() => { setWebsite(""); setPreview(null); next(); }}>{copy.websiteSkip} <ChevronLeft /></Button>
        </section>}
         {member && description && <section className="welcome-person"><div className="welcome-person-copy"><span className="welcome-eyebrow">فريقك · {step - 1} / ٦</span><p className="welcome-role">{member.role}</p><h1 className="welcome-title">{member.name}، إلى جانبك.</h1><p className="welcome-person-lead">{description.headline}</p><ul className="welcome-tasks">{description.tasks.map((task) => <li key={task}><Check className="size-4 text-jade" />{task}</li>)}</ul><Button type="button" variant="outline" className="welcome-example-toggle" onClick={() => setExample(!example)} aria-expanded={example}>{example ? "إخفاء المثال" : "شاهد مثالًا"} {example ? <X /> : <ArrowLeft />}</Button>{example && <div className="welcome-sample" role="region" aria-label={`مثال من ${member.name}`}><span className="text-xs font-bold text-primary">مثال عملي</span><p>{description.example}</p></div>}</div><div className="welcome-portrait"><Portrait memberId={member.id} name={member.name} eager className="h-full w-full" /></div></section>}
         {step === 8 && <section className="welcome-centered"><span className="welcome-eyebrow"><Search className="size-4" /> {chosenPurpose === "personal" ? "اهتمامك" : "مجالك"}</span><h1 className="welcome-title">{copy.industry}</h1><p className="welcome-lead">{copy.industryLead}</p><label className="welcome-industry-search"><span className="sr-only">ابحث عن المجال</span><Search className="size-4" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={chosenPurpose === "personal" ? "ابحث عن اهتمامك…" : "ابحث عن مجالك…"} maxLength={60} /></label><div className="welcome-industries">{filtered.map((item) => <Button key={item} type="button" variant="outline" aria-pressed={item === "أخرى" ? customIndustry : !customIndustry && industry === item} onClick={() => { if (item === "أخرى") { setOtherSelected(true); setIndustry("أخرى"); } else { setOtherSelected(false); setIndustry(item); next(); } }} className={cn("welcome-industry", (item === "أخرى" ? customIndustry : !customIndustry && industry === item) && "welcome-industry-active")}>{item}{(item === "أخرى" ? customIndustry : !customIndustry && industry === item) && <Check className="size-4 shrink-0" />}</Button>)}</div>{customIndustry && <label className="welcome-custom-label" htmlFor="welcome-custom-industry">{chosenPurpose === "personal" ? "ما اهتمامك تحديدًا؟" : "ما مجالك تحديدًا؟"}<input id="welcome-custom-industry" className="welcome-input" autoFocus value={industry === "أخرى" ? "" : industry} onChange={(e) => setIndustry(e.target.value.slice(0, 60) || "أخرى")} maxLength={60} placeholder="مثال: استشارات هندسية" />{industry !== "أخرى" && industry.trim() && !industryValid && <span className="welcome-error">اكتب مجالًا من حرفين إلى ٦٠ حرفًا، دون رموز خاصة.</span>}</label>}</section>}
          {step === 9 && <section className="welcome-centered welcome-recommendation"><span className="welcome-eyebrow"><Sparkles className="size-4" /> {chosenPurpose === "personal" ? "خطوة لاستكشاف فكرتك" : "بداية تناسبك"}</span><h1 className="welcome-title">{copy.recommendation} {industry}.</h1>{recommendationState === "loading" ? <div className="welcome-recommend-loading" role="status"><Loader2 className="size-6 animate-spin text-primary" /><p>نجهز لك خطوة أولى مناسبة…</p></div> : recommendation && <><p className="welcome-lead">{recommendation.insight}</p><div className="welcome-recommend-actions">{recommendation.actions.map((item, i) => <div key={`${item.employee}-${i}`}><span className="welcome-recommend-number">{String(i + 1).padStart(2, "0")}</span><strong>{item.employee}</strong><p>{item.text}</p></div>)}</div><p className="welcome-first-move"><Sparkles className="size-4 shrink-0" />{recommendation.firstMove}</p><p className="welcome-disclaimer">{recommendationState === "fallback" ? "هذه نقطة بداية مقترحة؛ يمكنك تعديلها مع الفريق بعد التسجيل. " : ""}لا نشر أو إرسال دون موافقتك.</p></>}</section>}
         {step === 10 && <section className="welcome-centered"><span className="welcome-eyebrow"><Check className="size-4" /> البداية الحقيقية</span><h1 className="welcome-title">{copy.finish}</h1><p className="welcome-lead">{copy.finishLead}</p><div className="welcome-team">{team.map((person) => <div key={person.id}><Portrait memberId={person.id} name={person.name} className="size-9 rounded-full" /><span>{person.name}</span></div>)}</div><Button asChild className="welcome-signup"><Link to="/auth" search={{ mode: "signup", plan }}>أنشئ حسابك وقابل فريقك <ArrowLeft /></Link></Button><p className="welcome-trust"><ShieldCheck className="size-4" /> لن يُنشر أو يُرسل شيء دون موافقتك</p></section>}
      </div>
       <footer className="welcome-footer"><Button type="button" variant="ghost" disabled={step === 0} onClick={back} className="welcome-back"><ArrowRight /> السابق</Button><span className="welcome-footer-dots" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <span key={i} className={i === step ? "is-active" : ""} />)}</span>{step < lastStep ? <Button type="button" disabled={!canContinue || loading || (step === 9 && recommendationState === "loading")} onClick={next} className="welcome-next">متابعة <ArrowLeft /></Button> : <span className="welcome-footer-spacer" />}</footer>
    </main>
  </div>;
}

const tabs: [FindingTab, string][] = [["offer", "ماذا تقدم"], ["brand", "هويتك"], ["team", "فريقك"], ["reach", "الوصول"]];

function SiteCard({ preview, tab, onTab }: { preview: WelcomePreview; tab: FindingTab; onTab: (t: FindingTab) => void }) {
  const [logoOk, setLogoOk] = useState(true);
  const [imageOk, setImageOk] = useState(true);
  const p = preview.profile;
  const host = new URL(preview.url).hostname.replace(/^www\./, "");
  const offerings = p?.offerings.length ? p.offerings : [...preview.products, ...preview.headings].slice(0, 6);
  const reach = [...preview.socials.map((v) => v.split("/")[0] + " · " + (v.split("/").pop() || "")), ...preview.contacts, ...preview.locations, ...preview.actions.map((v) => `«${v}»`)].slice(0, 9);
  return <div className="welcome-dna" aria-label="ما فهمناه عن نشاطك">
    {preview.image && imageOk && <div className="welcome-dna-cover"><img src={preview.image} alt={`صورة من موقع ${preview.name}`} referrerPolicy="no-referrer" onError={() => setImageOk(false)} /></div>}
    <div className="welcome-dna-head">
      <span className="welcome-dna-logo">{preview.logo && logoOk ? <img src={preview.logo} alt="" referrerPolicy="no-referrer" onError={() => setLogoOk(false)} /> : <Globe2 className="size-5" />}</span>
      <div className="min-w-0 flex-1"><strong className="block truncate">{preview.name}</strong><span dir="ltr" className="block truncate">{host}</span></div>
      {preview.colors.length > 0 && <span className="welcome-dna-swatches" aria-hidden="true">{preview.colors.slice(0, 3).map((c) => <i key={c} style={{ background: c }} />)}</span>}
    </div>
    <p className="welcome-dna-line">{p?.oneLiner || preview.summary || "قرأنا موقعك؛ سنكمل فهم نشاطك معك بعد التسجيل."}</p>
    <div className="welcome-findings-tabs" role="tablist" aria-label="تفاصيل القراءة">{tabs.map(([id, label]) => <Button key={id} type="button" variant="ghost" role="tab" aria-selected={tab === id} onClick={() => onTab(id)} className={cn("welcome-findings-tab", tab === id && "is-active")}>{label}</Button>)}</div>
    <div className="welcome-dna-panel" role="tabpanel">
      {tab === "offer" && <>{offerings.length > 0 ? <div className="welcome-dna-chips">{offerings.map((v) => <span key={v}>{v}</span>)}</div> : <p className="welcome-dna-muted">لم تظهر خدمات واضحة في الصفحات العامة.</p>}{p?.audience && <p className="welcome-dna-row"><b>جمهورك</b>{p.audience}</p>}</>}
      {tab === "brand" && <>{p?.tone && <p className="welcome-dna-row"><b>نبرتك</b>{p.tone}</p>}{p?.valueProps[0] && <p className="welcome-dna-row"><b>ما يميزك</b>{p.valueProps.slice(0, 2).join(" · ")}</p>}<p className="welcome-dna-row"><b>الموقع</b>{[preview.platform, preview.language, p?.market].filter(Boolean).join(" · ") || "—"}</p>{preview.colors.length > 0 && <p className="welcome-dna-row"><b>ألوانك</b><span className="welcome-dna-swatches is-inline">{preview.colors.map((c) => <i key={c} style={{ background: c }} title={c} />)}</span></p>}</>}
      {tab === "team" && (p?.opportunities.length ? <ul className="welcome-dna-team">{p.opportunities.map((o) => <li key={o.employee}><b>{o.employee}</b><span>{o.text}</span></li>)}</ul> : <p className="welcome-dna-muted">سيضع فريقك خطته الأولى بعد التسجيل بناءً على موقعك.</p>)}
      {tab === "reach" && (reach.length ? <div className="welcome-dna-chips">{reach.map((v) => <span key={v} dir="auto">{v}</span>)}</div> : <p className="welcome-dna-muted">لم تظهر حسابات أو وسائل تواصل في الصفحات العامة.</p>)}
    </div>
  </div>;
}
