import { expect, type Page } from "@playwright/test";

export const ADMIN_CODE = process.env.E2E_ADMIN_CODE ?? "";
export const ADMIN_CODE_2 = process.env.E2E_ADMIN_CODE_2 ?? "";

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

export async function signIn(page: Page, code = ADMIN_CODE) {
  await page.goto("/owner");
  await page.getByLabel("Digit 1 of 4").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(1);
}
