import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { telegramStatus } from "@/lib/telegram.functions";
import { saveBrandKnowledge } from "@/lib/brand-knowledge.functions";
import { listMyHumanSpaces } from "@/lib/collaboration.functions";
import { useEffect, useState } from "react";

export type Workspace = Tables<"workspaces">;
export type Profile = Tables<"profiles">;
export type Integration = Tables<"integrations">;
export type BrainItem = Tables<"brain_items">;
export type Task = Tables<"tasks">;
export type Message = Tables<"messages">;
export type Conversation = Tables<"conversations">;
export type NotificationPreferences = Tables<"notification_preferences">;

export type TaskStep = { label: string; state: "done" | "active" | "todo" | "blocked" };

export function taskSteps(task: Task): TaskStep[] {
  const raw = task.steps;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is TaskStep => !!s && typeof s === "object" && "label" in (s as Record<string, unknown>),
  );
}

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      return must<Profile>(
        supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      );
    },
  });
}

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const rows = await must<Workspace[]>(
        supabase.from("workspaces").select("*").order("created_at", { ascending: true }),
      );
      return rows[0] ?? null;
    },
  });
}

export const CHAT_SPACE_KEY = "sahl:chat-workspace";
export const CHAT_SPACE_EVENT = "sahl:chat-workspace-change";

export function setChatSpace(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CHAT_SPACE_KEY, id);
    else window.localStorage.removeItem(CHAT_SPACE_KEY);
    window.dispatchEvent(new Event(CHAT_SPACE_EVENT));
  } catch {
    /* ignore */
  }
}

/** Spaces the user can chat in: their own plus team spaces they joined. */
export function useChatSpaces() {
  const listSpaces = useServerFn(listMyHumanSpaces);
  return useQuery({ queryKey: ["human-spaces"], queryFn: () => listSpaces(), staleTime: 60_000 });
}

/**
 * The workspace employee chats run in. Defaults to the user's own space; when a team
 * space is selected, every member shares the same employee conversations there.
 */
export function useChatWorkspace() {
  const own = useWorkspace();
  const spaces = useChatSpaces();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        setSelected(window.localStorage.getItem(CHAT_SPACE_KEY));
      } catch {
        setSelected(null);
      }
    };
    read();
    window.addEventListener(CHAT_SPACE_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHAT_SPACE_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const shared =
    selected && selected !== own.data?.id ? (spaces.data ?? []).find((s) => s.id === selected) : undefined;
  if (shared) {
    return {
      ...own,
      data: { id: shared.id, name: shared.name, shared: true } as unknown as Workspace & { shared?: boolean },
    };
  }
  return { ...own, data: own.data ? ({ ...own.data, shared: false } as Workspace & { shared?: boolean }) : own.data };
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      return must<NotificationPreferences>(
        supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", auth.user.id)
          .maybeSingle(),
      );
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">,
    ) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("سجّل الدخول لحفظ تفضيلات التنبيهات.");
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: auth.user.id, ...patch }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}

export function useIntegrations(workspaceId?: string) {
  return useQuery({
    queryKey: ["integrations", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<Integration[]>(
        supabase
          .from("integrations")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: true }),
      ),
  });
}

export function useBrainItems(workspaceId?: string) {
  return useQuery({
    queryKey: ["brain", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<BrainItem[]>(
        supabase
          .from("brain_items")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useTasks(workspaceId?: string) {
  return useQuery({
    queryKey: ["tasks", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<Task[]>(
        supabase
          .from("tasks")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useConversations(workspaceId: string | undefined, employeeId: string) {
  return useQuery({
    queryKey: ["conversations", workspaceId, employeeId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const conversations = await must<Conversation[]>(
        supabase
          .from("conversations")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .eq("employee_id", employeeId)
          .order("updated_at", { ascending: false }),
      );
      if (!conversations.length) return [];

      const messageRows = await must<Array<{ conversation_id: string | null }>>(
        supabase
          .from("messages")
          .select("conversation_id")
          .eq("workspace_id", workspaceId!)
          .eq("employee_id", employeeId)
          .in(
            "conversation_id",
            conversations.map((conversation) => conversation.id),
          ),
      );
      const nonEmptyIds = new Set(
        messageRows.map((message) => message.conversation_id).filter(Boolean),
      );
      return conversations.filter((conversation) => nonEmptyIds.has(conversation.id));
    },
  });
}

/** محادثة واحدة ثابتة لكل موظف؛ القيد الفريد يمنع ازدواجها حتى مع طلبين متزامنين. */
export function useEmployeeConversation(workspaceId: string | undefined, employeeId: string) {
  return useQuery({
    queryKey: ["employee-conversation", workspaceId, employeeId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const existing = await must<Conversation | null>(
        supabase
          .from("conversations")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .eq("employee_id", employeeId)
          .maybeSingle(),
      );
      if (existing) return existing;
      return must<Conversation>(
        supabase
          .from("conversations")
          .upsert(
            { workspace_id: workspaceId!, employee_id: employeeId, title: "المحادثة" },
            { onConflict: "workspace_id,employee_id" },
          )
          .select()
          .single(),
      );
    },
  });
}

export function useEmployeeInbox(workspaceId?: string) {
  return useQuery({
    queryKey: ["employee-inbox", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    queryFn: () =>
      must<Conversation[]>(
        supabase
          .from("conversations")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("last_employee_message_at", { ascending: false, nullsFirst: false }),
      ),
  });
}

export function useMarkConversationRead(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["employee-inbox", workspaceId] }),
  });
}

export function useMessages(
  workspaceId: string | undefined,
  employeeId: string,
  conversationId?: string,
) {
  return useQuery({
    queryKey: ["messages", workspaceId, employeeId, conversationId],
    enabled: !!workspaceId && !!conversationId,
    queryFn: () =>
      must<Message[]>(
        supabase
          .from("messages")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .eq("employee_id", employeeId)
          .eq("conversation_id", conversationId!)
          .order("created_at", { ascending: true }),
      ),
  });
}

export function useLastMessages(workspaceId?: string) {
  return useQuery({
    queryKey: ["messages-last", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      must<Message[]>(
        supabase
          .from("messages")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: false })
          .limit(60),
      ),
  });
}

export function useUpdateTask(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
  });
}

export function useCreateTask(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      employee_id: string;
      title: string;
      detail?: string;
      channel?: string;
      kind?: string;
      status?: string;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .insert({ ...task, workspace_id: workspaceId! });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
  });
}

export function useSetIntegrationStatus(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      account,
    }: {
      id: string;
      status: string;
      account: string | null;
    }) => {
      const { error } = await supabase
        .from("integrations")
        .update({ status, account })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations", workspaceId] });
    },
  });
}

export function useAddBrainItem(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { kind: string; title: string; body?: string; meta?: string }) => {
      const { error } = await supabase.from("brain_items").insert({
        workspace_id: workspaceId!,
        kind: item.kind,
        title: item.title,
        body: item.body ?? null,
        meta: item.meta ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["brain", workspaceId] });
    },
  });
}

export function useSaveBrandKnowledge(workspaceId?: string) {
  const qc = useQueryClient();
  const save = useServerFn(saveBrandKnowledge);
  return useMutation({
    mutationFn: (item: { kind: "note" | "link"; value: string; title?: string }) => {
      if (!workspaceId) throw new Error("مساحة العمل غير جاهزة بعد.");
      return save({ data: { workspaceId, ...item } });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brain", workspaceId] }),
  });
}

export function useUpdateBrainItem(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, body }: { id: string; title: string; body: string }) => {
      const { error } = await supabase
        .from("brain_items")
        .update({ title: title.trim(), body: body.trim() })
        .eq("id", id)
        .eq("workspace_id", workspaceId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brain", workspaceId] }),
  });
}

/** Active rules reach every employee; an empty used_by pauses the rule without deleting it. */
export function useToggleBrainItem(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("brain_items")
        .update({ used_by: active ? ["sonny", "eva", "sam", "nour", "dana", "adam"] : [] })
        .eq("id", id)
        .eq("workspace_id", workspaceId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brain", workspaceId] }),
  });
}

export function useDeleteBrainItem(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("brain_items")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["brain", workspaceId] });
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Workspace> }) => {
      const { error } = await supabase.from("workspaces").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Profile> }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export type SocialPost = Tables<"social_posts">;
export type PipedreamAccount = Tables<"pipedream_accounts">;

/** حسابات النشر المتصلة؛ تيليجرام لا يُعد متصلاً إلا من الربط المباشر. */
export function useConnectedAccounts(workspaceId?: string) {
  const getTelegramStatus = useServerFn(telegramStatus);
  return useQuery({
    queryKey: ["pipedream-accounts", workspaceId],
    enabled: !!workspaceId,
    // OAuth happens outside the app; always refresh when the user returns to the publishing screen.
    refetchOnMount: "always",
    queryFn: async () => {
      if (!workspaceId) return [];
      const [accounts, telegram] = await Promise.all([
        must<PipedreamAccount[]>(
          supabase
            .from("pipedream_accounts")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("status", "connected"),
        ),
        getTelegramStatus({ data: { workspaceId } }),
      ]);
      const nonTelegramAccounts = accounts.filter((account) => account.provider !== "telegram");
      if (!telegram.connected) return nonTelegramAccounts;
      const now = new Date().toISOString();
      return [
        ...nonTelegramAccounts,
        {
          id: `direct-telegram-${workspaceId}`,
          workspace_id: workspaceId,
          provider: "telegram",
          app_slug: "telegram_bot_api",
          account_id: `direct:${workspaceId}`,
          account_name: telegram.chatTitle || telegram.botUsername || "Telegram",
          status: "connected",
          healthy: true,
          last_error: null,
          page_id: null,
          instagram_business_id: null,
          connected_at: now,
          updated_at: now,
        },
      ];
    },
  });
}

/** طابور النشر: المجدول والمنشور والفاشل. */
export function useSocialPosts(workspaceId?: string) {
  return useQuery({
    queryKey: ["social-posts", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 60_000,
    queryFn: () =>
      must<SocialPost[]>(
        supabase
          .from("social_posts")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("scheduled_at", { ascending: true })
          .limit(200),
      ),
  });
}
