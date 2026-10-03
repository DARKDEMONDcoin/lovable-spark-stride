/**
 * أوامر المالك النصية على مخرج جاهز داخل الشات: اعتماد/إرسال، إلغاء، رفض، أو تعديل ثم إرسال.
 * تُفهم بالعربية (فصحى وعامية) والإنجليزية؛ أي نص آخر يذهب للموظف كرسالة عادية.
 */
export type ChatCommand =
  | { kind: "approve" }
  | { kind: "cancel" }
  | { kind: "reject"; reason: string }
  | { kind: "edit"; instruction: string; thenApprove: boolean };

const APPROVE_WORDS =
  "(?:اعتمد(?:ه|ها)?|اعتمده|ابعت(?:ه|ها|و)?|إبعت(?:ه|ها)?|ارسل(?:ه|ها)?|أرسل(?:ه|ها)?|رد|ردّ|انشر(?:ه|ها)?|أنشر(?:ه|ها)?|نفذ|نفّذ(?:ه|ها)?|نفذه|تمام|موافق|ماشي|اوك|أوك|اوكي|يلا|تم|ok|okay|yes|send(?: it)?|reply|approve|go(?: ahead)?|publish|post it|✅|👍)";
const APPROVE_ONLY = new RegExp(
  `^(?:(?:حلو|ممتاز|بالقرار ده|بالقرار دة)?[\\s،,.!]*${APPROVE_WORDS})+(?:[\\s،,.!]*(?:بالقرار ده|بالقرار دة|كده|كدا|دلوقتي|الآن|now|please|لو سمحت|يا\\s*\\S+))*[\\s.!؟?]*$`,
  "iu",
);
const CANCEL_RE = /^(?:الغ(?:ي|ِ)?|إلغاء|الغاء|لا|لأ|سيبه|سيبها|خلاص|cancel|stop|never ?mind)[\s.!]*$/iu;
const REJECT_RE = /^(?:ارفض(?:ه|ها)?|مرفوض|رفض|reject)(?:[\s:،,-]+(.*))?$/iu;
const EDIT_RE =
  /(?:^|\s)(?:عدل|عدّل|تعديل|غير|غيّر|خلي|خلّي|خليه|خليها|اجعل|اكتب|ضيف|أضف|اضف|احذف|شيل|بدّل|بدل|قصّر|قصر|طوّل|اختصر|صحح|صحّح|رد ب|خلي الرد|edit|change|make|rewrite|shorter|longer|add|remove|replace|fix)(?:\s|$)/iu;
const THEN_APPROVE = new RegExp(
  `(?:\\s|^)(?:ثم|وبعدين|بعدها|و|and|then|,|،)\\s*(?:بعد كده\\s*)?${APPROVE_WORDS}[\\s.!؟?]*$`,
  "iu",
);

export function parseChatCommand(text: string, hasDraft: boolean): ChatCommand | null {
  const t = text.trim();
  if (!t || !hasDraft) return null;
  if (APPROVE_ONLY.test(t)) return { kind: "approve" };
  if (CANCEL_RE.test(t)) return { kind: "cancel" };
  const rej = t.match(REJECT_RE);
  if (rej) return { kind: "reject", reason: (rej[1] ?? "").trim() };
  if (EDIT_RE.test(t)) {
    const thenApprove = THEN_APPROVE.test(t);
    const instruction = thenApprove ? t.replace(THEN_APPROVE, "").trim() : t;
    return { kind: "edit", instruction: instruction || t, thenApprove };
  }
  return null;
}
