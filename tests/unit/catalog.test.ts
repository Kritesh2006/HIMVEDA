import { describe, expect, it } from "vitest";
import { productInput } from "@/server/catalog/input";
import { describeChanges } from "@/server/catalog/diff";
import { slugify } from "@/lib/slug";

const minimal = { name: "Large Cardamom", slug: "large-cardamom", variants: [{ label: "100 g", sku: "CAR-100", basePriceNpr: 1400, stock: 10 }] };

describe("product input", () => {
  it("accepts a minimal product: name, one size, one price", () => {
    const p = productInput.parse(minimal);
    expect(p.variants[0]!.basePriceNpr).toBe(1400);
    expect(p.verificationStatus).toBe("unverified");
    expect(p.district).toBeNull();
  });
  it("requires at least one priced size", () => expect(productInput.safeParse({ ...minimal, variants: [] }).success).toBe(false));
  it("rejects zero or negative prices", () => {
    expect(productInput.safeParse({ ...minimal, variants: [{ ...minimal.variants[0], basePriceNpr: 0 }] }).success).toBe(false);
  });
  it("rejects duplicate SKUs and duplicate regional currencies", () => {
    expect(productInput.safeParse({ ...minimal, variants: [minimal.variants[0], { ...minimal.variants[0], label: "200 g" }] }).success).toBe(false);
    const dupCur = { ...minimal.variants[0], regionalPrices: [{ currency: "USD", amount: 10 }, { currency: "USD", amount: 11 }] };
    expect(productInput.safeParse({ ...minimal, variants: [dupCur] }).success).toBe(false);
  });
  it("does not allow NPR as a regional override (NPR is the base)", () => {
    const v = { ...minimal.variants[0], regionalPrices: [{ currency: "NPR", amount: 10 }] };
    expect(productInput.safeParse({ ...minimal, variants: [v] }).success).toBe(false);
  });
  it("validates slugs", () => expect(productInput.safeParse({ ...minimal, slug: "Bad Slug" }).success).toBe(false));
});

describe("audit descriptions", () => {
  it("describes a base price change in NPR", () => {
    const before = productInput.parse(minimal);
    const after = productInput.parse({ ...minimal, variants: [{ ...minimal.variants[0], basePriceNpr: 1550 }] });
    expect(describeChanges(before, after)).toContain("100 g base price NPR 1,400 → NPR 1,550");
  });
  it("describes stock, name and new sizes", () => {
    const before = productInput.parse(minimal);
    const after = productInput.parse({
      ...minimal,
      name: "Black Cardamom",
      variants: [{ ...minimal.variants[0], stock: 4 }, { label: "250 g", sku: "CAR-250", basePriceNpr: 3200, stock: 2 }],
    });
    const c = describeChanges(before, after);
    expect(c).toContain("name: “Large Cardamom” → “Black Cardamom”");
    expect(c).toContain("100 g stock 10 → 4");
    expect(c.some((x) => x.startsWith("added variant 250 g"))).toBe(true);
  });
});

describe("slugify", () => {
  it("normalises names", () => expect(slugify("Chamomile & Lavender — Sleep Tea")).toBe("chamomile-and-lavender-sleep-tea"));
});
