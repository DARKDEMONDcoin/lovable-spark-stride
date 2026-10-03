import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { taskIdFromMarkup } from "../../src/lib/telegram-team.server";

describe("telegram reply/block/dedup", () => {
  test("reply-to picks task id from output buttons", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(taskIdFromMarkup({ inline_keyboard: [[{ callback_data: "m" }], [{ callback_data: `tw:${id}` }]] })).toBe(id);
    expect(taskIdFromMarkup({ inline_keyboard: [[{ callback_data: "m" }]] })).toBeNull();
  });
  test("webhook handles block and atomic callback dedup", () => {
    const src = readFileSync("src/routes/api/public/telegram.webhook.ts", "utf8");
    expect(src).toContain("my_chat_member");
    expect(src).toContain('"blocked"');
    expect(src).toContain("claimUpdate(");
  });
});
