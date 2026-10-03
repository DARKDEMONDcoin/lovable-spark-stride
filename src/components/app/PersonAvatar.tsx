import { DEFAULT_AVATAR, presetSrc } from "@/lib/avatar-presets";
import { cn } from "@/lib/utils";

/** صورة أي شخص في الفريق: الصورة المرفوعة أو الجاهزة، وإلا الصورة الافتراضية. */
export function PersonAvatar({ avatar, name, className }: { avatar?: string | null | undefined; name: string; className?: string | undefined }) {
  const src = presetSrc(avatar) ?? avatar ?? DEFAULT_AVATAR;
  return (
    <img
      src={src}
      alt={`صورة ${name}`}
      title={name}
      loading="lazy"
      className={cn("size-10 shrink-0 rounded-full bg-secondary object-cover", className)}
    />
  );
}
