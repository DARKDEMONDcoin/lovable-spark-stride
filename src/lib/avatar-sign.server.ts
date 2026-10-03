import type { SupabaseClient } from "@supabase/supabase-js";

/** يحوّل مسارات صور الملفات الشخصية إلى روابط قابلة للعرض (الصور الجاهزة تبقى بمفتاحها ويحلّها المتصفح). */
export async function signAvatars(admin: SupabaseClient, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const stored = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("preset:")))];
  for (const p of paths) if (p?.startsWith("preset:")) out.set(p, p);
  if (stored.length) {
    const { data } = await admin.storage.from("avatars").createSignedUrls(stored, 60 * 60);
    for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
