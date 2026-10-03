import { describe, expect, test } from "bun:test";
import { brandOptedOut } from "../../src/lib/brand-relevance";
import { stripLeakedImagePrompt } from "../../src/lib/post-format";
import { isPublishPrevious } from "../../src/lib/telegram-publish.server";

describe("context + optional brand", () => {
  test("opt-out persists across later turns until opt-in", () => {
    const hist = ["طب صحيح انا عايز انشرة علي الفيسبوك", "انسي megsy انا بتكلم عن الحب فقط، اعمل منشور عن الحب"];
    expect(brandOptedOut(hist, "Megsy AI")).toBe(true);
    expect(brandOptedOut(["ارجع للعلامة واعمل بوست", ...hist], "Megsy AI")).toBe(false);
    expect(brandOptedOut(["اكتب بوست عن الحب"], "Megsy AI")).toBe(false);
  });
  test("publish-previous intent", () => {
    expect(isPublishPrevious("طب صحيح انا عايز انشرة علي الفيسبوك")).toBe(true);
    expect(isPublishPrevious("يعم منشور الحب اللي انت عملتة عايز انشرة علي فيسبوك")).toBe(true);
    expect(isPublishPrevious("اكتب منشور جديد عن العيد")).toBe(false);
  });
  test("leaked English image prompt removed from Arabic post", () => {
    const body = `#حب #مشاعر\nهل جربت شعور الأمان الحقيقي مع من تحب؟\n"A warm, cinematic close-up photograph of two people holding hands tightly, soft golden hour sunlight."\nشاركنا بتجربتك في التعليقات.`;
    const out = stripLeakedImagePrompt(body);
    expect(out).not.toContain("cinematic");
    expect(out).toContain("شاركنا");
  });
});
