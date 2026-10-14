import { expect, test } from "@playwright/test";

test("Studio is not reachable without a session", async ({ page }) => {
  await page.goto("/studio/products");
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByText("Authorized access", { exact: true })).toBeVisible();
});

test("a forged session cookie is rejected server-side", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "hv_session", value: "x".repeat(43), url: "http://localhost:3000" }]);
  const page = await ctx.newPage();
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/owner$/);
  await ctx.close();
});

test("wrong codes get a generic message, then the source is locked", async ({ browser }) => {
  // Isolated source address so this test's failures don't affect others.
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  const page = await ctx.newPage();
  await page.goto("/owner");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Digit 1 of 4").fill(String(9000 + i));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("That code wasn’t accepted.")).toBeVisible();
  }
  await page.getByLabel("Digit 1 of 4").fill("9999");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Too many attempts/)).toBeVisible();
  await ctx.close();
});

test("the access screen never reveals partial correctness", async ({ page }) => {
  await page.goto("/owner");
  await page.getByLabel("Digit 1 of 4").fill("2");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.locator("[role=status]")).toHaveText("");
});

test("client bundles contain no secrets", async ({ page, request }) => {
  const scripts: string[] = [];
  page.on("response", (r) => r.url().includes("/_next/static/") && r.url().endsWith(".js") && scripts.push(r.url()));
  await page.goto("/owner");
  await page.goto("/");
  const forbidden = [process.env.E2E_ADMIN_CODE, process.env.E2E_ADMIN_CODE_2, "ADMIN_CODE_PEPPER", "DATABASE_URL"].filter(Boolean) as string[];
  for (const url of [...new Set(scripts)]) {
    const body = await (await request.get(url)).text();
    for (const f of forbidden) {
      if (/^\d+$/.test(f)) expect(body.includes(`"${f}"`) || body.includes(`'${f}'`), `${url} contains a code literal`).toBe(false);
      else expect(body.includes(f), `${url} references ${f}`).toBe(false);
    }
  }
});
