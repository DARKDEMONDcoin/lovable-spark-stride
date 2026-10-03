import { useEffect, useState } from "react";
import { Bot, FolderKanban, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "sahl:workspace-tour-done";
const STEPS = [
  { icon: FolderKanban, title: "أنشئ مشروعاً", body: "ابدأ من قالب جاهز مثل «إطلاق منتج» لتحصل على مهام مقترحة فوراً." },
  { icon: Bot, title: "أسند لموظف رقمي", body: "اختر سِراج أو نور أو غيرهما لمهمة، ثم اضغط «نفّذها» لتظهر النتيجة داخل المهمة." },
  { icon: UserPlus, title: "ادعُ فريقك", body: "يصل للمدعو إشعار ليقبل أو يرفض، ثم تعملون معاً بالتعليقات والمرفقات والتقويم." },
];

/** جولة تعريفية قصيرة تظهر مرة واحدة لكل متصفح. */
export function WorkspaceTour() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!window.localStorage.getItem(KEY)); } catch { /* ignore */ } }, []);
  if (!show) return null;
  const close = () => { try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setShow(false); };
  return <aside aria-label="جولة تعريفية" className="relative mt-6 rounded-md border border-primary/25 bg-primary/5 p-4 sm:p-5">
    <Button size="icon" variant="ghost" className="absolute end-2 top-2 size-8" aria-label="إغلاق الجولة" onClick={close}><X className="size-4" /></Button>
    <p className="text-sm font-black">ثلاث خطوات لتبدأ</p>
    <ol className="mt-3 grid gap-3 sm:grid-cols-3">{STEPS.map((s, i) => <li key={s.title} className="flex gap-3 rounded-md bg-background p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><s.icon className="size-4" /></span>
      <div className="min-w-0"><p className="text-sm font-bold">{i + 1}. {s.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{s.body}</p></div>
    </li>)}</ol>
    <Button size="sm" className="mt-3" onClick={close}>فهمت، لنبدأ</Button>
  </aside>;
}
