import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleHelp, Mail } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/app/help")({
  head: () => ({ meta: [
    { title: "المساعدة والدعم | سهل" },
    { name: "description", content: "إجابات الأسئلة الشائعة والتواصل مع فريق دعم سهل." },
    { property: "og:title", content: "المساعدة والدعم | سهل" },
    { property: "og:description", content: "إجابات الأسئلة الشائعة والتواصل مع فريق دعم سهل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: HelpPage,
});

function HelpPage() {
  return <AppShell title="المساعدة والدعم">
    <section className="mx-auto max-w-2xl border-t border-border py-12">
      <h2 className="font-display text-2xl font-black">كيف نقدر نساعدك؟</h2>
      <div className="mt-8 divide-y divide-border border-y border-border">
        <Link to="/faq" className="flex items-center gap-4 py-5 hover:text-primary"><CircleHelp className="size-6 shrink-0" /><span className="min-w-0 flex-1 font-bold">الأسئلة الشائعة</span><ArrowLeft className="size-4" /></Link>
        <Link to="/contact" className="flex items-center gap-4 py-5 hover:text-primary"><Mail className="size-6 shrink-0" /><span className="min-w-0 flex-1 font-bold">تواصل مع الفريق</span><ArrowLeft className="size-4" /></Link>
      </div>
    </section>
  </AppShell>;
}