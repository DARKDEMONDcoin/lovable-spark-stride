import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 300;
const BARS = 18;

type State = "idle" | "recording" | "transcribing";

/**
 * زر الإملاء الصوتي: يسجّل صوت المستخدم بموجة حيّة وعدّاد، ثم يكتب النص
 * داخل مربع الإدخال أثناء التفريغ — المستخدم يراجعه قبل الإرسال.
 */
export function VoiceInput({
  onText,
  onState,
  disabled,
}: {
  /** يُستدعى بالنص الكامل حتى الآن (يتحدّث أثناء البثّ). */
  onText: (text: string, final: boolean) => void;
  onState?: (s: State) => void;
  disabled?: boolean;
}) {
  const [state, setStateRaw] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const cancelled = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const setState = (s: State) => {
    setStateRaw(s);
    onState?.(s);
  };

  const cleanup = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (timer.current) window.clearInterval(timer.current);
    raf.current = timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => null);
    audioCtx.current = null;
  };

  useEffect(
    () => () => {
      cancelled.current = true;
      abort.current?.abort();
      if (rec.current?.state === "recording") rec.current.stop();
      cleanup();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const transcribe = async (blob: Blob) => {
    setState("transcribing");
    const ac = new AbortController();
    abort.current = ac;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("سجّل دخولك من جديد.");
      const form = new FormData();
      const type = (blob.type || "audio/webm").replace(/^video\//, "audio/");
      form.append("file", new File([blob], "voice", { type }));
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "تعذّر تحويل الصوت لنص.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let text = "";
      let finalText: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split(/\r?\n\r?\n/);
        buf = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.split(/\r?\n/).find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { type?: string; delta?: string; text?: string; error?: { message?: string } };
            if (j.type === "transcript.text.delta" && j.delta) {
              text += j.delta;
              onText(text.trim(), false);
            } else if (j.type === "transcript.text.done") {
              finalText = (j.text ?? text).trim();
            } else if (j.error) {
              throw new Error("تعذّر تحويل الصوت لنص.");
            }
          } catch (e) {
            if (e instanceof Error && e.message.startsWith("تعذّر")) throw e;
          }
        }
      }
      const out = (finalText ?? text).trim();
      if (!out) throw new Error("ماسمعتش كلام واضح — جرب تاني.");
      onText(out, true);
    } catch (e) {
      if (!cancelled.current && !(e instanceof DOMException && e.name === "AbortError")) {
        toast.error(e instanceof Error ? e.message : "تعذّر تحويل الصوت لنص.");
      }
      onText("", true);
    } finally {
      abort.current = null;
      if (!cancelled.current) setState("idle");
    }
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("المتصفح ده مش بيدعم التسجيل الصوتي.");
      return;
    }
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.current = ms;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const r = new MediaRecorder(ms, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelled.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        cleanup();
        const blob = new Blob(chunks.current, { type: (r.mimeType || "audio/webm").split(";")[0] ?? "audio/webm" });
        if (cancelled.current) {
          cancelled.current = false;
          setState("idle");
          return;
        }
        void transcribe(blob);
      };
      r.start(250);
      rec.current = r;

      // موجة حيّة من مستوى الصوت الفعلي.
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 64;
      ctx.createMediaStreamSource(ms).connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setLevels((prev) => [...prev.slice(1), Math.max(0.08, Math.min(1, avg * 2.6))]);
        raf.current = requestAnimationFrame(tick);
      };
      tick();

      setSeconds(0);
      const t0 = Date.now();
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
      setState("recording");
    } catch (e) {
      cleanup();
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      toast.error(denied ? "اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح." : "ماقدرتش أفتح الميكروفون.");
    }
  };

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
  };
  const cancel = () => {
    cancelled.current = true;
    stop();
  };

  if (state === "recording") {
    const mm = String(Math.floor(seconds / 60));
    const ss = String(seconds % 60).padStart(2, "0");
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 py-1 pe-1 ps-2 animate-pop-in" role="status" aria-label="جاري التسجيل">
        <span className="size-2 shrink-0 rounded-full bg-destructive think-dot" aria-hidden />
        <span className="flex h-6 items-center gap-[2px]" aria-hidden dir="ltr">
          {levels.map((l, i) => (
            <span key={i} className="w-[3px] rounded-full bg-primary transition-[height] duration-75" style={{ height: `${Math.round(l * 22) + 2}px` }} />
          ))}
        </span>
        <span className="min-w-9 text-center text-[0.72rem] font-semibold tabular-nums text-foreground" dir="ltr">
          {mm}:{ss}
        </span>
        <button type="button" onClick={cancel} aria-label="إلغاء التسجيل" title="إلغاء" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground">
          <X className="size-4" />
        </button>
        <button type="button" onClick={stop} aria-label="إنهاء التسجيل وتحويله لنص" title="تم" className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90">
          <Check className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={disabled || state === "transcribing"}
      aria-label={state === "transcribing" ? "جاري تحويل صوتك لنص" : "سجّل رسالة بصوتك"}
      title={state === "transcribing" ? "بكتب كلامك…" : "اتكلم بدل ما تكتب"}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60",
        state === "transcribing" && "text-primary",
      )}
    >
      {state === "transcribing" ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span className="text-[0.72rem] font-semibold">بكتب كلامك…</span>
        </>
      ) : (
        <Mic className="size-4.5" />
      )}
    </button>
  );
}
