import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * صندوق إشعارات المستخدم: دعوات مساحات العمل الموجّهة لبريده (قبول/رفض)،
 * وإشعارات المالك عند قبول أو رفض دعوته.
 */

async function verifiedEmail(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = data.user;
  return { admin: supabaseAdmin, email: user?.email?.toLowerCase() ?? null, confirmed: Boolean(user?.email_confirmed_at), name: (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? "عضو" };
}

export const listMyInbox = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, email } = await verifiedEmail(context.userId);
    const invites: { id: string; workspaceId: string; workspaceName: string; inviterName: string; inviterAvatar: string | null; role: string; createdAt: string; expiresAt: string }[] = [];
    if (email) {
      const { data: rows } = await admin.from("workspace_invitations")
        .select("id, workspace_id, role, invited_by, created_at, expires_at")
        .eq("email", email).is("accepted_at", null).is("revoked_at", null).is("declined_at", null)
        .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(20);
      const list = rows ?? [];
      if (list.length) {
        const [{ data: spaces }, { data: people }, { data: mine }] = await Promise.all([
          admin.from("workspaces").select("id, name, owner_id").in("id", list.map((r) => r.workspace_id)),
          admin.from("profiles").select("id, full_name, avatar_url").in("id", list.map((r) => r.invited_by)),
          admin.from("workspace_members").select("workspace_id").eq("user_id", context.userId),
        ]);
        const { signAvatars } = await import("./avatar-sign.server");
        const signed = await signAvatars(admin, (people ?? []).map((p) => p.avatar_url));
        const avatars = new Map((people ?? []).map((p) => [p.id, p.avatar_url ? signed.get(p.avatar_url) ?? null : null]));
        const joined = new Set((mine ?? []).map((m) => m.workspace_id));
        const seen = new Set<string>();
        const spaceMap = new Map((spaces ?? []).map((s) => [s.id, s]));
        const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
        for (const r of list) {
          const space = spaceMap.get(r.workspace_id);
          if (!space || space.owner_id === context.userId || joined.has(r.workspace_id) || seen.has(r.workspace_id)) continue;
          seen.add(r.workspace_id);
          invites.push({ id: r.id, workspaceId: r.workspace_id, workspaceName: space.name, inviterName: names.get(r.invited_by) || "مالك المساحة", inviterAvatar: avatars.get(r.invited_by) ?? null, role: r.role, createdAt: r.created_at, expiresAt: r.expires_at });
        }
      }
    }
    const { data: notes } = await context.supabase.from("user_notifications")
      .select("id, kind, title, body, workspace_id, read_at, created_at")
      .order("created_at", { ascending: false }).limit(30);
    return { invites, notifications: notes ?? [] };
  });

const respondInput = z.object({ invitationId: z.string().uuid(), accept: z.boolean() });

export const respondToInvite = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => respondInput.parse(input))
  .handler(async ({ data, context }) => {
    const { admin, email, confirmed, name } = await verifiedEmail(context.userId);
    if (!email) throw new Error("حسابك بلا بريد إلكتروني.");
    if (data.accept && !confirmed) throw new Error("أكّد بريدك الإلكتروني أولاً ثم اقبل الدعوة.");
    const { data: invite } = await admin.from("workspace_invitations")
      .select("id, workspace_id, email, role, invited_by, expires_at, accepted_at, revoked_at, declined_at")
      .eq("id", data.invitationId).maybeSingle();
    if (!invite || invite.email !== email || invite.accepted_at || invite.revoked_at || invite.declined_at || new Date(invite.expires_at) <= new Date())
      throw new Error("هذه الدعوة لم تعد متاحة.");
    const { data: space } = await admin.from("workspaces").select("id, name, owner_id").eq("id", invite.workspace_id).single();
    if (!space) throw new Error("مساحة العمل غير موجودة.");
    const now = new Date().toISOString();
    if (data.accept) {
      if (space.owner_id === context.userId) throw new Error("أنت مالك هذه المساحة بالفعل.");
      const { error } = await admin.from("workspace_members").upsert({ workspace_id: invite.workspace_id, user_id: context.userId, role: invite.role }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
      if (error) throw new Error("تعذّر الانضمام. حاول مجدداً.");
      await admin.from("workspace_invitations").update({ accepted_at: now }).eq("id", invite.id);
    } else {
      await admin.from("workspace_invitations").update({ declined_at: now }).eq("id", invite.id);
    }
    await admin.from("user_notifications").insert({
      user_id: invite.invited_by,
      workspace_id: invite.workspace_id,
      kind: data.accept ? "invite_accepted" : "invite_declined",
      title: data.accept ? `${name} انضم إلى «${space.name}»` : `${name} اعتذر عن دعوة «${space.name}»`,
      body: data.accept ? "أصبح عضواً ويمكنك الآن إسناد المهام له." : "يمكنك إرسال دعوة جديدة لاحقاً إن رغبت.",
    });
    return { workspaceId: invite.workspace_id, accepted: data.accept };
  });

export const markNotificationsRead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    return { ok: true };
  });
