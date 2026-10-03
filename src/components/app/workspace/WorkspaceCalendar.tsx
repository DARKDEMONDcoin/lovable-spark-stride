import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type WorkItem = Tables<"collaboration_tasks">;
const DAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** تقويم شهري لمواعيد مهام المساحة. */
export function WorkspaceCalendar({ tasks, onOpen }: { tasks: WorkItem[]; onOpen: (projectId: string) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const today = iso(new Date());
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const byDay = new Map<string, WorkItem[]>();
  for (const t of tasks) if (t.due_date) byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t]);
  const undated = tasks.filter((t) => !t.due_date && t.status !== "done").length;
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return <section className="mt-7" aria-label="التقويم">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-display text-xl font-black">التقويم</h3><p className="mt-1 text-sm text-muted-foreground">مواعيد كل المهام في المساحة. اضغط مهمة لتفتح مشروعها.{undated ? ` (${undated} مهمة مفتوحة بلا موعد)` : ""}</p></div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" aria-label="الشهر السابق" onClick={() => shift(-1)}><ChevronRight className="size-4" /></Button>
        <span className="min-w-32 text-center text-sm font-black">{cursor.toLocaleDateString("ar", { month: "long", year: "numeric" })}</span>
        <Button size="icon" variant="outline" aria-label="الشهر التالي" onClick={() => shift(1)}><ChevronLeft className="size-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>اليوم</Button>
      </div>
    </div>
    <div className="mt-4 overflow-x-auto"><div className="grid min-w-[42rem] grid-cols-7 overflow-hidden rounded-md border border-border">
      {DAYS.map((d) => <div key={d} className="border-b border-border bg-secondary/50 py-2 text-center text-xs font-bold text-muted-foreground">{d}</div>)}
      {cells.map((d) => { const key = iso(d); const items = byDay.get(key) ?? []; const inMonth = d.getMonth() === cursor.getMonth();
        return <div key={key} className={cn("min-h-24 border-b border-s border-border p-1.5", !inMonth && "bg-muted/40 text-muted-foreground")}>
          <span className={cn("inline-grid size-6 place-items-center rounded-full text-xs font-bold", key === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
          <div className="mt-1 space-y-1">{items.slice(0, 3).map((t) => <button key={t.id} type="button" onClick={() => onOpen(t.project_id)} title={t.title}
            className={cn("block w-full truncate rounded px-1.5 py-0.5 text-start text-[0.7rem] font-bold", t.status === "done" ? "bg-muted text-muted-foreground line-through" : key < today ? "bg-destructive/12 text-destructive" : "bg-primary/10 text-primary")}>{t.title}</button>)}
            {items.length > 3 && <span className="block px-1 text-[0.65rem] text-muted-foreground">+{items.length - 3} أخرى</span>}</div>
        </div>; })}
    </div></div>
  </section>;
}
