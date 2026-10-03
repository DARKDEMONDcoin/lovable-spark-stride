/** فاحص الموقع الشامل لنور: يزحف على صفحات النطاق نفسه ويكشف المشاكل التقنية دفعة واحدة. */
export type CrawlPage = {
  url: string;
  status: number;
  ms: number;
  bytes: number;
  title: string;
  description: string;
  h1: number;
  canonical: string;
  redirectedTo: string | null;
  noindex: boolean;
};
export type CrawlIssue = { kind: string; url: string; detail: string };

const UA = "SahlBot/1.0 (+https://stride-forge-spark.lovable.app)";
const SKIP = /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|css|js|ico|woff2?|xml)(\?|$)/i;

function pick(html: string, re: RegExp) {
  return (html.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
}

async function fetchPage(url: string): Promise<{ page: CrawlPage; links: string[] }> {
  const t = Date.now();
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "manual", signal: AbortSignal.timeout(12_000) });
  } catch {
    return { page: { url, status: 0, ms: Date.now() - t, bytes: 0, title: "", description: "", h1: 0, canonical: "", redirectedTo: null, noindex: false }, links: [] };
  }
  const loc = res.headers.get("location");
  if (res.status >= 300 && res.status < 400) {
    const to = loc ? new URL(loc, url).toString() : null;
    return { page: { url, status: res.status, ms: Date.now() - t, bytes: 0, title: "", description: "", h1: 0, canonical: "", redirectedTo: to, noindex: false }, links: to ? [to] : [] };
  }
  const type = res.headers.get("content-type") ?? "";
  const html = type.includes("html") ? (await res.text()).slice(0, 1_500_000) : "";
  const links = [...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)].map((m) => m[1]!);
  return {
    page: {
      url,
      status: res.status,
      ms: Date.now() - t,
      bytes: html.length,
      title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      description: pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || pick(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i),
      h1: (html.match(/<h1[\s>]/gi) ?? []).length,
      canonical: pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
      redirectedTo: null,
      noindex: /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html),
    },
    links,
  };
}

export async function crawlSite(startUrl: string, maxPages = 300): Promise<{ pages: CrawlPage[]; issues: CrawlIssue[]; truncated: boolean }> {
  const origin = new URL(startUrl).origin;
  const norm = (u: string, base: string) => {
    try {
      const x = new URL(u, base);
      x.hash = "";
      if (x.origin !== origin || SKIP.test(x.pathname)) return null;
      return x.toString().replace(/\/$/, "") || origin;
    } catch {
      return null;
    }
  };
  const queue: string[] = [norm(startUrl, startUrl) ?? origin];
  // صفحات من خريطة الموقع إن وجدت.
  try {
    const sm = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (sm.ok) for (const m of (await sm.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) { const n = norm(m[1]!.trim(), origin); if (n) queue.push(n); }
  } catch { /* ignore */ }

  const seen = new Set<string>();
  const pages: CrawlPage[] = [];
  const deadline = Date.now() + 45_000;
  const linkedFrom = new Map<string, string>();
  while (queue.length && pages.length < maxPages && Date.now() < deadline) {
    const batch: string[] = [];
    while (queue.length && batch.length < 8) {
      const u = queue.shift()!;
      if (!seen.has(u)) { seen.add(u); batch.push(u); }
    }
    const results = await Promise.all(batch.map(fetchPage));
    for (const r of results) {
      pages.push(r.page);
      for (const l of r.links) {
        const n = norm(l, r.page.url);
        if (n && !seen.has(n)) { queue.push(n); if (!linkedFrom.has(n)) linkedFrom.set(n, r.page.url); }
      }
    }
  }

  const issues: CrawlIssue[] = [];
  const titles = new Map<string, string[]>();
  for (const p of pages) {
    const from = linkedFrom.get(p.url);
    if (p.status === 0) issues.push({ kind: "لا تستجيب", url: p.url, detail: "انتهت المهلة أو رُفض الاتصال" });
    else if (p.status >= 400) issues.push({ kind: `خطأ ${p.status}`, url: p.url, detail: from ? `مرتبطة من ${from}` : "" });
    else if (p.redirectedTo) issues.push({ kind: `تحويل ${p.status}`, url: p.url, detail: `← ${p.redirectedTo}` });
    else {
      if (!p.title) issues.push({ kind: "بلا عنوان", url: p.url, detail: "" });
      else if (p.title.length > 65) issues.push({ kind: "عنوان طويل", url: p.url, detail: `${p.title.length} حرفاً` });
      if (!p.description) issues.push({ kind: "بلا وصف", url: p.url, detail: "" });
      if (p.h1 === 0) issues.push({ kind: "بلا H1", url: p.url, detail: "" });
      if (p.h1 > 1) issues.push({ kind: "أكثر من H1", url: p.url, detail: `${p.h1}` });
      if (!p.canonical) issues.push({ kind: "بلا canonical", url: p.url, detail: "" });
      if (p.ms > 2500) issues.push({ kind: "بطيئة", url: p.url, detail: `${(p.ms / 1000).toFixed(1)} ث` });
      if (p.bytes > 500_000) issues.push({ kind: "ثقيلة", url: p.url, detail: `${Math.round(p.bytes / 1024)} ك.ب` });
      if (p.title) titles.set(p.title, [...(titles.get(p.title) ?? []), p.url]);
    }
  }
  for (const [t, urls] of titles) if (urls.length > 1) issues.push({ kind: "عنوان مكرر", url: urls[0]!, detail: `«${t.slice(0, 50)}» في ${urls.length} صفحات` });
  return { pages, issues, truncated: queue.length > 0 };
}
