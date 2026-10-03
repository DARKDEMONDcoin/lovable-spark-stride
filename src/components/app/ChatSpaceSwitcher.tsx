import { Users } from "lucide-react";

import { setChatSpace, useChatSpaces, useChatWorkspace, useWorkspace } from "@/lib/data";

/** Picks which space employee chats run in; team spaces share conversations with every member. */
export function ChatSpaceSwitcher() {
  const { data: own } = useWorkspace();
  const { data: spaces } = useChatSpaces();
  const { data: active } = useChatWorkspace();
  if (!spaces || spaces.length < 2) return null;
  const shared = Boolean((active as { shared?: boolean } | null)?.shared);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
      <Users className="size-4 text-primary" aria-hidden="true" />
      <label htmlFor="chat-space" className="font-bold">
        مساحة المحادثة
      </label>
      <select
        id="chat-space"
        aria-label="مساحة المحادثة"
        value={active?.id ?? ""}
        onChange={(e) => setChatSpace(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1"
      >
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id === own?.id ? `${s.name} (خاصة بي)` : `${s.name} (فريق)`}
          </option>
        ))}
      </select>
      {shared ? (
        <span className="text-xs text-muted-foreground">محادثة مشتركة — كل أعضاء الفريق يشوفوها ويكملوا عليها</span>
      ) : null}
    </div>
  );
}
