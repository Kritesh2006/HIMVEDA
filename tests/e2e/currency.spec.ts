import { expect, test } from "@playwright/test";

const PRODUCT = "/products/turmeric-powder-kavre"; // 200 g = NPR 280

test.describe("country & currency", () => {
  test("defaults to NPR with no location signal", async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: "UTC" });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    await expect(page.locator("[data-price]").first()).toContainText("रू 280");
    await ctx.close();
  });

  test("uses edge geolocation: US → USD", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    await expect(page.locator("[data-price]").first()).toContainText("≈ $2.00");
    await ctx.close();
  });

  test("EU country → EUR, UK → GBP, India → INR", async ({ browser }) => {
    for (const [country, symbol] of [["DE", "€"], ["GB", "£"], ["IN", "₹"]] as const) {
      const ctx = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": country } });
      const page = await ctx.newPage();
      await page.goto(PRODUCT);
      await expect(page.locator("[data-price]").first()).toContainText(symbol);
      await ctx.close();
    }
  });

  test("regional price overrides conversion", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
    const page = await ctx.newPage();
    await page.goto("/products/large-cardamom-taplejung");
    await expect(page.locator("[data-price]").first()).toHaveText(/\$4\.50/);
    await expect(page.locator("[data-price]").first()).not.toContainText("≈");
    await expect(page.getByText("Price set in this currency")).toBeVisible();
    await ctx.close();
  });

  test("time zone is only a weak fallback", async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: "Asia/Tokyo", locale: "en-US" });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    await expect(page.locator("[data-price]").first()).toContainText("¥", { timeout: 15_000 });
    await ctx.close();
  });

  test("manual choice overrides detection and persists", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    await page.getByRole("button", { name: /Change currency/ }).first().click();
    await page.getByRole("dialog", { name: "Country and currency" }).getByText("Australia").click();
    await expect(page.locator("[data-price]").first()).toContainText("A$", { timeout: 15_000 });
    await page.reload();
    await expect(page.locator("[data-price]").first()).toContainText("A$");
    expect(await page.evaluate(() => localStorage.getItem("himveda.currency"))).toBe("AUD");
    await page.getByRole("button", { name: /Change currency/ }).first().click();
    await page.getByRole("dialog", { name: "Country and currency" }).getByText("Automatic").click();
    await expect(page.locator("[data-price]").first()).toContainText("$2.00", { timeout: 15_000 });
    await ctx.close();
  });
});
