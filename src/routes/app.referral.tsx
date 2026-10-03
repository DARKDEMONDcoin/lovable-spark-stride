import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/referral")({
  head: () => ({ meta: [
    { title: "شارك واربح | سهل" },
    { name: "description", content: "صفحة برنامج الإحالة القادم في سهل." },
    { property: "og:title", content: "شارك واربح | سهل" },
    { property: "og:description", content: "صفحة برنامج الإحالة القادم في سهل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ReferralPage,
});

function ReferralPage() {
  return <AppShell title="شارك واربح">
    <section className="mx-auto max-w-2xl border-t border-border py-12">
      <Gift className="mb-5 size-9 text-primary" aria-hidden="true" />
      <h2 className="font-display text-2xl font-black">برنامج الإحالة قيد الإعداد</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">نعمل على تجربة مشاركة ومكافآت تستحق انتظارك. لم يبدأ البرنامج بعد، ولن تظهر هنا روابط أو مكافآت قبل إطلاقه.</p>
    </section>
  </AppShell>;
}