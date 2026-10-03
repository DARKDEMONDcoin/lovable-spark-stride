/**
 * معاينة المنشور بشكل المنصة الحقيقي (إنستغرام، فيسبوك، X، لينكدإن، تيك توك، ثريدز…)
 * داخل نافذة منبثقة — ليراجع المالك الإحساس والمظهر قبل النشر.
 * ألوان المنصات هنا مقصودة لمحاكاة واجهاتها الأصلية بدقة، ومحصورة داخل هذا المكوّن.
 */
import { useMemo, useState } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
  BarChart2,
  Globe,
  Plus,
  Smartphone,
  Monitor,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { cn } from "@/lib/utils";

type Kind = "instagram" | "facebook" | "x" | "linkedin" | "tiktok" | "threads" | "youtube" | "generic";

const LIMITS: Record<Kind, number> = {
  instagram: 2200,
  facebook: 63206,
  x: 280,
  linkedin: 3000,
  tiktok: 2200,
  threads: 500,
  youtube: 5000,
  generic: 5000,
};
/** طول النص الظاهر قبل «المزيد» في كل منصة. */
const FOLD: Record<Kind, number> = {
  instagram: 125,
  facebook: 240,
  x: 280,
  linkedin: 210,
  tiktok: 90,
  threads: 500,
  youtube: 160,
  generic: 400,
};

export function platformKind(provider: string): Kind {
  const p = provider.toLowerCase();
  if (p.includes("insta")) return "instagram";
  if (p.includes("face") || p === "meta" || p === "fb") return "facebook";
  if (p === "x" || p.includes("twitter")) return "x";
  if (p.includes("linkedin")) return "linkedin";
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("thread")) return "threads";
  if (p.includes("youtube")) return "youtube";
  return "generic";
}

const TABS: { kind: Kind; provider: string }[] = [
  { kind: "instagram", provider: "instagram" },
  { kind: "facebook", provider: "facebook" },
  { kind: "x", provider: "twitter" },
  { kind: "linkedin", provider: "linkedin" },
  { kind: "tiktok", provider: "tiktok" },
  { kind: "threads", provider: "threads" },
];

export type PreviewPost = {
  provider: string;
  body: string;
  image_url?: string | null;
  video_url?: string | null;
  scheduled_at?: string;
};

function Rich({ text, link }: { text: string; link: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((w, i) =>
        /^[#@][\p{L}\p{N}_]+/u.test(w) || /^https?:\/\//.test(w) ? (
          <span key={i} style={{ color: link }}>
            {w}
          </span>
        ) : (
          <span key={i}>{w}</span>
        ),
      )}
    </>
  );
}

function Caption({
  text,
  kind,
  link,
  more,
  prefix,
}: {
  text: string;
  kind: Kind;
  link: string;
  more: string;
  prefix?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const fold = FOLD[kind];
  const cut = !open && text.length > fold;
  return (
    <p className="whitespace-pre-wrap break-words" dir="auto">
      {prefix}
      <Rich text={cut ? text.slice(0, fold).trimEnd() + "… " : text} link={link} />
      {cut ? (
        <button type="button" onClick={() => setOpen(true)} style={{ color: more }} className="font-semibold">
          المزيد
        </button>
      ) : null}
    </p>
  );
}

function Media({ post, ratio }: { post: PreviewPost; ratio: string }) {
  if (post.video_url)
    return <video src={post.video_url} controls muted playsInline className={cn("w-full bg-black object-cover", ratio)} />;
  if (post.image_url) return <img src={post.image_url} alt="" className={cn("w-full object-cover", ratio)} />;
  return null;
}

function Avatar({ name, size = 36, ring }: { name: string; size?: number; ring?: string }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)",
        color: "#fff",
        fontSize: size * 0.4,
        boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : undefined,
      }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

function timeAgo(iso?: string) {
  if (!iso) return "الآن";
  return new Date(iso).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Instagram({ post, name, handle }: Mock) {
  return (
    <div style={{ background: "#fff", color: "#000" }} className="text-[13px]">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={name} size={32} ring="#dd2a7b" />
        <div className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-[13px]">{handle}</b>
          <span className="text-[11px]" style={{ color: "#737373" }}>ممول · مجدول</span>
        </div>
        <MoreHorizontal className="size-5" />
      </div>
      {post.image_url || post.video_url ? (
        <Media post={post} ratio="aspect-[4/5]" />
      ) : (
        <div className="grid aspect-square place-items-center p-8 text-center text-lg font-bold" style={{ background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)", color: "#fff" }} dir="auto">
          {post.body.slice(0, 140)}
        </div>
      )}
      <div className="flex items-center gap-4 px-3 pt-2.5">
        <Heart className="size-6" />
        <MessageCircle className="size-6 -scale-x-100" />
        <Send className="size-6" />
        <Bookmark className="ms-auto size-6" />
      </div>
      <div className="space-y-1 px-3 pb-3 pt-2">
        <b className="block">١٬٢٤٨ إعجاب</b>
        <Caption text={post.body} kind="instagram" link="#00376b" more="#737373" prefix={<b className="me-1">{handle}</b>} />
        <span className="block text-[11px]" style={{ color: "#737373" }}>عرض كل التعليقات (٣٢)</span>
        <span className="block text-[10px] uppercase" style={{ color: "#737373" }}>{timeAgo(post.scheduled_at)}</span>
      </div>
    </div>
  );
}

function Facebook({ post, name }: Mock) {
  return (
    <div style={{ background: "#fff", color: "#050505" }} className="text-[14px]">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Avatar name={name} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-[15px]">{name}</b>
          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "#65676b" }}>
            {timeAgo(post.scheduled_at)} · <Globe className="size-3" />
          </span>
        </div>
        <MoreHorizontal className="size-5" style={{ color: "#65676b" }} />
      </div>
      <div className="px-3 py-2.5">
        <Caption text={post.body} kind="facebook" link="#0064d1" more="#050505" />
      </div>
      <Media post={post} ratio="max-h-[32rem]" />
      <div className="flex items-center justify-between px-3 py-2 text-[13px]" style={{ color: "#65676b" }}>
        <span className="inline-flex items-center gap-1">
          <span className="grid size-[18px] place-items-center rounded-full" style={{ background: "#1877f2" }}>
            <ThumbsUp className="size-2.5" style={{ color: "#fff", fill: "#fff" }} />
          </span>
          ٣٤٢
        </span>
        <span>٤٨ تعليقاً · ١٢ مشاركة</span>
      </div>
      <div className="mx-3 grid grid-cols-3 border-t py-1 text-[14px] font-semibold" style={{ borderColor: "#ced0d4", color: "#65676b" }}>
        {[
          [ThumbsUp, "أعجبني"],
          [MessageCircle, "تعليق"],
          [Share2, "مشاركة"],
        ].map(([I, l]) => {
          const Icon = I as typeof ThumbsUp;
          return (
            <span key={l as string} className="flex items-center justify-center gap-1.5 rounded-md py-1.5">
              <Icon className="size-5" /> {l as string}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function XPost({ post, name, handle }: Mock) {
  const over = post.body.length > LIMITS.x;
  return (
    <div style={{ background: "#fff", color: "#0f1419" }} className="flex gap-3 px-4 py-3 text-[15px]">
      <Avatar name={name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[15px]">
          <b className="truncate">{name}</b>
          <span className="truncate" style={{ color: "#536471" }}>@{handle} · {timeAgo(post.scheduled_at)}</span>
        </div>
        <div className="mt-0.5 leading-snug">
          <p className="whitespace-pre-wrap break-words" dir="auto">
            <Rich text={post.body.slice(0, LIMITS.x)} link="#1d9bf0" />
            {over ? (
              <span style={{ background: "#fde7ea", color: "#f4212e" }}>{post.body.slice(LIMITS.x)}</span>
            ) : null}
          </p>
        </div>
        {post.image_url || post.video_url ? (
          <div className="mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: "#cfd9de" }}>
            <Media post={post} ratio="aspect-video" />
          </div>
        ) : null}
        <div className="mt-3 flex max-w-md justify-between text-[13px]" style={{ color: "#536471" }}>
          <span className="inline-flex items-center gap-1"><MessageCircle className="size-[18px]" /> ٢٤</span>
          <span className="inline-flex items-center gap-1"><Repeat2 className="size-[18px]" /> ٨١</span>
          <span className="inline-flex items-center gap-1"><Heart className="size-[18px]" /> ٤٠٢</span>
          <span className="inline-flex items-center gap-1"><BarChart2 className="size-[18px]" /> ١٢ألف</span>
          <Bookmark className="size-[18px]" />
        </div>
      </div>
    </div>
  );
}

function LinkedIn({ post, name }: Mock) {
  return (
    <div style={{ background: "#fff", color: "rgba(0,0,0,.9)" }} className="text-[14px]">
      <div className="flex gap-2 px-4 pt-3">
        <span className="grid size-12 shrink-0 place-items-center rounded font-bold" style={{ background: "#0a66c2", color: "#fff" }}>
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <b className="block truncate">{name}</b>
          <span className="block text-[12px]" style={{ color: "rgba(0,0,0,.6)" }}>٢٬٣٠٠ متابع</span>
          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "rgba(0,0,0,.6)" }}>
            {timeAgo(post.scheduled_at)} · <Globe className="size-3" />
          </span>
        </div>
        <span className="inline-flex h-fit items-center gap-1 font-semibold" style={{ color: "#0a66c2" }}>
          <Plus className="size-4" /> متابعة
        </span>
      </div>
      <div className="px-4 py-2">
        <Caption text={post.body} kind="linkedin" link="#0a66c2" more="rgba(0,0,0,.6)" />
      </div>
      <Media post={post} ratio="max-h-[30rem]" />
      <div className="px-4 py-2 text-[12px]" style={{ color: "rgba(0,0,0,.6)" }}>👍❤️💡 ١٨٤ · ٢٢ تعليقاً</div>
      <div className="mx-2 grid grid-cols-4 border-t py-1 text-[13px] font-semibold" style={{ borderColor: "#e8e8e8", color: "rgba(0,0,0,.6)" }}>
        {["أعجبني", "تعليق", "إعادة نشر", "إرسال"].map((l) => (
          <span key={l} className="py-2 text-center">{l}</span>
        ))}
      </div>
    </div>
  );
}

function TikTok({ post, handle }: Mock) {
  return (
    <div className="relative aspect-[9/16] max-h-[36rem] overflow-hidden" style={{ background: "#000", color: "#fff" }}>
      {post.video_url || post.image_url ? (
        <div className="absolute inset-0 [&>*]:size-full [&>*]:object-cover">
          <Media post={post} ratio="h-full" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#25f4ee33,#000 45%,#fe2c5533)" }} />
      )}
      <div className="absolute inset-x-0 top-0 flex justify-center gap-4 pt-4 text-[15px] font-semibold">
        <span style={{ opacity: 0.6 }}>متابَعون</span>
        <span className="border-b-2 pb-1">لك</span>
      </div>
      <div className="absolute end-3 bottom-24 flex flex-col items-center gap-5 text-[12px] font-semibold">
        <Avatar name={handle} size={44} />
        <span className="flex flex-col items-center"><Heart className="size-8" style={{ fill: "#fff" }} />٢٤ألف</span>
        <span className="flex flex-col items-center"><MessageCircle className="size-8" />٣٢١</span>
        <span className="flex flex-col items-center"><Bookmark className="size-8" />٩٠٢</span>
        <span className="flex flex-col items-center"><Share2 className="size-8" />١٤٠</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-3 pe-16 text-[14px]" style={{ background: "linear-gradient(transparent,rgba(0,0,0,.7))" }}>
        <b>@{handle}</b>
        <Caption text={post.body} kind="tiktok" link="#fff" more="#fff" />
        <span className="inline-flex items-center gap-1 text-[12px]"><Music2 className="size-3.5" /> الصوت الأصلي — {handle}</span>
      </div>
    </div>
  );
}

function Threads({ post, name, handle }: Mock) {
  const over = post.body.length > LIMITS.threads;
  return (
    <div style={{ background: "#fff", color: "#000" }} className="flex gap-3 px-4 py-3 text-[15px]">
      <Avatar name={name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <b>{handle}</b>
          <span className="text-[14px]" style={{ color: "#999" }}>{timeAgo(post.scheduled_at)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words" dir="auto">
          <Rich text={post.body.slice(0, LIMITS.threads)} link="#0095f6" />
          {over ? <span style={{ background: "#fde7ea", color: "#e0245e" }}>{post.body.slice(LIMITS.threads)}</span> : null}
        </p>
        {post.image_url || post.video_url ? (
          <div className="mt-2 overflow-hidden rounded-xl"><Media post={post} ratio="max-h-96" /></div>
        ) : null}
        <div className="mt-3 flex gap-5" style={{ color: "#000" }}>
          <Heart className="size-5" /><MessageCircle className="size-5" /><Repeat2 className="size-5" /><Send className="size-5" />
        </div>
      </div>
    </div>
  );
}

function Generic({ post, name, provider }: Mock & { provider: string }) {
  return (
    <div className="bg-card p-4 text-sm text-foreground">
      <div className="mb-3 flex items-center gap-2">
        <AppIcon name={provider} className="size-5" />
        <b>{name}</b>
      </div>
      <Media post={post} ratio="max-h-96 rounded-lg" />
      <div className="mt-3"><Caption text={post.body} kind="generic" link="currentColor" more="currentColor" /></div>
    </div>
  );
}

type Mock = { post: PreviewPost; name: string; handle: string };

export function PlatformPreviewDialog({
  open,
  onOpenChange,
  post,
  accountName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  post: PreviewPost;
  accountName?: string | null;
}) {
  const initial = platformKind(post.provider);
  const [kind, setKind] = useState<Kind>(initial);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const name = accountName?.trim() || "علامتك";
  const handle = useMemo(
    () => name.toLowerCase().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 24) || "brand",
    [name],
  );
  const tabs = TABS.some((t) => t.kind === initial) || initial === "generic" ? TABS : TABS;
  const limit = LIMITS[kind];
  const len = [...post.body].length;
  const over = len > limit;
  const props: Mock = { post, name, handle };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] w-[calc(100vw-1rem)] max-w-xl grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <div className="border-b border-border p-4 pr-12">
          <DialogTitle className="font-display text-base font-black">معاينة على المنصة</DialogTitle>
          <DialogDescription className="text-xs">
            هكذا سيظهر منشورك للجمهور — الأرقام توضيحية.
          </DialogDescription>
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
            {(initial === "generic" ? [{ kind: "generic" as Kind, provider: post.provider }, ...tabs] : tabs).map((t) => (
              <button
                key={t.kind}
                type="button"
                onClick={() => setKind(t.kind)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  kind === t.kind ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary",
                )}
              >
                <AppIcon name={t.provider} className="size-3.5" />
                {t.kind === "x" ? "X" : appLabel(t.provider)}
                {t.kind === initial ? <span className="text-[0.6rem] opacity-70">· الأصلية</span> : null}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span className={cn("font-bold", over ? "text-destructive" : "text-muted-foreground")}>
              {len.toLocaleString("ar-EG")} / {limit.toLocaleString("ar-EG")} حرف
              {over ? " — أطول من حد المنصة، سيُقص الجزء المظلل" : ""}
            </span>
            <div className="inline-flex rounded-full border border-border p-0.5">
              <button type="button" aria-label="هاتف" onClick={() => setDevice("mobile")} className={cn("rounded-full p-1.5", device === "mobile" && "bg-secondary")}>
                <Smartphone className="size-3.5" />
              </button>
              <button type="button" aria-label="كمبيوتر" onClick={() => setDevice("desktop")} className={cn("rounded-full p-1.5", device === "desktop" && "bg-secondary")}>
                <Monitor className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="max-h-[calc(94dvh-11rem)] min-w-0 overflow-y-auto overflow-x-hidden bg-secondary/60 p-2 sm:p-4">
          <div
            className={cn(
              "mx-auto w-full overflow-hidden border border-border shadow-lift transition-all",
              device === "mobile" ? "max-w-[22rem] rounded-[1.75rem]" : "max-w-[34rem] rounded-xl",
            )}
          >
            {kind === "instagram" ? <Instagram {...props} /> : null}
            {kind === "facebook" ? <Facebook {...props} /> : null}
            {kind === "x" ? <XPost {...props} /> : null}
            {kind === "linkedin" ? <LinkedIn {...props} /> : null}
            {kind === "tiktok" ? <TikTok {...props} /> : null}
            {kind === "threads" ? <Threads {...props} /> : null}
            {kind === "youtube" || kind === "generic" ? <Generic {...props} provider={post.provider} /> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
