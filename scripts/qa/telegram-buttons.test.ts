import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const files = [
  "src/lib/telegram-ui.server.ts",
  "src/lib/telegram-ui-extra.server.ts",
  "src/lib/telegram-connect.server.ts",
];

describe("أزرار بوت تيليجرام", () => {
  test("مفيش زر بيحوّل المستخدم لصفحات الموقع", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const offenders = [...src.matchAll(/url:\s*`\$\{publicOrigin\(\)\}[^`]*`/g)].map((m) => m[0]);
      expect(offenders).toEqual([]);
    }
  });

  test("كل زر جديد عنده معالج في موجّه الأزرار", () => {
    const ui = readFileSync("src/lib/telegram-ui.server.ts", "utf8");
    const extra = readFileSync("src/lib/telegram-ui-extra.server.ts", "utf8");
    for (const op of ["tw", "twg", "twn", "stz"]) expect(ui).toContain(`case "${op}"`);
    for (const op of ["zct", "zcs"]) expect(extra).toContain(`case "${op}"`);
  });

  test("الربط اليدوي يجمع بيانات ووردبريس داخل المحادثة", async () => {
    const { MANUAL_PROVIDERS } = await import("../../src/lib/telegram-connect.server");
    expect(MANUAL_PROVIDERS["wordpress"]?.fields.map((f) => f.key)).toEqual(["siteUrl", "username", "appPassword"]);
  });
});
