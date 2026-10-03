/** وقت آخر رسالة بأسلوب واتساب: الساعة اليوم، «أمس»، اسم اليوم خلال أسبوع، ثم التاريخ. */
export function inboxTime(iso?: string | null, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).format(d);
  if (days === 1) return "أمس";
  if (days < 7) return new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(d);
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "numeric", year: "2-digit" }).format(d);
}
