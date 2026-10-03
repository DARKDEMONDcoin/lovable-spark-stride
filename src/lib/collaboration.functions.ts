import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });
const invitationInput = workspaceInput.extend({ email: z.string().email().max(254), role: z.enum(["admin", "member"]).default("member") });

export const inviteHuman = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => invitationInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: workspace } = await context.supabase.from("workspaces").select("id").eq("id", data.workspaceId).eq("owner_id", context.userId).maybeSingle();
    if (!workspace) throw new Error("المالك وحده يستطيع دعوة أعضاء جدد.");
    const email = data.email.trim().toLowerCase();
    if (email === String(context.claims?.["email"] ?? "").toLowerCase()) throw new Error("لا يمكنك دعوة نفسك.");
    // دعوة واحدة فعّالة لكل بريد: تُلغى السابقة غير المقبولة حتى لا تتكرر الإشعارات.
    await context.supabase.from("workspace_invitations").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", data.workspaceId).eq("email", email).is("accepted_at", null).is("revoked_at", null);
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error } = await context.supabase.from("workspace_invitations").insert({ workspace_id: data.workspaceId, email, role: data.role, token_hash: tokenHash, invited_by: context.userId });
    if (error) throw new Error(error.message);
    return { token };
  });

export const acceptHumanInvite = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const tokenHash = createHash("sha256").update(data.token).digest("hex");
    const { data: workspaceId, error } = await context.supabase.rpc("accept_workspace_invitation", { _token_hash: tokenHash });
    if (error || !workspaceId) throw new Error("الرابط منتهي أو البريد الإلكتروني للحساب لا يطابق الدعوة. تأكد من تأكيد بريدك وتسجيل الدخول بالحساب المدعو.");
    return { workspaceId };
  });

export const removeHumanMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => workspaceInput.extend({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: workspace } = await context.supabase.from("workspaces").select("id").eq("id", data.workspaceId).eq("owner_id", context.userId).maybeSingle();
    if (!workspace) throw new Error("المالك وحده يستطيع إزالة الأعضاء.");
    const { error } = await context.supabase.from("workspace_members").delete().eq("workspace_id", data.workspaceId).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeMemberRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => workspaceInput.extend({ userId: z.string().uuid(), role: z.enum(["admin", "member"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: workspace } = await context.supabase.from("workspaces").select("id").eq("id", data.workspaceId).eq("owner_id", context.userId).maybeSingle();
    if (!workspace) throw new Error("المالك وحده يستطيع تغيير الأدوار.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ownership verified above; members cannot update their own role rows directly.
    const { error } = await supabaseAdmin.from("workspace_members").update({ role: data.role }).eq("workspace_id", data.workspaceId).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_notifications").insert({ user_id: data.userId, workspace_id: data.workspaceId, kind: "role_changed", title: "تغيّر دورك", body: data.role === "admin" ? "أصبحت مدير مشاريع في المساحة." : "أصبحت عضواً في المساحة." });
    return { ok: true };
  });

export const revokeHumanInvite = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => workspaceInput.extend({ invitationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: workspace } = await context.supabase.from("workspaces").select("id").eq("id", data.workspaceId).eq("owner_id", context.userId).maybeSingle();
    if (!workspace) throw new Error("المالك وحده يستطيع إلغاء الدعوات.");
    const { error } = await context.supabase.from("workspace_invitations").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", data.workspaceId).eq("id", data.invitationId).is("accepted_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listHumanTeam = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => workspaceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: ownWorkspace } = await context.supabase.from("workspaces").select("id").eq("id", data.workspaceId).eq("owner_id", context.userId).maybeSingle();
    const owner = Boolean(ownWorkspace);
    if (!owner) {
      const { data: membership } = await context.supabase.from("workspace_members").select("user_id").eq("workspace_id", data.workspaceId).eq("user_id", context.userId).maybeSingle();
      if (!membership) throw new Error("ليس لديك وصول لهذه المساحة.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Access was verified above; privileged reads expose only display names and team roles.
    const { data: workspace, error: workspaceError } = await supabaseAdmin.from("workspaces").select("id, owner_id, name").eq("id", data.workspaceId).single();
    if (workspaceError || !workspace) throw new Error("مساحة العمل غير متاحة.");
    const { data: members, error } = await supabaseAdmin.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    const ids = [workspace.owner_id, ...(members ?? []).map((m) => m.user_id)];
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", ids);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const { signAvatars } = await import("./avatar-sign.server");
    const signed = await signAvatars(supabaseAdmin, (profiles ?? []).map((p) => p.avatar_url));
    const avatars = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url ? signed.get(p.avatar_url) ?? null : null]));
    return { owner, workspaceName: workspace.name, members: [
      { userId: workspace.owner_id, role: "owner", name: names.get(workspace.owner_id) || "مالك المساحة", avatar: avatars.get(workspace.owner_id) ?? null },
      ...(members ?? []).map((m) => ({ userId: m.user_id, role: m.role, name: names.get(m.user_id) || "عضو الفريق", avatar: avatars.get(m.user_id) ?? null })),
    ] };
  });

export const listMyHumanSpaces = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: owned, error: ownError } = await context.supabase.from("workspaces").select("id, name").eq("owner_id", context.userId);
    const { data: joined, error: joinError } = await context.supabase.from("workspace_members").select("workspace_id").eq("user_id", context.userId);
    if (ownError || joinError) throw new Error("تعذّر تحميل مساحات الفريق.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const joinedIds = (joined ?? []).map((m) => m.workspace_id).filter((id) => !(owned ?? []).some((w) => w.id === id));
    const { data: invited } = joinedIds.length ? await supabaseAdmin.from("workspaces").select("id, name").in("id", joinedIds) : { data: [] as { id: string; name: string }[] };
    return [...(owned ?? []), ...(invited ?? [])];
  });