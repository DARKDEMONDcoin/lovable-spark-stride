import robotMale from "@/assets/default-user-robot.jpg";
import robotFemale from "@/assets/default-user-robot-female.jpg";

/** صور جاهزة يختارها المستخدم بدل الرفع؛ تُحفظ في الملف الشخصي كـ "preset:<id>". */
export const AVATAR_PRESETS = [
  { id: "robot-male", label: "روبوت", src: robotMale },
  { id: "robot-female", label: "روبوت أنثى", src: robotFemale },
] as const;

export const PRESET_PREFIX = "preset:";
export const DEFAULT_AVATAR = robotMale;

export function presetSrc(path: string | null | undefined): string | null {
  if (!path?.startsWith(PRESET_PREFIX)) return null;
  const id = path.slice(PRESET_PREFIX.length);
  return AVATAR_PRESETS.find((p) => p.id === id)?.src ?? null;
}
