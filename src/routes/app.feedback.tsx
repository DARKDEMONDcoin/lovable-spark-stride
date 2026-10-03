import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareText, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/feedback")({
  head: () => ({ meta: [
    { title: "الملاحظات والآراء | سهل" },
    { name: "description", content: "شارك رأيك أو بلّغ فريق سهل عن مشكلة." },
    { property: "og:title", content: "الملاحظات والآراء | سهل" },
    { property: "og:description", content: "شارك رأيك أو بلّغ فريق سهل عن مشكلة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  return <AppShell title="الملاحظات والآراء">
    <section className="mx-auto max-w-2xl border-t border-border py-12">
      <MessageSquareText className="mb-5 size-9 text-primary" aria-hidden="true" />
      <h2 className="font-display text-2xl font-black">رأيك يهمنا</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">صفحة الملاحظات داخل التطبيق قيد الإعداد. إذا واجهت مشكلة أو عندك اقتراح الآن، تواصل معنا مباشرة.</p>
      <Link to="/contact" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">تواصل معنا <ArrowLeft className="size-4" /></Link>
    </section>
  </AppShell>;
}