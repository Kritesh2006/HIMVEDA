import { expect, test } from "@playwright/test";
import { collectErrors, noHorizontalOverflow } from "./helpers";

const ROUTES = ["/", "/market", "/products/large-cardamom-taplejung", "/trace", "/trace/HIM-26-KTM-00482", "/producers", "/company", "/contact", "/faq", "/legal/privacy", "/checkout"];

test.describe("public site", () => {
  for (const route of ROUTES) {
    test(`renders ${route} without errors`, async ({ page }) => {
      const errors = collectErrors(page);
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("unknown pages return 404", async ({ page }) => {
    expect((await page.goto("/does-not-exist"))?.status()).toBe(404);
    expect((await page.goto("/products/does-not-exist"))?.status()).toBe(404);
  });

  test("canonical tags are correct and never point at the old staging domain", async ({ page, request }) => {
    // What crawlers receive: exactly one canonical per page.
    for (const path of ["/", "/market", "/products/large-cardamom-taplejung", "/trace/HIM-26-TPJ-00217"]) {
      const html = await (await request.get(path)).text();
      expect(html).not.toContain("theripplebytes");
      const canon = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
      expect(canon, path).toHaveLength(1);
      expect(new URL(canon[0]!).pathname).toBe(path);
    }
    // After hydration any canonical tags present must agree.
    await page.goto("/market");
    const hrefs = await page.locator('link[rel="canonical"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
    expect(hrefs).toHaveLength(1);
  });

  test("no fake review or rating schema is published", async ({ page }) => {
    await page.goto("/products/large-cardamom-taplejung");
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const all = ld.join(" ");
    expect(all).toContain('"@type":"Product"');
    expect(all).not.toMatch(/aggregateRating|"Review"/);
  });

  test("sitemap and robots", async ({ request }) => {
    const sm = await request.get("/sitemap.xml");
    expect(sm.ok()).toBeTruthy();
    expect(await sm.text()).toContain("/products/");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /studio");
  });

  for (const width of [375, 390, 430, 768, 1024, 1440, 1920]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/market", "/products/turmeric-powder-kavre", "/trace/HIM-26-TPJ-00217", "/checkout"]) {
        await page.goto(route);
        await noHorizontalOverflow(page);
      }
    });
  }

  test("mobile menu opens as a dialog and closes on navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name: "Market" }).click();
    await expect(page).toHaveURL(/\/market/);
    await expect(dialog).toBeHidden();
  });

  test("market search, filter and empty state", async ({ page }) => {
    await page.goto("/market");
    await page.getByPlaceholder("Search by product, district or batch code").fill("cardamom");
    await expect(page).toHaveURL(/q=cardamom/);
    await expect(page.getByRole("heading", { name: "Large Cardamom" })).toBeVisible();
    await page.goto("/market?q=zzzz");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
    await page.goto("/market?avail=in");
    await expect(page.getByRole("heading", { name: "Buckwheat Flour (Phapar)" })).toHaveCount(0);
  });
});

test.describe("traceability", () => {
  test("shows the journey and keeps private data private", async ({ page }) => {
    await page.goto("/trace/HIM-26-TPJ-00217");
    await expect(page.getByRole("heading", { name: "HIM-26-TPJ-00217" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
    const text = await page.locator("main").innerText();
    for (const privateValue of ["Bishnu Limbu", "Maya Subba", "FMR-0001", "1,450"]) expect(text).not.toContain(privateValue);
    await expect(page.getByText("No laboratory certificate is on file")).toBeVisible();
  });

  test("lookup normalises codes and explains bad input", async ({ page }) => {
    await page.goto("/trace");
    await page.getByRole("textbox", { name: "Batch code" }).fill("him 26 ktm 482");
    await page.getByRole("button", { name: "Trace" }).click();
    await expect(page).toHaveURL(/\/trace\/HIM-26-KTM-00482$/);
    await page.goto("/trace/NOT-A-CODE");
    await expect(page.getByRole("heading", { name: /doesn’t look like a batch code/ })).toBeVisible();
  });
});
