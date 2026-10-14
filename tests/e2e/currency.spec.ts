import { expect, test, type Page } from "@playwright/test";

const PRODUCT = "/products/turmeric-powder-kavre"; // 200 g = NPR 280
const LIVE = Boolean(process.env.E2E_LIVE);
const price = (page: Page) => page.locator("main [data-price]").first();

async function choose(page: Page, region: string) {
  await page.getByRole("button", { name: /Change currency/ }).first().click();
  await page.getByRole("dialog", { name: "Country and currency" }).getByText(region, { exact: true }).click();
}

test.describe("country & currency", () => {
  test("one NPR base price, shown as रू in Nepal", async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: "Asia/Kathmandu" });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    if (LIVE) await choose(page, "Nepal");
    await expect(price(page)).toContainText("रू 280");
    await ctx.close();
  });

  test("automatic detection picks a local currency", async ({ browser }) => {
    // Locally the edge header is simulated; on a live deployment the platform's real geolocation (or the time-zone fallback) is used.
    const ctx = await browser.newContext(LIVE ? { timezoneId: "America/New_York" } : { extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    await expect(price(page)).toContainText("≈ $2.00", { timeout: 15_000 });
    await ctx.close();
  });

  test("EU → EUR, UK → GBP, India → INR", async ({ browser }) => {
    for (const [country, region, symbol] of [["DE", "European Union", "€"], ["GB", "United Kingdom", "£"], ["IN", "India", "₹"]] as const) {
      const ctx = await browser.newContext(LIVE ? {} : { extraHTTPHeaders: { "x-vercel-ip-country": country } });
      const page = await ctx.newPage();
      await page.goto(PRODUCT);
      if (LIVE) await choose(page, region);
      await expect(price(page)).toContainText(symbol, { timeout: 15_000 });
      await ctx.close();
    }
  });

  test("regional price overrides conversion", async ({ browser }) => {
    const ctx = await browser.newContext(LIVE ? {} : { extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
    const page = await ctx.newPage();
    await page.goto("/products/large-cardamom-taplejung");
    if (LIVE) await choose(page, "United States");
    await expect(price(page)).toHaveText(/\$4\.50/, { timeout: 15_000 });
    await expect(price(page)).not.toContainText("≈");
    await expect(page.getByText("Price set in this currency")).toBeVisible();
    await ctx.close();
  });

  test("time zone is only a weak fallback", async ({ browser }) => {
    test.skip(LIVE, "A real geolocation header takes precedence on live deployments");
    const ctx = await browser.newContext({ timezoneId: "Asia/Tokyo", locale: "en-US" });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    await expect(price(page)).toContainText("¥", { timeout: 15_000 });
    await ctx.close();
  });

  test("manual choice overrides detection and persists", async ({ browser }) => {
    const ctx = await browser.newContext(LIVE ? { timezoneId: "America/New_York" } : { extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
    const page = await ctx.newPage();
    await page.goto(PRODUCT);
    await choose(page, "Australia");
    await expect(price(page)).toContainText("A$", { timeout: 15_000 });
    await page.reload();
    await expect(price(page)).toContainText("A$");
    expect(await page.evaluate(() => localStorage.getItem("himveda.currency"))).toBe("AUD");
    await page.getByRole("button", { name: /Change currency/ }).first().click();
    await page.getByRole("dialog", { name: "Country and currency" }).getByText("Automatic").click();
    await expect(price(page)).not.toContainText("A$", { timeout: 15_000 });
    await ctx.close();
  });
});
