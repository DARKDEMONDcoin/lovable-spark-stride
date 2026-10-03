import { describe, expect, test } from "bun:test";
import { fallbackRecommendation } from "../../src/lib/welcome-recommendation-fallback";
import { purposeCopy, purposeMembers } from "../../src/lib/welcome-purpose";

describe("purpose-led introduction", () => {
  test("each purpose changes website, sector, team, and finish copy", () => {
    for (const purpose of ["business", "job", "personal"] as const) {
      expect(purposeCopy[purpose].website).toBeTruthy();
      expect(purposeCopy[purpose].industry).toBeTruthy();
      expect(purposeCopy[purpose].finish).toBeTruthy();
      for (const id of ["sonny", "eva", "sam", "nour", "dana", "adam"]) {
        expect(purposeMembers[purpose][id]?.tasks).toHaveLength(3);
        expect(purposeMembers[purpose][id]?.example).toBeTruthy();
      }
    }
    expect(purposeMembers.business.sam.headline).not.toBe(purposeMembers.personal.sam.headline);
  });

  test("fallback advice does not sell to employees or personal explorers", () => {
    const base = { industry: "المطاعم والمقاهي" };
    const job = fallbackRecommendation({ ...base, purpose: "job" });
    const personal = fallbackRecommendation({ ...base, purpose: "personal" });
    const business = fallbackRecommendation({ ...base, purpose: "business" });
    expect(job.actions.map((a) => a.employee)).toEqual(["أمَل", "نور", "دانة"]);
    expect(personal.actions.map((a) => a.employee)).toEqual(["نور", "أمَل", "دانة"]);
    expect(business.actions.map((a) => a.employee)).toEqual(["سِراج", "نور", "سالم"]);
    expect(personal.insight).toContain("لا تحتاج موقعًا أو مشروعًا");
  });
});