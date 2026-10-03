import { expect, test } from "bun:test";

import { planTurn } from "../../src/lib/turn-plan";

test("الخطة الخفيفة لا تشغّل بحثاً أو أدوات", () => {
  const plan = planTurn("صباح الخير");
  expect(plan.intent).toBe("smalltalk");
  expect(plan.research.depth).toBe("none");
  expect(plan.reasoningEffort).toBe("low");
});

test("البحث العميق يرفع العمق والتفكير لكل موظف", () => {
  const plan = planTurn("اعمل دراسة شاملة وقارن المنافسين بالأرقام");
  expect(plan.intent).toBe("work");
  expect(plan.research.depth).toBe("deep");
  expect(plan.reasoningEffort).toBe("high");
  expect(plan.verifyOutput).toBe(true);
});

test("الإرسال الحقيقي يبقى خلف الاعتماد", () => {
  const plan = planTurn("ابعت البريد للعميل");
  expect(plan.risk).toBe("approval");
  expect(plan.successChecks.join(" ")).toContain("اعتماد المالك");
});