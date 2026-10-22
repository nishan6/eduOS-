import { expect, type Page } from "@playwright/test";

export const PASSWORD = "EduOS-demo-2026!";

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\//);
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}
