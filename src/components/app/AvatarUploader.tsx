import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AVATAR_PRESETS, DEFAULT_AVATAR as defaultUserAvatar, PRESET_PREFIX, presetSrc } from "@/lib/avatar-presets";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const MAX_BYTES = 5 * 1024 * 1024;

/** رفع الصورة الشخصية إلى مخزن خاص بكل مستخدم، مع رابط موقّع للعرض. */
export function AvatarUploader({
  userId,
  path,
  name,
  onChange,
  onError,
}: {
  userId: string;
  path: string | null;
  name: string;
  onChange: (nextPath: string | null) => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (!path || presetSrc(path)) {
      setPreview(presetSrc(path));
      return;
    }
    void supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (alive) setPreview(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return onError("اختر ملف صورة فقط.");
    if (file.size > MAX_BYTES) return onError("حجم الصورة يجب أن يكون أقل من ٥ ميجابايت.");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const key = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(key, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      if (path && !presetSrc(path)) await supabase.storage.from("avatars").remove([path]);
      await onChange(key);
    } catch {
      onError("تعذّر رفع الصورة. أعد المحاولة.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        <Button type="button" variant="ghost" size="icon" onClick={() => setPhotoOpen(true)} aria-label="عرض الصورة الشخصية كاملة" className="grid size-20 place-items-center overflow-hidden rounded-full border border-border bg-secondary p-0 text-lg font-black">
          <img
            src={preview ?? defaultUserAvatar}
            alt={preview ? `صورة ${name || "المستخدم"}` : "الصورة الافتراضية للمستخدم"}
            loading="lazy"
            width={1024}
            height={1024}
            className="size-full object-cover"
          />
        </Button>
        {busy ? (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
            <Loader2 className="size-5 animate-spin text-primary" />
          </span>
        ) : null}
      </div>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[min(94vw,42rem)] max-w-none items-center justify-center overflow-hidden border-border bg-card p-3 sm:p-5" aria-describedby={undefined}>
          <DialogTitle className="sr-only">الصورة الشخصية</DialogTitle>
          <img src={preview ?? defaultUserAvatar} alt={preview ? `صورة ${name || "المستخدم"}` : "الصورة الافتراضية للمستخدم"} width={1024} height={1024} className="max-h-[82dvh] max-w-full object-contain" />
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="اختر صورة جاهزة">
          <span className="text-xs font-bold text-muted-foreground">صورة جاهزة:</span>
          {AVATAR_PRESETS.map((preset) => {
            const active = path === PRESET_PREFIX + preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={preset.label}
                title={preset.label}
                disabled={busy}
                onClick={async () => {
                  if (active) return;
                  setBusy(true);
                  try {
                    if (path && !presetSrc(path)) await supabase.storage.from("avatars").remove([path]);
                    await onChange(PRESET_PREFIX + preset.id);
                  } catch {
                    onError("تعذّر حفظ الصورة.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className={`size-12 overflow-hidden rounded-full border-2 transition ${active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/60"}`}
              >
                <img src={preset.src} alt="" loading="lazy" width={1024} height={1024} className="size-full object-cover" />
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Camera className="size-4" />
            {path && !presetSrc(path) ? "تغيير صورتك" : "رفع صورة من جهازك"}
          </Button>
          {path ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (!presetSrc(path)) await supabase.storage.from("avatars").remove([path]);
                  await onChange(null);
                } catch {
                  onError("تعذّر حذف الصورة.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="size-4" />
              حذف
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG أو JPG حتى ٥ ميجابايت. تظهر لك وحدك داخل حسابك.
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
