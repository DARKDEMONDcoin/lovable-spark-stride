import { afterEach, describe, expect, test } from "bun:test";
import { previewWebsite, publicWebsiteUrl } from "../../src/lib/welcome-preview.server";

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

describe("public welcome scan", () => {
  test("rejects private, local, credentials and insecure URLs", () => {
    for (const url of ["http://example.com", "https://localhost", "https://127.0.0.1", "https://169.254.169.254", "https://metadata.google.internal", "https://example.local", "https://u:p@example.com", "https://example.com:444"]) expect(publicWebsiteUrl(url)).toBeNull();
    expect(publicWebsiteUrl("example.com")?.href).toBe("https://example.com/");
  });

  test("reads evidence from relevant internal pages, without following off-site links", async () => {
    const visited: string[] = [];
    const pages: Record<string, string> = {
      "https://example.com/": `<html lang="ar"><head><title>متجر النور | الرئيسية</title><meta name="description" content="منتجات للعناية الطبيعية"><meta property="og:image" content="/media/store.jpg"><script type="application/ld+json">{"@type":"Organization","address":{"addressLocality":"القاهرة","addressCountry":"مصر"},"sameAs":["https://instagram.com/alnoor"]}</script></head><body><nav><a href="/products">المنتجات</a><a href="/about">من نحن</a><a href="https://evil.test/">خارج الموقع</a></nav><main><h1>العناية الطبيعية</h1><a href="mailto:hello@example.com">البريد</a><a href="https://instagram.com/alnoor">انستجرام</a><a href="/products">تسوق الآن</a></main></body></html>`,
      "https://example.com/products": `<main><h1>منتجاتنا</h1><script type="application/ld+json">{"@type":"Product","name":"زيت الورد","offers":{"@type":"Offer","price":"120","priceCurrency":"EGP"}}</script><a href="/checkout">الدفع</a></main>`,
      "https://example.com/about": `<main><h1>قصتنا</h1><a href="tel:+201234567890">اتصل بنا</a></main>`,
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      const href = String(input);
      visited.push(href);
      return new Response(pages[href] ?? "", { status: pages[href] ? 200 : 404, headers: { "content-type": "text/html" } });
    }) as typeof fetch;
    const result = await previewWebsite("example.com");
    expect(result.name).toBe("متجر النور");
    expect(result.image).toBe("https://example.com/media/store.jpg");
    expect(result.products).toContain("زيت الورد");
    expect(result.actions).toContain("تسوق الآن");
    expect(result.locations).toContain("القاهرة، مصر");
    expect(result.socials).toContain("instagram.com/alnoor");
    expect(result.pagesRead).toHaveLength(3);
    expect(visited.some((url) => url.includes("evil.test"))).toBe(false);
    expect(visited.some((url) => url.includes("checkout"))).toBe(false);
  });

  test("uses actual site stylesheet colors, not framework scales or off-site styles", async () => {
    const visited: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      visited.push(url);
      if (url === "https://example.com/") return new Response(`<html><head><title>Acme</title><meta name="theme-color" content="#f8f7f4"><link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="https://elsewhere.com/tracker.css"><style>body{color:#aa4422}</style></head><body><main><h1>Acme</h1><p>Our products and services are here for the community.</p></main></body></html>`, { headers: { "content-type": "text/html" } });
      if (url === "https://example.com/site.css") return new Response(`:root{--color-blue-500:#2255ff;--bg-accent:oklch(52.43% .2396 264.41);--brand-primary:#20a076;--border-primary:#663322}.button{color:#d73271}`, { headers: { "content-type": "text/css" } });
      return new Response("", { status: 404 });
    }) as typeof fetch;
    const result = await previewWebsite("example.com");
    expect(result.colors).toEqual(["oklch(52.43% .2396 264.41)", "#20a076", "#f8f7f4"]);
    expect(visited).not.toContain("https://elsewhere.com/tracker.css");
  });

  test("does not manufacture colors when a site has no declared brand colors", async () => {
    globalThis.fetch = (async () => new Response(`<html><head><title>Plain site</title></head><body><main><h1>Plain site</h1><p>Welcome to our services</p></main></body></html>`, { headers: { "content-type": "text/html" } })) as typeof fetch;
    expect((await previewWebsite("example.com")).colors).toEqual([]);
  });
});