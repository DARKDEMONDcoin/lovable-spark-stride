/** Bounded public-site evidence for the introduction. No model calls or account writes. */
import { parseHTML } from "linkedom";

export type WelcomePreview = {
  url: string;
  name: string;
  summary: string;
  industry: string;
  products: string[];
  headings: string[];
  socials: string[];
  contacts: string[];
  locations: string[];
  platform: string;
  language: string;
  pagesRead: string[];
  offers: string[];
  actions: string[];
  policies: string[];
  signals: string[];
  tone: string;
  /** Brand assets for the visitor's DNA card (absolute https URLs / verified CSS colors). */
  logo: string;
  image: string;
  colors: string[];
  /** How the homepage was obtained: plain fetch, open-source renderer, cloud Chrome, or search index. */
  via: "direct" | "rendered" | "browser" | "search";
  /** AI understanding grounded only in the pages above; null when unavailable. */
  profile: WelcomeProfile | null;
};

export type WelcomeProfile = {
  oneLiner: string;
  industry: string;
  offerings: string[];
  audience: string;
  valueProps: string[];
  tone: string;
  market: string;
  opportunities: { employee: string; text: string }[];
};

const socialHosts = ["instagram.com", "facebook.com", "tiktok.com", "linkedin.com", "youtube.com", "x.com", "twitter.com", "snapchat.com", "pinterest.com", "wa.me", "t.me"];
const publicHost = (host: string) => {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h.includes(".") && h.length <= 253 && !h.includes("..") && /^[a-z0-9.-]+$/.test(h) && !/^(?:\d+\.)+\d+$/.test(h) && !/^(?:0x[0-9a-f]+|\d+)$/i.test(h) && !["localhost", "local", "internal", "test", "invalid", "example", "onion", "arpa", "lan", "home", "corp", "metadata", "cloud", "localdomain"].some((suffix) => h === suffix || h.endsWith(`.${suffix}`)) && h !== "metadata.google.internal";
};
export function publicWebsiteUrl(raw: string): URL | null {
  try {
    const input = raw.trim();
    if (!input || input.length > 300 || /[\u0000-\u001f\u007f]/.test(input)) return null;
    const u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (u.protocol !== "https:" || u.username || u.password || u.port || !publicHost(u.hostname)) return null;
    u.hash = "";
    return u;
  } catch { return null; }
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_BYTES = 1_500_000;
const sameSite = (host: string, root: string) => { const h = host.replace(/^www\./, ""); return h === root || h.endsWith(`.${root}`) || root.endsWith(`.${h}`); };

async function streamText(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0, html = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      // Huge pages are truncated, not rejected: the head and main content come first.
      if (bytes > MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
    }
    html += decoder.decode();
  } finally { try { reader.releaseLock(); } catch { /* already released */ } }
  return html;
}

/** Direct fetch with browser headers; follows redirects to any public host (validated each hop). */
async function directPage(url: URL, root: string | null) {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current.toString(), {
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "Accept-Language": "ar,en;q=0.8", "User-Agent": BROWSER_UA },
      redirect: "manual", signal: AbortSignal.timeout(8000),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new Error("تعذر قراءة الموقع.");
      const next = publicWebsiteUrl(new URL(location, current).toString().replace(/^http:/i, "https:"));
      if (!next || (root && !sameSite(next.hostname, root))) throw new Error("إعادة توجيه غير آمنة.");
      current = next;
      continue;
    }
    const type = (res.headers.get("content-type") ?? "text/html").toLowerCase();
    if (!res.ok || !/html|xml/.test(type)) throw new Error("لم نتمكن من قراءة صفحات هذا الموقع.");
    return { html: await streamText(res), url: current.toString() };
  }
  throw new Error("تعذر الوصول للموقع بعد إعادة التوجيه.");
}

/**
 * Open-source Jina Reader (github.com/jina-ai/reader) renders JavaScript in a real
 * headless browser and returns the final HTML — rescues SPAs (React/Wix/Salla) and
 * sites that block plain bots.
 */
async function renderedPage(url: URL) {
  const res = await fetch(`https://r.jina.ai/${url.toString()}`, {
    headers: { "X-Return-Format": "html", "X-Timeout": "12", Accept: "text/html" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("لم نتمكن من قراءة صفحات هذا الموقع.");
  const html = await streamText(res);
  if (html.length < 300) throw new Error("لم نتمكن من قراءة صفحات هذا الموقع.");
  return { html, url: url.toString() };
}

const visibleTextLength = (html: string) => html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;

/** Last resort: a real cloud Chrome session (Browserbase) that runs scripts and passes most bot checks. */
async function browserPage(url: URL) {
  const { browsePage } = await import("./cloud-browser.server");
  const page = await browsePage(url.toString(), { html: true });
  if (!page?.html) throw new Error("لم نتمكن من قراءة صفحات هذا الموقع.");
  const final = publicWebsiteUrl(page.url) ?? url;
  return { html: page.html, url: final.toString(), via: "browser" as const };
}

async function readPage(url: URL, root: string | null, deep = false): Promise<{ html: string; url: string; via: "direct" | "rendered" | "browser" }> {
  const direct = await directPage(url, root).then((p) => ({ ...p, via: "direct" as const })).catch(() => null);
  // Thin shell (client-rendered app) or blocked → render it.
  const blocked = (h: string) => /<title>\s*(Just a moment|Attention Required|Access denied|Please wait|Verifying)/i.test(h) || /cf-browser-verification|challenge-platform|captcha/i.test(h.slice(0, 20000)) && visibleTextLength(h) < 1500;
  if (direct && !blocked(direct.html) && visibleTextLength(direct.html) >= 400) return direct;
  const target = direct ? new URL(direct.url) : url;
  const rendered = await renderedPage(target).then((p) => ({ ...p, via: "rendered" as const })).catch(() => null);
  if (rendered && !blocked(rendered.html) && (!direct || blocked(direct.html) || visibleTextLength(rendered.html) > visibleTextLength(direct.html))) return rendered;
  if (direct && !blocked(direct.html) && visibleTextLength(direct.html) >= 150) return direct;
  if (deep) {
    const browsed = await browserPage(target).catch(() => null);
    if (browsed && !blocked(browsed.html) && visibleTextLength(browsed.html) >= 150) return browsed;
  }
  if (direct && !blocked(direct.html)) return direct;
  throw new Error("هذا الموقع يمنع القراءة الآلية حاليًا؛ يمكنك المتابعة وسنحلله بعمق بعد التسجيل.");
}

/** sitemap.xml gives the real page list even when navigation is JS-only. */
async function sitemapLinks(origin: string, root: string): Promise<URL[]> {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    let xml = (await streamText(res)).slice(0, 400_000);
    const child = /<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(xml)?.[1];
    if (child && !/<url>/i.test(xml)) {
      const u = publicWebsiteUrl(child);
      if (u && sameSite(u.hostname, root)) {
        const r2 = await fetch(u.toString(), { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(5000) });
        if (r2.ok) xml = (await streamText(r2)).slice(0, 400_000);
      }
    }
    const out: URL[] = [];
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      const u = publicWebsiteUrl(m[1]!.replace(/&amp;/g, "&"));
      if (u && sameSite(u.hostname, root)) out.push(u);
      if (out.length > 300) break;
    }
    return out;
  } catch { return []; }
}

const clean = (value: string | null | undefined, max = 180) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const unique = (values: string[], max: number) => [...new Set(values.filter(Boolean))].slice(0, max);
const types = (value: unknown) => Array.isArray(value) ? value.join(" ") : String(value ?? "");

export async function previewWebsite(raw: string): Promise<WelcomePreview> {
  return (await readSite(raw)).preview;
}

const absHttps = (value: string | null | undefined, base: string) => {
  try { if (!value?.trim()) return ""; const u = new URL(value.trim(), base); return u.protocol === "https:" ? u.toString().slice(0, 400) : ""; } catch { return ""; }
};
/** Only accept literal CSS colors from the site's own declarations, never guessed palette colors. */
function siteColor(value: string): string {
  const v = value.trim().toLowerCase();
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)) return v;
  const match = /^(oklch|hsl|rgb)\(([^()]+)\)$/.exec(v);
  if (!match || !/^[\d.%\s,/-]+$/.test(match[2] ?? "")) return "";
  const nums = (match[2] ?? "").match(/[\d.]+%?/g) ?? [];
  return nums.length >= 3 ? v : "";
}

function declaredBrandColors(css: string): string[] {
  const found: { name: string; value: string; score: number; order: number }[] = [];
  let order = 0;
  // Restrict candidates to semantic brand tokens and actual styled elements.
  // Framework-wide color scales and generic color/fill properties are not a brand palette.
  for (const m of css.matchAll(/(--[\w-]+|(?:background-color|color))\s*:\s*(#[0-9a-f]{3,8}\b|(?:oklch|hsl|rgb)\([^();{}]+\))/gi)) {
    const name = m[1]!.toLowerCase();
    const value = siteColor(m[2]!);
    if (!value || /(?:hover|pressed|disabled|translucent|shadow|glow|gradient|border|ring|foreground|text|gray|grey|neutral|white|black|error|warning|success|destructive|notification|sapphire|twilight|bubblegum|flamingo|tiger|saffron)/.test(name)) continue;
    const score = /--(?:bg-accent|brand(?:-color)?|color-brand|brand-primary|primary|accent|color-primary|color-accent)$/.test(name) ? 90
      : /--(?:fg-accent|marketing-accent-primary|marketing-brand-ocean-primary)$/.test(name) ? 80
      : /--[\w-]*(?:brand|accent|primary)[\w-]*$/.test(name) && !/--(?:bg-primary|fg-primary|color-(?:red|blue|orange|green|yellow|pink|purple|teal|cyan|lime)-\d+)$/.test(name) ? 40
      : 0;
    if (score) found.push({ name, value, score, order: order++ });
  }
  const byName = new Map<string, (typeof found)[number]>();
  for (const item of found) if (!byName.has(item.name)) byName.set(item.name, item);
  return unique([...byName.values()].sort((a, b) => b.score - a.score || a.order - b.order).map((item) => item.value), 3);
}

async function siteStylesheet(href: string, pageUrl: string, root: string): Promise<string> {
  const target = publicWebsiteUrl(new URL(href, pageUrl).toString());
  if (!target || !sameSite(target.hostname, root)) return "";
  try {
    let current = target;
    for (let hop = 0; hop < 3; hop++) {
      const res = await fetch(current.toString(), { redirect: "manual", headers: { Accept: "text/css", "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(5000) });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        const next = location && publicWebsiteUrl(new URL(location, current).toString());
        if (!next || !sameSite(next.hostname, root)) return "";
        current = next;
        continue;
      }
      if (!res.ok || !/css/.test(res.headers.get("content-type") ?? "text/css")) return "";
      return (await streamText(res)).slice(0, MAX_BYTES);
    }
  } catch { /* An unreadable stylesheet is not evidence of a color. */ }
  return "";
}

/** Reads the site and also returns the visible-text corpus used for AI understanding (server-only). */
export async function readSite(raw: string): Promise<{ preview: WelcomePreview; corpus: string }> {
  const url = publicWebsiteUrl(raw);
  if (!url) throw new Error("أدخل رابط موقع عام صالح، مثل example.com");
  const first = await readPage(url, null, true).catch(async (error: unknown) => {
    const found = await searchFallback(url).catch(() => null);
    if (found) return found;
    throw error;
  });
  if ("preview" in first) return first;
  const root = new URL(first.url).hostname.replace(/^www\./, "");
  const { document } = parseHTML(first.html);
  const meta = (selector: string) => clean(document.querySelector(selector)?.getAttribute("content"));
  const name = meta('meta[property="og:site_name"]') || clean(document.querySelector("title")?.textContent?.split(/[|–—]/)[0], 90) || url.hostname;
  const summary = meta('meta[name="description"]') || meta('meta[property="og:description"]');
  const industry = meta('meta[property="product:category"]') || "";
  const headings: string[] = [];
  const products: string[] = [];
  const socials: string[] = [];
  const contacts: string[] = [];
  const locations: string[] = [];
  const offers: string[] = [];
  const actions: string[] = [];
  const policies: string[] = [];
  const signals: string[] = [];
  const samples: string[] = [];
  const corpus: string[] = [];
  const links: { url: URL; score: number }[] = [];
  const visited = new Set<string>();

  function collect(html: string, pageUrl: string) {
    const doc = parseHTML(html).document;
    const anchors = Array.from(doc.querySelectorAll("a[href]"));
    doc.querySelectorAll("script,style,nav,footer,header,noscript").forEach((el) => el.remove());
    const content = doc.querySelector("main") ?? doc.querySelector("article") ?? doc.body;
    const text = clean(content?.textContent, 1500);
    if (text) samples.push(text);
    const pageTitle = clean(doc.querySelector("title")?.textContent, 120);
    const pageText = clean(content?.textContent, 3500);
    if (pageText) corpus.push(`[${new URL(pageUrl).pathname || "/"}] ${pageTitle}\n${pageText}`);
    const fullText = clean(content?.textContent, 20_000);
    for (const m of fullText.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g)) if (!/\.(png|jpe?g|webp|svg)$/i.test(m[0])) contacts.push(m[0].slice(0, 70));
    for (const m of fullText.matchAll(/(?:\+|00)\d[\d\s-]{8,15}\d/g)) contacts.push(m[0].replace(/\s+/g, " "));
    for (const m of fullText.matchAll(/(\d{1,3}(?:[,٬]\d{3})*(?:[.,]\d{1,2})?)\s*(ج\.?م|جنيه|ريال|ر\.س|درهم|د\.إ|دينار|دولار|EGP|SAR|AED|KWD|QAR|USD|\$)/gi)) offers.push(clean(m[0], 40));
    headings.push(...Array.from(content?.querySelectorAll("h1,h2,h3") ?? []).map((el) => clean(el.textContent, 90)));
    for (const el of Array.from(content?.querySelectorAll("a,button") ?? [])) {
      const label = clean(el.textContent, 65);
      if (label.length >= 3 && label.length <= 55 && /^(احجز|اشتر|اطلب|تواصل|ابدأ|اشترك|جرّب|احصل|تسوق|تسوّق|book|buy|shop|contact|subscribe|get started|start|request|try)/i.test(label)) actions.push(label);
    }
    for (const a of anchors) {
      const href = a.getAttribute("href") ?? "";
      if (/^(mailto:|tel:)/i.test(href)) { contacts.push(clean(href.replace(/^(mailto:|tel:)/i, "").split("?")[0], 70)); continue; }
      try {
        const target = new URL(href, pageUrl);
        if (socialHosts.some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))) {
          socials.push(clean(`${target.hostname.replace(/^www\./, "")}${target.pathname.replace(/\/$/, "")}`, 90));
        }
        if (target.protocol !== "https:" || !sameSite(target.hostname, root)) continue;
        target.search = ""; target.hash = "";
        const path = decodeURIComponent(target.pathname);
        if (/\.(pdf|png|jpe?g|webp|zip|svg|mp4|xml|json)$/i.test(path) || /\/(?:cart|checkout|login|signin|account|admin|wp-admin|api)(?:\/|$)/i.test(path)) continue;
        if (/privacy|خصوصية|terms|شروط|return|استرجاع|shipping|شحن/i.test(`${path} ${a.textContent}`)) policies.push(clean(a.textContent, 55) || clean(path, 55));
        if (target.toString() === pageUrl || visited.has(target.toString())) continue;
        const label = `${path} ${a.textContent}`;
        const score = /about|عنّا|من نحن|service|خدم|product|منتج|catalog|متجر|shop/i.test(label) ? 4 : /pricing|سعر|أسعار|price|contact|تواصل|faq|أسئلة/i.test(label) ? 3 : /blog|مدون/i.test(label) ? 1 : 0;
        if (score) links.push({ url: target, score });
      } catch { /* malformed link */ }
    }
    for (const script of Array.from(parseHTML(html).document.querySelectorAll('script[type="application/ld+json"]')).slice(0, 8)) {
      try {
        const parsed: unknown = JSON.parse(script.textContent ?? "");
        const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
        let processed = 0;
        while (queue.length && processed++ < 35) {
          const item = queue.shift();
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const entry = item as Record<string, unknown>;
          if (Array.isArray(entry["@graph"])) queue.push(...entry["@graph"].slice(0, 20));
          if (Array.isArray(entry["itemListElement"])) queue.push(...entry["itemListElement"].slice(0, 20));
          if (entry["offers"] && typeof entry["offers"] === "object") queue.push(...(Array.isArray(entry["offers"]) ? entry["offers"].slice(0, 10) : [entry["offers"]]));
          if (/Product|Service|Offer/i.test(types(entry["@type"])) && typeof entry["name"] === "string") products.push(clean(entry["name"], 80));
          if (typeof entry["price"] === "string" || typeof entry["price"] === "number") {
            const currency = typeof entry["priceCurrency"] === "string" ? entry["priceCurrency"] : "";
            if (/^\d{1,8}(?:[.,]\d{1,2})?$/.test(String(entry["price"]))) offers.push(clean(`${entry["price"]} ${currency}`, 40));
          }
          const address = entry["address"];
          if (address && typeof address === "object" && !Array.isArray(address)) {
            const a = address as Record<string, unknown>;
            locations.push(clean([a["addressLocality"], a["addressRegion"], a["addressCountry"]].filter((v) => typeof v === "string").join("، "), 100));
          }
          if (typeof entry["telephone"] === "string") contacts.push(clean(entry["telephone"], 70));
          if (Array.isArray(entry["sameAs"])) for (const s of entry["sameAs"].slice(0, 12)) {
            if (typeof s !== "string") continue;
            try { const target = new URL(s); if (socialHosts.some((h) => target.hostname === h || target.hostname.endsWith(`.${h}`))) socials.push(clean(`${target.hostname}${target.pathname.replace(/\/$/, "")}`, 90)); } catch { /* malformed social */ }
          }
        }
      } catch { /* invalid structured data */ }
    }
  }

  collect(first.html, first.url);
  visited.add(first.url);
  const linkScore = (path: string) => /about|عن|من-نحن|service|خدم|product|منتج|catalog|shop|collections/i.test(path) ? 4 : /pricing|price|سعر|اسعار|أسعار|contact|تواصل|faq/i.test(path) ? 3 : 0;
  if (links.length < 3) for (const u of await sitemapLinks(new URL(first.url).origin, root)) {
    const path = decodeURIComponent(u.pathname);
    const score = linkScore(path);
    if (score && !/\/(?:cart|checkout|login|account|admin|api)(?:\/|$)/i.test(path)) links.push({ url: u, score });
  }
  const candidates = links.sort((a, b) => b.score - a.score).filter(({ url: candidate }) => {
    const key = candidate.toString();
    if (visited.has(key)) return false;
    visited.add(key);
    return true;
  }).slice(0, 4);
  const more = first.via === "browser" ? [] : await Promise.all(candidates.map(({ url: candidate }) => readPage(candidate, root).catch(() => null)));
  const pagesRead = [first.url];
  for (const page of more) if (page) { pagesRead.push(page.url); collect(page.html, page.url); }

  const html = first.html.slice(0, 150_000);
  const platform = /cdn\.shopify\.com|myshopify/i.test(html) ? "Shopify" : /woocommerce/i.test(html) ? "WooCommerce" : /wp-content|wordpress/i.test(html) ? "WordPress" : /salla\.sa|cdn\.salla/i.test(html) ? "سلة" : /zid\.store|cdn\.zid/i.test(html) ? "زد" : /webflow\.com|data-wf-page/i.test(html) ? "Webflow" : /wixstatic|wix\.com/i.test(html) ? "Wix" : /ghost\.io|ghost-url/i.test(html) ? "Ghost" : "";
  if (/googletagmanager\.com|gtag\(|google-analytics\.com/i.test(html)) signals.push("قياس Google");
  if (/connect\.facebook\.net\/.*fbevents|fbq\(['"]init/i.test(html)) signals.push("Meta Pixel");
  if (/search\.google\.com\/search-console|google-site-verification/i.test(html)) signals.push("توثيق Google");
  const tone = /[\u0600-\u06ff]/.test(samples.join(" ")) ? "العربية" : /[a-z]/i.test(samples.join(" ")) ? "الإنجليزية" : "";
  const iconLinks = Array.from(document.querySelectorAll('link[rel~="apple-touch-icon"],link[rel~="icon"],link[rel="shortcut icon"]'))
    .map((el) => ({ href: el.getAttribute("href"), size: parseInt((el.getAttribute("sizes") ?? "0").split("x")[0] ?? "0", 10) || (/apple/.test(el.getAttribute("rel") ?? "") ? 180 : 16) }))
    .sort((a, b) => b.size - a.size);
  const ldLogo = /"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/.exec(html)?.[1];
  const asLogo = (v: string | null | undefined) => { const u = absHttps(v, first.url); return u && new URL(u).pathname.length > 1 ? u : ""; };
  const logo = asLogo(ldLogo) || asLogo(iconLinks[0]?.href) || absHttps("/favicon.ico", first.url);
   const pageImages = Array.from(document.querySelectorAll("main img, article img, img")).slice(0, 80)
     .filter((el) => !el.hasAttribute(":src") && !/hidden|invisible|opacity-0/.test(el.getAttribute("class") ?? ""))
     .sort((a, b) => Number(/hero|banner/i.test(`${b.getAttribute("src")} ${b.getAttribute("class")}`)) - Number(/hero|banner/i.test(`${a.getAttribute("src")} ${a.getAttribute("class")}`)))
     .map((el) => el.getAttribute("src") || el.getAttribute("data-src"));
   const imageCandidates = [meta('meta[property="og:image:secure_url"]'), meta('meta[property="og:image"]'), meta('meta[name="twitter:image"]'), document.querySelector('link[rel="image_src"]')?.getAttribute("href"), ...pageImages];
   const image = imageCandidates.map((candidate) => absHttps(candidate, first.url)).find((candidate) => candidate && !/\.(svg|gif)(\?|$)/i.test(candidate) && !/(logo|icon|avatar|pixel|tracking|sprite)/i.test(new URL(candidate).pathname)) || "";
  const styles = Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
    .map((el) => el.getAttribute("href") ?? "").filter(Boolean).slice(0, 6);
  const cssFiles = await Promise.all(styles.map((href) => siteStylesheet(href, first.url, root)));
  const declared = [meta('meta[name="theme-color"]'), meta('meta[name="msapplication-TileColor"]')].map(siteColor).filter(Boolean);
  const colors = unique([...declaredBrandColors(`${html.slice(0, 150_000)}\n${cssFiles.join("\n")}`), ...declared], 4);
  const preview: WelcomePreview = { url: first.url, name, summary, industry, products: unique(products, 10), headings: unique(headings, 16), socials: unique(socials, 10), contacts: unique(contacts, 6), locations: unique(locations, 6), platform, language: clean(document.documentElement?.getAttribute("lang"), 20) || tone, pagesRead: unique(pagesRead, 5), offers: unique(offers, 5), actions: unique(actions, 7), policies: unique(policies, 5), signals: unique(signals, 5), tone, logo, image, colors, via: first.via, profile: null };
  return { preview, corpus: [summary && `الوصف: ${summary}`, ...corpus].filter(Boolean).join("\n\n").slice(0, 14_000) };
}

/** When every reader is blocked, describe the site from a search index (Tavily, if configured on the platform). */
async function searchFallback(url: URL): Promise<{ preview: WelcomePreview; corpus: string } | null> {
  const { tavilySearch } = await import("./tavily.server");
  const host = url.hostname.replace(/^www\./, "");
  const rows = (await tavilySearch(`site:${host}`, { max: 6, timeoutMs: 8000 })).filter((r) => { try { return sameSite(new URL(r.url).hostname, host); } catch { return false; } });
  if (!rows.length) return null;
  const name = clean(rows[0]!.title.split(/[|–—-]/)[0], 90) || host;
  const preview: WelcomePreview = { url: url.toString(), name, summary: clean(rows[0]!.snippet, 180), industry: "", products: [], headings: unique(rows.map((r) => clean(r.title, 90)), 8), socials: [], contacts: [], locations: [], platform: "", language: /[\u0600-\u06ff]/.test(rows.map((r) => r.snippet).join(" ")) ? "العربية" : "", pagesRead: unique(rows.map((r) => r.url), 5), offers: [], actions: [], policies: [], signals: [], tone: "", logo: absHttps("/favicon.ico", url.toString()), image: "", colors: [], via: "search", profile: null };
  return { preview, corpus: rows.map((r) => `[${r.url}] ${r.title}\n${r.snippet}`).join("\n\n") };
}