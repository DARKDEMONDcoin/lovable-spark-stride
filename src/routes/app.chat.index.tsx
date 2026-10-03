import { createFileRoute, Link } from "@tanstack/react-router";

import { ChatShellMeta } from "@/components/app/ChatShellHost";
import { Portrait } from "@/components/site/Portrait";
import { team } from "@/data/team";
import { useChatWorkspace, useEmployeeInbox } from "@/lib/data";
import { ChatSpaceSwitcher } from "@/components/app/ChatSpaceSwitcher";
import { inboxTime } from "@/lib/inbox-time";

export const Route = createFileRoute("/app/chat/")({
  head: () => ({
    meta: [
      { title: "المحادثات | سهل" },
      { name: "description", content: "تحدث مع أي موظف من فريقك الرقمي." },
      { property: "og:title", content: "المحادثات | سهل" },
      { property: "og:description", content: "تحدث مع أي موظف من فريقك الرقمي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const { data: workspace } = useChatWorkspace();
  const { data: inbox } = useEmployeeInbox(workspace?.id);

  return (
    <>
      <ChatShellMeta
        title="المحادثات"
        lead="اطلب من أي موظف ما تحتاجه — بالعربية وبلهجتك."
        padded
      />
      <div className="mx-auto mb-3 w-full max-w-3xl px-2"><ChatSpaceSwitcher /></div>
      <div className="mx-auto w-full max-w-3xl divide-y divide-border border-y border-border">
        {team.map((m) => {
          const thread = (inbox ?? []).find((item) => item.employee_id === m.id);
          const unread = thread?.unread_count ?? 0;
          const time = inboxTime(thread?.last_employee_message_at);
          return (
            <Link
              key={m.id}
              to="/app/chat/$id"
              params={{ id: m.id }}
              className="group flex min-h-20 items-center gap-3 px-2 py-3 transition-colors hover:bg-secondary/60 sm:px-4"
            >
                <span className="relative block size-14 shrink-0 overflow-hidden rounded-full shadow-card">
                  <Portrait
                    memberId={m.id}
                    name={m.name}
                    className="size-full transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <strong className={unread ? "font-black" : "font-bold"}>{m.name}</strong>
                    <time className={unread ? "text-xs font-bold text-primary" : "text-xs text-muted-foreground"}>{time}</time>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className={unread ? "line-clamp-1 min-w-0 flex-1 text-sm font-bold" : "line-clamp-1 min-w-0 flex-1 text-sm text-muted-foreground"}>
                      {thread?.last_employee_message ?? m.tagline}
                    </span>
                    {unread ? (
                      <b className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[0.65rem] text-primary-foreground">
                        {unread > 99 ? "99+" : unread}
                      </b>
                    ) : null}
                  </span>
                </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
