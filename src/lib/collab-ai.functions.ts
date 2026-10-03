import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES: Record<string, string> = {
  sonny: "سِراج، مدير السوشيال ميديا: يكتب منشورات وتقاويم محتوى جاهزة للنشر.",
  eva: "أمَل، مساعدة تنفيذية: تنظم المتابعات والرسائل والاجتماعات والخطط التشغيلية.",
  sam: "سالم، مسؤول المبيعات والبحث: يحلل السوق والمنافسين ويكتب عروض البيع.",
  nour: "نور، أخصائية المحتوى وتحسين محركات البحث: تكتب مقالات وخطط محتوى SEO.",
  dana: "دانة، المصممة: تكتب مفاهيم تصميم وبريفات بصرية دقيقة بالمقاسات.",
  adam: "آدم، محلل البيانات والإعلانات: يكتب تقارير تحليلية وتوصيات قابلة للقياس.",
};

/** ينفّذ موظف رقمي مهمة من مهام مشروع الفريق ويحفظ نتيجتها داخل المهمة نفسها. */
export const runCollabTaskWithEmployee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: task, error } = await context.supabase.from("collaboration_tasks").select("*").eq("id", data.taskId).maybeSingle();
    if (error || !task) throw new Error("المهمة غير متاحة لك.");
    const employee = task.ai_employee_id;
    if (!employee || !ROLES[employee]) throw new Error("أسند المهمة إلى موظف رقمي أولاً.");
    if (task.ai_status === "running") throw new Error("الموظف يعمل على المهمة بالفعل.");
    const [{ data: project }, { data: workspace }] = await Promise.all([
      context.supabase.from("collaboration_projects").select("name, description").eq("id", task.project_id).maybeSingle(),
      context.supabase.from("workspaces").select("name, industry, tone, banned_words, use_website_context, website").eq("id", task.workspace_id).maybeSingle(),
    ]);
    await context.supabase.from("collaboration_tasks").update({ ai_status: "running" }).eq("id", task.id);
    try {
      const { callLovableRewrite } = await import("./post-improve.server");
      const brand = workspace ? [
        `النشاط: ${workspace.name} — المجال: ${workspace.industry}`,
        workspace.tone ? `نبرة العلامة: ${workspace.tone}` : "",
        workspace.banned_words?.length ? `كلمات ممنوعة: ${workspace.banned_words.join("، ")}` : "",
        workspace.use_website_context && workspace.website ? `موقع النشاط: ${workspace.website}` : "",
      ].filter(Boolean).join("\n") : "";
      const output = await callLovableRewrite([
        { role: "system", content: `أنت ${ROLES[employee]} تعمل ضمن فريق بشري في مساحة عمل مشتركة. سلّم مخرجاً نهائياً جاهزاً للاستخدام بالعربية، منظماً بعناوين ونقاط قصيرة، دون مقدمات أو أسئلة. لا تختلق أرقاماً أو حقائق غير معروفة؛ ضع [يُستكمل] مكان أي معلومة ناقصة. حد أقصى ٧٠٠ كلمة.` },
        { role: "user", content: [brand, project ? `المشروع: ${project.name}${project.description ? ` — ${project.description}` : ""}` : "", `المهمة: ${task.title}`, task.details ? `تفاصيل: ${task.details}` : "", task.notes ? `ملاحظات الفريق: ${task.notes}` : "", task.due_date ? `موعد التسليم: ${task.due_date}` : ""].filter(Boolean).join("\n") },
      ]);
      const { error: saveError } = await context.supabase.from("collaboration_tasks").update({ ai_output: output, ai_status: "done", status: task.status === "todo" ? "in_progress" : task.status }).eq("id", task.id);
      if (saveError) throw new Error("تعذّر حفظ نتيجة الموظف.");
      return { output };
    } catch (cause) {
      await context.supabase.from("collaboration_tasks").update({ ai_status: "failed" }).eq("id", task.id);
      throw cause instanceof Error ? cause : new Error("تعذّر تنفيذ المهمة الآن.");
    }
  });
