import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Download, FileArchive, FileText, ImagePlus, Palette, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/design-editor")({
  head: () => ({
    meta: [
      { title: "محرر تصميم دانة | سهل" },
      { name: "description", content: "صمّم كاروسيل كامل بنص عربي صحيح وقالب علامتك، وحمّله PNG أو ZIP أو PDF." },
      { property: "og:title", content: "محرر تصميم دانة | سهل" },
      { property: "og:description", content: "صمّم كاروسيل كامل بنص عربي صحيح وقالب علامتك، وحمّله PNG أو ZIP أو PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignEditor,
});

const SIZES = {
  "مربع 1080×1080": [1080, 1080],
  "عمودي 1080×1350": [1080, 1350],
  "ستوري 1080×1920": [1080, 1920],
  "أفقي 1200×630": [1200, 630],
} as const;
type SizeKey = keyof typeof SIZES;
const FONTS = ["Cairo", "Tajawal", "Almarai"];
const TEMPLATE_KEY = "sahl-brand-template";

type Slide = { id: string; img: HTMLImageElement | null; title: string; sub: string; cta: string };
type Corner = "none" | "tr" | "tl" | "br" | "bl";
type Style = {
  size: SizeKey;
  font: string;
  textColor: string;
  accent: string;
  bg: string;
  overlay: number;
  pos: "top" | "center" | "bottom";
  titleSize: number;
  logoUrl: string;
  logoCorner: Corner;
  showNumbers: boolean;
};

const DEFAULT_STYLE: Style = {
  size: "مربع 1080×1080",
  font: "Cairo",
  textColor: "#ffffff",
  accent: "#0f766e",
  bg: "#1f2937",
  overlay: 45,
  pos: "bottom",
  titleSize: 96,
  logoUrl: "",
  logoCorner: "tl",
  showNumbers: true,
};

const newSlide = (p: Partial<Slide> = {}): Slide => ({
  id: Math.random().toString(36).slice(2),
  img: null,
  title: "عنوانك هنا",
  sub: "سطر داعم قصير",
  cta: "",
  ...p,
});

function drawSlide(c: HTMLCanvasElement, s: Slide, st: Style, logo: HTMLImageElement | null, index: number, total: number) {
  const [w, h] = SIZES[st.size];
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, w, h);
  if (s.img) {
    const k = Math.max(w / s.img.width, h / s.img.height);
    ctx.drawImage(s.img, (w - s.img.width * k) / 2, (h - s.img.height * k) / 2, s.img.width * k, s.img.height * k);
    ctx.fillStyle = `rgba(0,0,0,${st.overlay / 100})`;
    ctx.fillRect(0, 0, w, h);
  }
  const story = st.size.startsWith("ستوري");
  const safeTop = story ? 250 : 64;
  const safeBottom = story ? 350 : 64;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const x = w - 64;
  const maxW = w - 128;
  const wrap = (t: string, px: number, weight = 800) => {
    ctx.font = `${weight} ${px}px ${st.font}`;
    const lines: string[] = [];
    let line = "";
    for (const word of t.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const tLines = s.title ? wrap(s.title, st.titleSize) : [];
  const subPx = Math.round(st.titleSize * 0.45);
  const sLines = s.sub ? wrap(s.sub, subPx, 400) : [];
  const ctaPx = Math.max(40, Math.round(st.titleSize * 0.42));
  const block = tLines.length * st.titleSize * 1.5 + sLines.length * subPx * 1.7 + (s.cta ? ctaPx * 2.4 : 0);
  let y = st.pos === "top" ? safeTop + (logo ? 120 : 0) : st.pos === "center" ? (h - block) / 2 : h - safeBottom - block;
  ctx.fillStyle = st.textColor;
  ctx.textBaseline = "top";
  ctx.font = `800 ${st.titleSize}px ${st.font}`;
  for (const l of tLines) {
    ctx.fillText(l, x, y);
    y += st.titleSize * 1.5;
  }
  ctx.font = `400 ${subPx}px ${st.font}`;
  for (const l of sLines) {
    ctx.fillText(l, x, y);
    y += subPx * 1.7;
  }
  if (s.cta) {
    ctx.font = `800 ${ctaPx}px ${st.font}`;
    const bw = ctx.measureText(s.cta).width + ctaPx * 1.6;
    const bh = ctaPx * 1.8;
    ctx.fillStyle = st.accent;
    ctx.beginPath();
    ctx.roundRect(x - bw, y + ctaPx * 0.3, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(s.cta, x - ctaPx * 0.8, y + ctaPx * 0.3 + (bh - ctaPx) / 2 - ctaPx * 0.1);
  }
  if (logo && st.logoCorner !== "none") {
    const lw = Math.round(w * 0.14);
    const lh = (logo.height / logo.width) * lw;
    const m = 48;
    const lx = st.logoCorner.endsWith("l") ? m : w - m - lw;
    const ly = st.logoCorner.startsWith("t") ? (story ? 180 : m) : h - (story ? 260 : m) - lh;
    ctx.drawImage(logo, lx, ly, lw, lh);
  }
  if (st.showNumbers && total > 1) {
    const px = 30;
    ctx.font = `800 ${px}px ${st.font}`;
    ctx.textAlign = "left";
    ctx.fillStyle = st.textColor;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`${index + 1}/${total}`, 48, h - (story ? 300 : 48) - px);
    ctx.globalAlpha = 1;
    ctx.textAlign = "right";
  }
}

function loadImage(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    if (cors) i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("تعذّر تحميل الصورة"));
    i.src = src;
  });
}

function DesignEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [slides, setSlides] = useState<Slide[]>([newSlide({ cta: "اطلب الآن" })]);
  const [active, setActive] = useState(0);
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const slide = slides[active] ?? slides[0]!;
  const set = <K extends keyof Style>(k: K, v: Style[K]) => setStyle((s) => ({ ...s, [k]: v }));
  const patch = (p: Partial<Slide>) => setSlides((all) => all.map((s, i) => (i === active ? { ...s, ...p } : s)));

  useEffect(() => {
    const id = "design-editor-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;800&family=Tajawal:wght@400;800&family=Almarai:wght@400;800&display=swap";
    document.head.appendChild(l);
  }, []);

  // قالب العلامة المحفوظ يُطبق تلقائياً عند الفتح.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? "null") as Partial<Style> | null;
      if (saved) setStyle((s) => ({ ...s, ...saved }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!style.logoUrl) return setLogo(null);
    loadImage(style.logoUrl, !style.logoUrl.startsWith("data:")).then(setLogo).catch(() => setLogo(null));
  }, [style.logoUrl]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const draw = () => drawSlide(c, slide, style, logo, active, slides.length);
    draw();
    void document.fonts?.load(`800 40px ${style.font}`).then(draw);
  }, [slide, style, logo, active, slides.length]);

  /** فتح تصميم دانة مباشرة من المحادثة عبر ?img= بدون رفع يدوي. */
  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("img");
    if (!url || !/^https?:\/\//.test(url)) return;
    loadImage(url, true).then((i) => setSlides((all) => all.map((s, idx) => (idx === 0 ? { ...s, img: i } : s)))).catch(() => null);
  }, []);

  const onFile = (f?: File) => {
    if (!f) return;
    loadImage(URL.createObjectURL(f)).then((i) => patch({ img: i }));
  };
  const onLogo = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => set("logoUrl", String(r.result));
    r.readAsDataURL(f);
  };

  const renderAll = async (): Promise<HTMLCanvasElement[]> => {
    await document.fonts?.load(`800 40px ${style.font}`);
    return slides.map((s, i) => {
      const c = document.createElement("canvas");
      drawSlide(c, s, style, logo, i, slides.length);
      return c;
    });
  };
  const save = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error && /tainted|insecure/i.test(e.message) ? "إحدى الصور لا تسمح بالتصدير — ارفعها من جهازك." : "تعذّر التصدير الآن.");
    } finally {
      setBusy(false);
    }
  };

  const downloadPng = () =>
    guard(async () => {
      const c = document.createElement("canvas");
      drawSlide(c, slide, style, logo, active, slides.length);
      const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (b) save(b, `sahl-slide-${active + 1}.png`);
    });
  const downloadZip = () =>
    guard(async () => {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const canvases = await renderAll();
      await Promise.all(
        canvases.map(async (c, i) => {
          const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
          if (b) zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, b);
        }),
      );
      save(await zip.generateAsync({ type: "blob" }), "sahl-carousel.zip");
    });
  const downloadPdf = () =>
    guard(async () => {
      const { jsPDF } = await import("jspdf");
      const [w, h] = SIZES[style.size];
      const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "px", format: [w, h], hotfixes: ["px_scaling"] });
      const canvases = await renderAll();
      canvases.forEach((c, i) => {
        if (i) pdf.addPage([w, h], w > h ? "landscape" : "portrait");
        pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
      });
      save(pdf.output("blob"), "sahl-carousel.pdf");
    });

  const saveTemplate = () => {
    const { size, font, textColor, accent, bg, overlay, pos, titleSize, logoUrl, logoCorner, showNumbers } = style;
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ size, font, textColor, accent, bg, overlay, pos, titleSize, logoUrl, logoCorner, showNumbers }));
      toast.success("حُفظ قالب علامتك — يُطبق تلقائياً على كل تصميم جديد");
    } catch {
      toast.error("الشعار كبير جداً للحفظ؛ استخدم صورة أصغر.");
    }
  };

  const field = "w-full rounded-xl border border-border bg-background p-2 text-sm";
  const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60";
  return (
    <AppShell title="محرر تصميم دانة">
      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[340px_1fr]" dir="rtl">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Palette className="size-5 text-primary" /> الشريحة {active + 1} من {slides.length}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border p-3 hover:bg-secondary">
            <ImagePlus className="size-4" /> {slide.img ? "غيّر صورة الشريحة" : "ارفع صورة (اختياري)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <input className={field} value={slide.title} onChange={(e) => patch({ title: e.target.value })} placeholder="العنوان" />
          <input className={field} value={slide.sub} onChange={(e) => patch({ sub: e.target.value })} placeholder="النص الداعم" />
          <input className={field} value={slide.cta} onChange={(e) => patch({ cta: e.target.value })} placeholder="زر الدعوة (اختياري)" />

          <details className="rounded-xl border border-border p-3" open>
            <summary className="cursor-pointer font-semibold">قالب العلامة (لكل الشرائح)</summary>
            <div className="mt-3 space-y-3">
              <select className={field} value={style.size} onChange={(e) => set("size", e.target.value as SizeKey)}>
                {Object.keys(SIZES).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select className={field} value={style.font} onChange={(e) => set("font", e.target.value)}>
                  {FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <select className={field} value={style.pos} onChange={(e) => set("pos", e.target.value as Style["pos"])}>
                  <option value="top">أعلى</option>
                  <option value="center">وسط</option>
                  <option value="bottom">أسفل</option>
                </select>
              </div>
              <label className="block">
                حجم العنوان: {style.titleSize}
                <input type="range" min={48} max={160} value={style.titleSize} onChange={(e) => set("titleSize", +e.target.value)} className="w-full" />
              </label>
              <label className="block">
                تعتيم الصورة: {style.overlay}٪
                <input type="range" min={0} max={80} value={style.overlay} onChange={(e) => set("overlay", +e.target.value)} className="w-full" />
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label>النص<input type="color" value={style.textColor} onChange={(e) => set("textColor", e.target.value)} className="h-9 w-full" /></label>
                <label>الزر<input type="color" value={style.accent} onChange={(e) => set("accent", e.target.value)} className="h-9 w-full" /></label>
                <label>الخلفية<input type="color" value={style.bg} onChange={(e) => set("bg", e.target.value)} className="h-9 w-full" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-dashed border-border p-2 text-xs hover:bg-secondary">
                  {logo ? "غيّر الشعار" : "ارفع الشعار"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                </label>
                <select className={field} value={style.logoCorner} onChange={(e) => set("logoCorner", e.target.value as Corner)}>
                  <option value="tr">أعلى يمين</option>
                  <option value="tl">أعلى يسار</option>
                  <option value="br">أسفل يمين</option>
                  <option value="bl">أسفل يسار</option>
                  <option value="none">بدون شعار</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={style.showNumbers} onChange={(e) => set("showNumbers", e.target.checked)} /> ترقيم الشرائح (1/5)
              </label>
              <button onClick={saveTemplate} className={cn(btn, "w-full border border-border hover:bg-secondary")}>
                <Save className="size-4" /> احفظ كقالب علامتي
              </button>
            </div>
          </details>

          <div className="grid grid-cols-3 gap-2">
            <button disabled={busy} onClick={downloadPng} className={cn(btn, "border border-border hover:bg-secondary")}>
              <Download className="size-4" /> PNG
            </button>
            <button disabled={busy} onClick={downloadZip} className={cn(btn, "bg-primary text-primary-foreground")}>
              <FileArchive className="size-4" /> ZIP
            </button>
            <button disabled={busy} onClick={downloadPdf} className={cn(btn, "bg-primary text-primary-foreground")}>
              <FileText className="size-4" /> PDF
            </button>
          </div>
        </section>

        <div className="space-y-3">
          <div className="flex items-start justify-center rounded-2xl border border-border bg-secondary/40 p-4">
            <canvas ref={canvasRef} className="h-auto max-h-[70vh] w-auto max-w-full rounded-lg shadow" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={cn(
                  "flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-xl border p-1 text-[11px]",
                  i === active ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
              >
                <b>{i + 1}</b>
                <span className="w-full truncate">{s.title}</span>
              </button>
            ))}
            {slides.length < 10 && (
              <button
                onClick={() => {
                  setSlides((all) => [...all, newSlide({ title: `شريحة ${all.length + 1}` })]);
                  setActive(slides.length);
                }}
                className="flex h-16 w-24 shrink-0 items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs"
              >
                <Plus className="size-4" /> شريحة
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (slides.length >= 10) return;
                setSlides((all) => [...all.slice(0, active + 1), { ...slide, id: newSlide().id }, ...all.slice(active + 1)]);
                setActive(active + 1);
              }}
              className={cn(btn, "border border-border hover:bg-secondary")}
            >
              <Copy className="size-4" /> كرّر الشريحة
            </button>
            <button
              disabled={slides.length < 2}
              onClick={() => {
                setSlides((all) => all.filter((_, i) => i !== active));
                setActive(Math.max(0, active - 1));
              }}
              className={cn(btn, "border border-border hover:bg-secondary")}
            >
              <Trash2 className="size-4" /> احذف الشريحة
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
