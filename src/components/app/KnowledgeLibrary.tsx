import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, FileText, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addKnowledge, deleteKnowledge, listKnowledge } from "@/lib/knowledge.functions";

const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim()) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v.trim());

/** Reference library: employees pull only the relevant passage when a question needs it. */
export function KnowledgeLibrary({ workspaceId }: { workspaceId?: string | undefined }) {
  const qc = useQueryClient();
  const list = useServerFn(listKnowledge);
  const add = useServerFn(addKnowledge);
  const del = useServerFn(deleteKnowledge);
  const [value, setValue] = useState("");
  const key = ["knowledge", workspaceId];
  const asUrl = isUrl(value);

  const { data: items = [], isLoading } = useQuery({
    queryKey: key,
    enabled: Boolean(workspaceId),
    queryFn: () => list({ data: { workspaceId: workspaceId! } }),
  });

  const save = useMutation({
    mutationFn: () => {
      const v = value.trim();
      const input = asUrl ? { url: v.startsWith("http") ? v : `https://${v}` } : { text: v };
      return add({ data: { workspaceId: workspaceId!, ...input } });
    },
    onSuccess: (r) => {
      toast.success(`حُفظ «${r.title}» — الفريق يرجع إليه عند الحاجة`);
      setValue("");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (source: string) => del({ data: { workspaceId: workspaceId!, source } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = asUrl || value.trim().length >= 20;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
          <BookOpen className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-black sm:text-lg">مستندات مرجعية</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            أسعار، سياسات، كتيّب منتجات… يرجع إليها الموظف فقط عندما يحتاجها السؤال.
          </p>
        </div>
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) save.mutate();
        }}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="الصق رابط صفحة، أو نص المستند (أول سطر يصبح العنوان)"
          className="min-h-20 w-full resize-y rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {value.trim() ? (asUrl ? "سنقرأ هذه الصفحة" : `${value.trim().length} حرف`) : ""}
          </span>
          <button
            type="submit"
            disabled={!canSave || save.isPending || !workspaceId}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background disabled:opacity-40"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {asUrl ? "أضف الرابط" : "احفظ المستند"}
          </button>
        </div>
      </form>

      <ul className="mt-3 divide-y divide-border">
        {isLoading ? <li className="py-3 text-sm text-muted-foreground">جارٍ التحميل…</li> : null}
        {!isLoading && !items.length ? (
          <li className="py-3 text-sm text-muted-foreground">لا توجد مستندات بعد.</li>
        ) : null}
        {items.map((it) => {
          const text = it.source.startsWith("text:");
          const Icon = text ? FileText : Link2;
          return (
            <li key={it.source} className="flex items-center gap-3 py-3">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{it.title}</p>
                <p className="truncate text-xs text-muted-foreground" dir={text ? undefined : "ltr"}>
                  {text ? `نص · ${it.chunks} مقطع` : it.source}
                </p>
              </div>
              <button
                type="button"
                aria-label="حذف"
                disabled={remove.isPending}
                onClick={() => remove.mutate(it.source)}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
