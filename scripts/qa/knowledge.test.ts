import { describe, expect, test } from "bun:test";
import { chunkText } from "../../src/lib/knowledge.server";
import { rankPosts } from "../../src/lib/performance-loop.server";

describe("smart memory chunking", () => {
  test("keeps all text with overlap and bounded size", () => {
    const text = Array.from({ length: 60 }, (_, i) => `فقرة رقم ${i} تشرح سياسة الاسترجاع بالتفصيل.`).join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1400)).toBe(true);
    expect(chunks.join(" ")).toContain("فقرة رقم 59");
  });
  test("empty input yields nothing", () => expect(chunkText("   ")).toEqual([]));
});

describe("performance loop", () => {
  test("needs enough measured posts", () => {
    expect(rankPosts([{ body: "a", provider: "instagram", metrics: { engagement: 3 } }])).toBeNull();
  });
  test("ranks best and worst", () => {
    const rows = [5, 90, 12, 40, 1].map((e, i) => ({ body: `p${i}`, provider: "facebook", metrics: { engagement: e } }));
    const r = rankPosts(rows)!;
    expect(r.best[0]!.score).toBe(90);
    expect(r.worst[0]!.score).toBe(1);
  });
});
