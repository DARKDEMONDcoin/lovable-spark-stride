import { chatIntent, type ChatIntent } from "./chat-intent";
import { researchIntent, type ResearchIntent } from "./research-intent";

export type TurnComplexity = "light" | "standard" | "deep";
export type TurnRisk = "low" | "approval";
export type TurnPlan = {
  intent: ChatIntent;
  complexity: TurnComplexity;
  risk: TurnRisk;
  research: ResearchIntent & { depth: "none" | "live" | "deep" };
  useTools: boolean;
  readLinks: boolean;
  verifyOutput: boolean;
  reasoningEffort: "low" | "medium" | "high";
  successChecks: string[];
};

const DEEP =
  /بحث\s*(عميق|شامل|موسّع)|deep\s*research|تقرير\s*(شامل|مفصل)|دراسة\s*(كاملة|شاملة)|استراتيجية|خطة\s*(كاملة|شاملة)|قارن|مقارنة|بالأرقام|منافس/iu;
const ACTION =
  /انشر|أرسل|ارسل|ابعت|احجز|اشتري|اشترِ|ادفع|سجّل|سجل|املأ|نفّذ|نفذ|publish|send|book|buy|pay|submit|register/iu;
const TOOL =
  /افحص|تدقيق|حلّل|حلل|ترتيب|كلمات مفتاحية|تقويم|أداء|ميزانية|تقرير|منافس|قارن|انشر|أرسل|احجز|اشتري|رابط|https?:\/\//iu;

export function planTurn(message: string, longForm = false): TurnPlan {
  const text = (message ?? "").trim();
  const intent = chatIntent(text);
  const research = researchIntent(text);
  const readLinks = /https?:\/\//iu.test(text);
  const deep = longForm || DEEP.test(text) || text.length > 500;
  const complexity: TurnComplexity =
    intent === "smalltalk" ? "light" : deep ? "deep" : intent === "work" ? "standard" : "light";
  const depth = research.wanted ? (deep ? "deep" : "live") : "none";
  const risk: TurnRisk = ACTION.test(text) ? "approval" : "low";
  const useTools = intent === "work" && TOOL.test(text);
  const verifyOutput = intent === "work";
  const reasoningEffort =
    complexity === "deep" ? "high" : intent === "smalltalk" || intent === "question" ? "low" : "medium";
  const successChecks = [
    "تلبية المطلوب كاملاً دون فراغات",
    research.wanted ? "إسناد الحقائق المتغيرة إلى أدلة حيّة" : "عدم اختلاق حقائق أو أرقام",
    risk === "approval" ? "عدم ادعاء التنفيذ قبل تحقق النتيجة واعتماد المالك" : "خطوة تالية واحدة قابلة للتنفيذ",
  ];
  return {
    intent,
    complexity,
    risk,
    research: { ...research, depth },
    useTools,
    readLinks,
    verifyOutput,
    reasoningEffort,
    successChecks,
  };
}

export function turnPlanBlock(plan: TurnPlan): string {
  return [
    "## خطة التنفيذ الداخلية لهذه الرسالة",
    `التعقيد: ${plan.complexity} · البحث: ${plan.research.depth} · المخاطر: ${plan.risk}`,
    `معايير النجاح:\n- ${plan.successChecks.join("\n- ")}`,
    "نفّذ بهذا الترتيب داخلياً: افهم النتيجة ← اجمع الأدلة/شغّل الأدوات اللازمة ← أنشئ المخرج ← راجعه ← سلّم النسخة النهائية فقط.",
  ].join("\n");
}