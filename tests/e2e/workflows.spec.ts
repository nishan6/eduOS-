import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

/**
 * Vertical-slice workflows against a fresh seeded database. Order matters: later steps
 * observe the effects of earlier ones, exactly as the users would.
 */
test.describe.serial("EduOS first vertical slice", () => {
  test("owner configures a new school and can switch into it", async ({ page }) => {
    await login(page, "owner@demo.eduos.test");
    await expect(page.getByRole("heading", { name: "Group overview" })).toBeVisible();
    await page.goto("/app/settings/school");
    const form = page.locator("form", { has: page.getByRole("button", { name: "Create school" }) });
    await form.getByLabel("School name").fill("Sunrise Junior (E2E)");
    await form.getByLabel("Code").fill("SJE");
    await form.getByRole("button", { name: "Create school" }).click();
    await expect(page.getByText("School created.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Current school" }).locator("option", { hasText: "Sunrise Junior (E2E)" })).toHaveCount(1);
  });

  test("admissions officer creates a student, links a guardian and invites them; guardian activates and sees only that child", async ({ page }) => {
    await login(page, "admissions.sps@demo.eduos.test");
    await page.goto("/app/students/new");
    await page.getByLabel("Admission number").fill("SPS-E2E-1");
    await page.getByLabel("Class and section").selectOption({ label: "Class 5 - A (2026-27)" });
    await page.getByLabel("First name").fill("Esha");
    await page.getByLabel("Last name").fill("Testcase");
    await page.getByLabel("Date of birth").fill("2016-05-20");
    await page.getByLabel("Guardian name").fill("Mira Testcase");
    await page.getByLabel("Relation").selectOption("MOTHER");
    await page.getByLabel("Mobile number").fill("9811100001");
    await page.getByRole("button", { name: "Create student" }).click();
    await expect(page.getByRole("heading", { name: "Esha Testcase" })).toBeVisible();
    await expect(page.getByText("Mira Testcase")).toBeVisible();

    await page.getByLabel("Guardian email for login").fill("mira@example.test");
    await page.getByRole("button", { name: "Invite to app" }).click();
    const link = await page.getByTestId("activation-url").textContent();
    expect(link).toContain("/activate?token=");
    await logout(page);

    await page.goto(new URL(link!).pathname + new URL(link!).search);
    await page.getByLabel("Password", { exact: true }).fill("mira-strong-pass-1");
    await page.getByLabel("Confirm password").fill("mira-strong-pass-1");
    await page.getByRole("button", { name: "Activate account" }).click();
    await expect(page).toHaveURL(/\/login/);
    await login(page, "mira@example.test", "mira-strong-pass-1");
    await expect(page).toHaveURL(/\/app\/family/);
    await expect(page.getByRole("heading", { name: "Esha Testcase" })).toBeVisible();
    await expect(page.getByText("Aanya Sharma")).toHaveCount(0);
  });

  test("teacher marks attendance; parent sees the result", async ({ page }) => {
    await login(page, "teacher.sps@demo.eduos.test");
    await expect(page.getByRole("heading", { name: "My classes" })).toBeVisible();
    await page.getByRole("link", { name: /Class 6 - A/ }).click();
    await page.getByRole("radiogroup", { name: "Attendance for Aanya Sharma" }).getByRole("radio", { name: "Absent" }).click();
    await page.getByRole("button", { name: "Mark rest present" }).click();
    await page.getByRole("button", { name: "Submit attendance" }).click();
    await expect(page.getByText("Attendance submitted.")).toBeVisible();
    await expect(page.getByText("This attendance is final")).toBeVisible();
    await logout(page);

    await login(page, "parent@demo.eduos.test");
    await expect(page.getByText("Aanya is marked absent today.", { exact: true })).toBeVisible();
    await expect(page.getByText("Aanya is marked absent today at Sunrise Public School (Demo).")).toBeVisible();
    await page.goto("/app/notifications");
    await expect(page.getByText("Aanya was marked absent")).toBeVisible();
  });

  test("teacher requests a correction and the principal approves it", async ({ page }) => {
    await login(page, "teacher.sps@demo.eduos.test");
    await page.getByRole("link", { name: /Class 6 - A/ }).click();
    const row = page.locator("li", { hasText: "Aanya Sharma" });
    await row.getByRole("button", { name: "Request correction" }).click();
    await row.getByLabel("Correct to").selectOption("PRESENT");
    await row.getByLabel("Reason").fill("Arrived late with a note from parent");
    await row.getByRole("button", { name: "Send" }).click();
    await expect(row.getByText("Correction to present pending")).toBeVisible();
    await logout(page);

    await login(page, "principal.sps@demo.eduos.test");
    await expect(page.getByRole("heading", { name: "School overview" })).toBeVisible();
    const item = page.locator("li", { hasText: "Aanya Sharma" }).filter({ has: page.getByRole("button", { name: "Approve" }) });
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Nothing to approve")).toBeVisible();
    await logout(page);

    await login(page, "parent@demo.eduos.test");
    await expect(page.getByText("Aanya is marked present today.")).toBeVisible();
  });

  test("cashier records a payment and issues a receipt; parent sees the new balance", async ({ page }) => {
    await login(page, "parent@demo.eduos.test");
    const card = page.locator("div.rounded-card", { hasText: "Aanya Sharma" }).first();
    const before = await card.getByText(/^₹[\d,]+\.\d{2}$/).first().textContent();
    await logout(page);

    await login(page, "cashier.sps@demo.eduos.test");
    await expect(page).toHaveURL(/\/app\/fees/);
    await page.getByLabel("Search students with dues").fill("Aanya");
    await page.getByLabel("Search students with dues").press("Enter");
    await page.getByRole("link", { name: "Aanya Sharma" }).click();
    await page.getByLabel("Amount (₹)").fill("1000");
    await page.getByLabel("Mode").selectOption("UPI");
    await page.getByLabel("Transaction reference (UTR)").fill("UTR998877");
    await page.getByRole("button", { name: "Record payment & issue receipt" }).click();
    await page.getByRole("link", { name: /View receipt RCT-SPS-/ }).click();
    await expect(page.getByTestId("receipt-total")).toHaveText("₹1,000.00");
    await expect(page.getByText("Bank verification: unverified.")).toBeVisible();
    await logout(page);

    await login(page, "parent@demo.eduos.test");
    const after = await page.locator("div.rounded-card", { hasText: "Aanya Sharma" }).first().getByText(/^₹[\d,]+\.\d{2}$/).first().textContent();
    const toPaise = (s: string | null) => Math.round(Number(s!.replace(/[₹,]/g, "")) * 100);
    expect(toPaise(before) - toPaise(after)).toBe(100_000);
  });

  test("unauthorized access is denied: teacher → ledger, cross-school and cross-family URLs", async ({ page }) => {
    await login(page, "teacher.sps@demo.eduos.test");
    await expect(page.getByRole("link", { name: "Ledger" })).toHaveCount(0);
    await page.goto("/app/finance");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await page.goto("/app/fees");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await logout(page);

    // Find an SVL student id as the SVL principal, then try it as the SPS principal.
    await login(page, "principal.svl@demo.eduos.test");
    await page.goto("/app/students");
    const href = await page.locator("table a").first().getAttribute("href");
    expect(href).toMatch(/^\/app\/students\//);
    await logout(page);
    await login(page, "principal.sps@demo.eduos.test");
    await page.goto(href!);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await logout(page);

    // Parent 2 cannot open Parent 1's child.
    await login(page, "parent2@demo.eduos.test");
    await page.goto(href!.replace("/app/students/", "/app/family/children/"));
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("@mobile parent home works on a phone", async ({ page }) => {
    await login(page, "parent@demo.eduos.test");
    await expect(page.getByRole("heading", { name: "Aanya Sharma" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "My children" })).toBeVisible();
  });
});
