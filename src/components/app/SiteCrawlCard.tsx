import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runSiteCrawl } from "@/lib/site-crawl.functions";

/** فاحص نور الشامل: يزحف حتى 300 صفحة ويرتب المشاكل حسب النوع. */
export function SiteCrawlCard({ defaultUrl }: { defaultUrl?: string | null }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const fn = useServerFn(runSiteCrawl);
  const crawl = useMutation({
    mutationFn: (u: string) => fn({ data: { url: /^https?:\/\//.test(u) ? u : `https://${u}` } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const groups = useMemo(() => {
    const m = new Map<string, { url: string; detail: string }[]>();
    for (const i of crawl.data?.issues ?? []) m.set(i.kind, [...(m.get(i.kind) ?? []), i]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [crawl.data]);
  const ok = crawl.data ? crawl.data.pages.filter((p) => p.status >= 200 && p.status < 300).length : 0;

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <ScanSearch className="size-5 text-primary" />
        <h2 className="font-display text-lg font-black">فحص الموقع الشامل</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">نور تزحف على حتى 300 صفحة وتكشف الروابط المعطلة والتحويلات والعناوين والأوصاف الناقصة والصفحات البطيئة.</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) crawl.mutate(url.trim());
        }}
      >
        <Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com" />
        <Button type="submit" disabled={crawl.isPending || !url.trim()}>
          {crawl.isPending ? <><Loader2 className="size-4 animate-spin" /> يفحص… (حتى دقيقة)</> : "افحص الموقع"}
        </Button>
      </form>
      {crawl.data && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-2xl bg-secondary p-3"><b className="block text-xl">{crawl.data.pages.length}</b>صفحة فُحصت</div>
            <div className="rounded-2xl bg-secondary p-3"><b className="block text-xl">{ok}</b>سليمة</div>
            <div className="rounded-2xl bg-secondary p-3"><b className="block text-xl">{crawl.data.issues.length}</b>ملاحظة</div>
          </div>
          {crawl.data.truncated && <p className="text-xs text-muted-foreground">توقف الفحص عند الحد الزمني؛ أعد الفحص لصفحات أعمق.</p>}
          {!groups.length && <p className="text-sm font-semibold text-primary">لا مشاكل تقنية واضحة — ممتاز.</p>}
          {groups.map(([kind, list]) => (
            <details key={kind} className="rounded-2xl border border-border p-3">
              <summary className="cursor-pointer font-semibold">{kind} <span className="text-muted-foreground">({list.length})</span></summary>
              <ul className="mt-2 space-y-1 text-xs">
                {list.slice(0, 50).map((i, n) => (
                  <li key={n} className="break-all">
                    <a className="text-primary underline" href={i.url} target="_blank" rel="noreferrer" dir="ltr">{i.url}</a>
                    {i.detail && <span className="text-muted-foreground"> — {i.detail}</span>}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
