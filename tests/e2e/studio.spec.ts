import { expect, test } from "@playwright/test";
import { ADMIN_CODE, ADMIN_CODE_2, collectErrors, signIn } from "./helpers";

test.skip(!ADMIN_CODE, "Set E2E_ADMIN_CODE to run Studio tests");

test.describe.configure({ mode: "serial" });

const NAME = `E2E Test Honey ${Date.now().toString().slice(-6)}`;

test("session survives refresh and every Studio section loads", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  for (const s of ["Products", "Inventory", "Pricing", "Orders", "Farmers", "Collection", "Quality", "Traceability", "Website", "Media", "Users", "Settings", "Audit log"]) {
    await page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: new RegExp(`^${s}( \\d+)?$`) }).click();
    await expect(page.getByRole("heading", { level: 1, name: s })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("add a product, publish it, change its price everywhere", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/studio/products/new");
  await page.getByLabel("Product name").fill(NAME);
  await page.getByLabel("Size label").fill("250 g");
  await page.getByLabel("Base price (NPR)").fill("1400");
  await page.getByLabel("In stock").fill("12");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/studio\/products\/[0-9a-f-]{36}$/);

  // Draft is invisible to visitors
  const visitor = await browser.newContext({ timezoneId: "Asia/Kathmandu" });
  const v = await visitor.newPage();
  const slug = NAME.toLowerCase().replace(/\s+/g, "-");
  expect((await v.goto(`/products/${slug}`))?.status()).toBe(404);

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();

  await v.goto(`/products/${slug}`);
  await expect(v.locator("[data-price]").first()).toContainText("रू 1,400");
  await v.goto(`/market?q=${encodeURIComponent(NAME)}`);
  await expect(v.getByText("रू 1,400").first()).toBeVisible();

  // Change the price: saved as draft first (live page unchanged), then published
  await page.getByLabel("Base price (NPR)").fill("1550");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Unpublished changes saved")).toBeVisible();
  await v.goto(`/products/${slug}`);
  await expect(v.locator("[data-price]").first()).toContainText("रू 1,400");

  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.getByText(/Published/).first()).toBeVisible();
  await v.goto(`/products/${slug}`);
  await expect(v.locator("[data-price]").first()).toContainText("रू 1,550");
  await v.goto(`/market?q=${encodeURIComponent(NAME)}`);
  await expect(v.getByText("रू 1,550").first()).toBeVisible();

  // Cart reprices from the database
  await v.goto(`/products/${slug}`);
  await v.getByRole("button", { name: "Add to cart" }).click();
  await expect(v.getByRole("dialog", { name: "Cart" }).getByText("रू 1,550").first()).toBeVisible();
  await visitor.close();

  // Audit trail records who changed what
  await page.goto(`/studio/audit?q=${encodeURIComponent(NAME)}`);
  await expect(page.getByText(/250 g base price NPR 1,400 → NPR 1,550/).first()).toBeVisible();

  // Clean up
  await page.goBack();
  await page.goto("/studio/products?status=published");
  await page.getByRole("link", { name: NAME }).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page).toHaveURL(/\/studio\/products$/);
  await page.goto("/studio/products?status=archived");
  await page.getByRole("link", { name: NAME }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/status=archived/);
  await expect(page.getByRole("link", { name: NAME })).toHaveCount(0);
});

test("inline website editing is visible only to editors and saves through the server", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/studio/website");
  await page.getByRole("button", { name: "Edit website" }).first().click();
  await expect(page).toHaveURL("/");
  const title = page.locator('[data-edit-key="home.hero.title"]');
  await expect(title).toHaveAttribute("contenteditable", "plaintext-only");
  const original = (await title.innerText()).trim();
  await title.click();
  await page.keyboard.press("ControlOrMeta+a");
  const edited = `Every harvest, on the record ${Date.now().toString().slice(-5)}.`;
  await page.keyboard.type(edited);
  await expect(page.getByText("1 unsaved change")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved 1 change")).toBeVisible();

  const visitor = await browser.newContext({ timezoneId: "Asia/Kathmandu" });
  const v = await visitor.newPage();
  await v.goto("/");
  await expect(v.getByRole("heading", { level: 1 })).toHaveText(edited);
  await expect(v.locator("[data-edit-key]")).toHaveCount(0);
  await visitor.close();

  // restore
  await title.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(original);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved 1 change")).toBeVisible();
  expect(original).toBe("Every harvest, accounted for.");
  await page.getByRole("button", { name: "Done" }).click();
});

test("procurement rate changes need a second editor", async ({ browser }) => {
  test.skip(!ADMIN_CODE_2 || Boolean(process.env.E2E_LIVE), "Needs E2E_ADMIN_CODE_2; skipped on live deployments to avoid changing rates");
  const a = await (await browser.newContext()).newPage();
  await signIn(a, ADMIN_CODE);
  await a.goto("/studio/pricing");
  const pendingExists = await a.getByRole("heading", { name: "Waiting for approval" }).isVisible();
  if (!pendingExists) {
    await a.getByRole("button", { name: "Change" }).first().click();
    await a.getByLabel("New rate (NPR per kg)").fill("123");
    await a.getByRole("button", { name: "Send for approval" }).click();
  }
  await expect(a.getByRole("heading", { name: "Waiting for approval" })).toBeVisible();

  const b = await (await browser.newContext()).newPage();
  await signIn(b, ADMIN_CODE_2);
  await b.goto("/studio/pricing");
  b.on("dialog", (d) => d.accept());
  await b.getByRole("button", { name: "Approve" }).first().click();
  await expect(b.getByRole("status").getByText("Approved", { exact: true })).toBeVisible();
});

test("sign out ends the session", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/owner$/);
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/owner$/);
});
