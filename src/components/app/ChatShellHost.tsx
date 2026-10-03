/**
 * غلاف ثابت لكل شاشات المحادثة — الشريط الجانبي والشريط العلوي لا يُعاد بناؤهما
 * عند التنقل بين الموظفين؛ يتغيّر عمود المحادثة الأوسط وحده (تجربة واتساب).
 * الصفحات الداخلية تنشر عنوانها وأزرارها هنا عبر ChatShellMeta و ChatShellActions.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { team } from "@/data/team";
import { useWorkspace } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

type ShellMeta = {
  title: string;
  lead?: string;
  padded?: boolean;
  compactTitle?: boolean;
  hideTitle?: boolean;
};

const ShellContext = createContext<{
  setMeta: (meta: ShellMeta) => void;
  slot: HTMLElement | null;
} | null>(null);

export function ChatShellHost({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<ShellMeta>({ title: "المحادثات" });
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();

  /** تحميل مسبق لمحادثات كل الموظفين وآخر رسائلها: التبديل بينهم فوري مثل واتساب. */
  useEffect(() => {
    const ws = workspace?.id;
    if (!ws) return;
    void (async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("*")
        .eq("workspace_id", ws)
        .order("updated_at", { ascending: false });
      for (const m of team) {
        const mine = (convs ?? []).filter((c) => c.employee_id === m.id);
        const first = mine[0];
        if (!first) continue;
        void qc.prefetchQuery({
          queryKey: ["messages", ws, m.id, first.id],
          staleTime: 30_000,
          queryFn: async () => {
            const { data } = await supabase
              .from("messages")
              .select("*")
              .eq("workspace_id", ws)
              .eq("employee_id", m.id)
              .eq("conversation_id", first.id)
              .order("created_at", { ascending: true });
            return data ?? [];
          },
        });
      }
    })();
  }, [workspace?.id, qc]);

  return (
    <ShellContext.Provider value={{ setMeta, slot }}>
      <AppShell
        title={meta.title}
        {...(meta.lead ? { lead: meta.lead } : {})}
        padded={meta.padded ?? true}
        compactTitle={meta.compactTitle ?? false}
        hideTitle={meta.hideTitle ?? false}
        actions={<span ref={setSlot} className="contents" />}
      >
        {children}
      </AppShell>
    </ShellContext.Provider>
  );
}

/** تنشر الصفحة عنوانها ووصفها في الشريط العلوي الثابت. */
export function ChatShellMeta({ title, lead, padded, compactTitle, hideTitle }: ShellMeta) {
  const ctx = useContext(ShellContext);
  const setMeta = ctx?.setMeta;
  useEffect(() => {
    setMeta?.({
      title,
      ...(lead ? { lead } : {}),
      ...(padded === undefined ? {} : { padded }),
      ...(compactTitle === undefined ? {} : { compactTitle }),
      ...(hideTitle === undefined ? {} : { hideTitle }),
    });
  }, [setMeta, title, lead, padded, compactTitle, hideTitle]);
  return null;
}

/** تعرض أزرار الصفحة داخل الشريط العلوي الثابت بلا إعادة بنائه. */
export function ChatShellActions({ children }: { children: ReactNode }) {
  const ctx = useContext(ShellContext);
  if (!ctx?.slot) return null;
  return createPortal(children, ctx.slot);
}
