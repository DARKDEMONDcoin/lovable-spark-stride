/** يحوّل أخطاء المنصات الخام (JSON إنجليزي) إلى سبب عربي واضح وخطوة تالية. */
export function friendlyPublishError(raw: string): string {
  const t = raw.toLowerCase();
  if (/permission|scope|app review|\(#200\)|\(#10\)/.test(t))
    return "المنصة رفضت النشر لأن صلاحيات الربط ناقصة. أعد ربط الحساب من صفحة التكاملات ووافق على كل الصلاحيات المطلوبة، ثم أعد المحاولة.";
  if (/token|session has expired|oauth|190/.test(t))
    return "انتهت صلاحية ربط الحساب. أعد ربطه من صفحة التكاملات ثم أعد المحاولة.";
  if (/rate|too many|limit/.test(t)) return "المنصة طلبت التمهّل بسبب كثرة الطلبات. أعد المحاولة بعد قليل.";
  if (/image|media|photo|url/.test(t)) return "تعذّر رفع الصورة للمنصة. جرّب صورة أخرى أو انشر بدون صورة.";
  if (/[\u0600-\u06FF]/.test(raw) && !/[{}"]/.test(raw)) return raw;
  return "تعذّر النشر على المنصة. أعد المحاولة، وإن تكرر الخطأ أعد ربط الحساب من صفحة التكاملات.";
}
