import { expect, test } from "@playwright/test";

test("add to cart, change quantity, send an order request", async ({ page }) => {
  await page.goto("/products/ilam-orthodox-black-tea");
  await page.getByRole("radio", { name: /250 g/ }).check();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  const drawer = page.getByRole("dialog", { name: "Cart" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Ilam Orthodox Black Tea")).toBeVisible();
  await expect(drawer.locator("output")).toHaveText("2");
  await drawer.getByRole("button", { name: "Increase quantity" }).click();
  await expect(drawer.locator("output")).toHaveText("3");
  await drawer.getByRole("link", { name: "Request this order" }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Email").fill("buyer@example.com");
  await page.getByLabel("City").fill("Kathmandu");
  await page.getByRole("button", { name: "Send order request" }).click();
  await expect(page).toHaveURL(/\/orders\/HV-\d{4}-\d{4}/);
  await expect(page.getByText("Nothing has been charged")).toBeVisible();
  await expect(page.getByRole("link", { name: "HIM-26-ILM-00341" })).toBeVisible();
});

test("checkout validates required fields", async ({ page }) => {
  await page.goto("/products/timur-surkhet");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("dialog", { name: "Cart" }).getByRole("link", { name: "Request this order" }).click();
  await page.getByRole("button", { name: "Send order request" }).click();
  await expect(page.getByText("Please enter your name")).toBeVisible();
});

test("out-of-stock products cannot be added", async ({ page }) => {
  await page.goto("/products/buckwheat-flour-jumla");
  await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
});

test("order confirmation is private to the device that placed it", async ({ page }) => {
  await page.goto("/orders/HV-2610-1042");
  await expect(page.getByRole("heading", { name: "Order details are private." })).toBeVisible();
});

test("contact form", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Test Person");
  await page.getByLabel("Email").fill("person@example.com");
  await page.getByLabel("Message").fill("Hello, I would like to ask about wholesale orders.");
  await page.waitForTimeout(2600); // the form ignores submissions faster than a human could type
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: "Message sent." })).toBeVisible();
});
