import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";

import { useTasks, useUpdateTask } from "@/lib/data";
import { saveLearningFeedback } from "@/lib/learning.functions";

/**
 * اعتماد المخرج داخل المحادثة نفسها — بلا مغادرة الشات.
 * صفحة «الموافقات» تبقى خياراً نصياً صغيراً فقط لمن يريد المراجعة لاحقاً.
 */
export function InlineApproval({
  workspaceId,
  taskId,
  employeeName,
  onDone,
  command,
  approveLabel = "اعتمد الآن",
  readyLabel = "المخرج جاهز",
}: {
  approveLabel?: string;
  readyLabel?: string;
  workspaceId?: string | undefined;
  taskId: string;
  employeeName: string;
  onDone?: () => void;
  /** أمر من الشات: اعتماد أو رفض بسبب — يتغيّر n مع كل أمر جديد. */
  command?: { n: number; kind: "approve" | "reject"; reason?: string } | null;
}) {
  const { data: tasks } = useTasks(workspaceId);
  const update = useUpdateTask(workspaceId);
  const saveFeedback = useServerFn(saveLearningFeedback);
  const [busy, setBusy] = useState<"done" | "rejected" | null>(null);
  const [state, setState] = useState<"open" | "done" | "rejected">("open");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const task = (tasks ?? []).find((item) => item.id === taskId);
  /** قفل فوري يمنع الضغط المزدوج قبل أن تُحدَّث الحالة على الشاشة. */
  const inFlight = useRef(false);
  const act = async (status: "done" | "rejected", overrideReason?: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(status);
    try {
      await update.mutateAsync({
        id: taskId,
        patch:
          status === "done"
            ? {
                status,
                steps: [
                  { label: "فهم الطلب", state: "done" },
                  { label: "التنفيذ", state: "done" },
                  { label: "مراجعتك", state: "done" },
                 { label: "الاعتماد", state: "done" },
                ],
              }
            : { status },
      });
      if (workspaceId && task) {
        await saveFeedback({
          data: {
            workspaceId,
            taskId,
            employeeId: task.employee_id,
            kind: status === "done" ? "approved" : "rejected",
            reason:
              status === "rejected"
                ? (overrideReason ?? reason).trim() || "رفض المالك المخرج من المحادثة"
                : "اعتمد المالك المخرج من المحادثة",
          },
        });
      }
      setState(status);
      onDone?.();
    } finally {
      inFlight.current = false;
      setBusy(null);
      setRejecting(false);
    }
  };

  const lastCommand = useRef(command?.n ?? 0);
  useEffect(() => {
    if (!command || command.n === lastCommand.current) return;
    lastCommand.current = command.n;
    if (state !== "open" || busy) return;
    if (command.kind === "reject") void act("rejected", command.reason ?? "");
    else void act("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.n]);

  if (state !== "open") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm font-semibold animate-pop-in">
        {state === "done" ? (
          <>
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-jade text-background">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            تم الاعتماد داخل المحادثة.
          </>
        ) : (
          <>
            <X className="size-4 text-coral" /> تم الرفض، و{employeeName} تعلّم من الملاحظة.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 min-w-0 [overflow-wrap:anywhere] rounded-2xl border border-jade/25 bg-jade/8 p-4 animate-pop-in">
      <p className="flex items-center gap-2 text-sm font-bold text-jade-deep">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-jade text-background">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        {task?.title ? task.title : readyLabel} — بانتظار اعتمادك
      </p>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            dir="auto"
            rows={2}
            placeholder={`ما الذي لم يعجبك؟ ${employeeName} سيتعلم منه.`}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => void act("rejected")}
              disabled={busy !== null}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-coral px-4 text-xs font-bold text-background"
            >
              {busy === "rejected" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              تأكيد الرفض
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setRejecting(false)}
              className="min-h-10 px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              تراجع
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={() => void act("done")}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-jade-deep px-4 text-xs font-bold text-background transition-transform hover:-translate-y-0.5"
          >
            {busy === "done" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            {approveLabel}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setRejecting(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-coral"
          >
            <X className="size-3.5" /> ارفض
          </Button>
          <Link
            to="/app/approvals"
            className="ms-auto inline-flex min-h-10 items-center text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            أو راجعه لاحقاً في صفحة الموافقات
          </Link>
        </div>
      )}
    </div>
  );
}
