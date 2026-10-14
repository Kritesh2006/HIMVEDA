import { describe, expect, it } from "vitest";
import { validateContent } from "@/server/content/validate";
import { CONTENT } from "@/server/content/registry";

describe("content validation", () => {
  it("rejects keys that are not in the registry", () => expect(validateContent("home.evil", "x").ok).toBe(false));
  it("trims and collapses whitespace in single-line text", () => {
    const r = validateContent("home.hero.title", "  Every   harvest\n counted. ");
    expect(r.ok && r.value).toBe("Every harvest counted.");
  });
  it("enforces length limits", () => expect(validateContent("home.hero.title", "x".repeat(500)).ok).toBe(false));
  it("refuses script links", () => {
    expect(validateContent("home.hero.primary", { label: "Go", href: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateContent("home.hero.primary", { label: "Go", href: "/market" }).ok).toBe(true);
  });
  it("validates structured lists", () => {
    expect(validateContent("faq.items", [{ q: "Q?", a: "A." }]).ok).toBe(true);
    expect(validateContent("faq.items", [{ q: "", a: "A." }]).ok).toBe(false);
    expect(validateContent("home.chain.steps", []).ok).toBe(false);
  });
  it("ships no invented business facts in defaults", () => {
    expect(CONTENT["contact.email"].default).toBe("");
    expect(CONTENT["contact.phone"].default).toBe("");
    expect(CONTENT["owner.bio"].default).toBe("");
    expect(CONTENT["owner.name"].default).toBe("Madhav Dhungel");
    const all = JSON.stringify(Object.values(CONTENT).map((d) => d.default));
    for (const banned of ["Aarati", "Rohan Mehta", "Elena Voss", "1,200+", "ritualist", "certified organic", "COA"]) {
      expect(all.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});
