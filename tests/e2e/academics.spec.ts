import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

/** Milestone D workflows: homework, marks entry, report cards, admissions and notices. */
test.describe.serial("Academics, admissions and notices", () => {
  test("teacher sets homework; the parent sees it on the child's page", async ({ page }) => {
    await login(page, "teacher.sps@demo.eduos.test");
    await page.goto("/app/homework");
    await page.getByLabel("Class", { exact: true }).selectOption({ label: "Class 6 - A" });
    await page.getByLabel("Title").fill("Map work: rivers of India");
    await page.getByLabel("Instructions").fill("Mark the five longest rivers on the outline map.");
    await page.getByRole("button", { name: "Set homework" }).click();
    await expect(page.getByText("Homework set.")).toBeVisible();
    await logout(page);

    await login(page, "parent@demo.eduos.test");
    await page.getByRole("link", { name: "Details for Aanya Sharma" }).click();
    await expect(page.getByText("Map work: rivers of India")).toBeVisible();
  });

  test("teacher enters and submits marks; principal cannot publish until every paper is in", async ({ page }) => {
    await login(page, "teacher.sps@demo.eduos.test");
    await page.goto("/app/exams");
    await page.getByRole("link", { name: /Half-Yearly/ }).click();
    await page.getByRole("link", { name: "Enter marks for Class 6 - A Mathematics" }).click();
    const inputs = page.getByLabel(/^Marks for /);
    await expect(page.getByRole("heading", { name: "Mathematics · Class 6 - A" })).toBeVisible();
    const n = await inputs.count();
    expect(n).toBeGreaterThan(20);
    await page.getByLabel("Aanya Sharma absent").check();
    for (let i = 0; i < n; i++) {
      const input = inputs.nth(i);
      if (await input.isEnabled()) await input.fill(String(40 + (i % 40)));
    }
    await inputs.first().fill("81");
    await expect(page.getByText("Marks cannot exceed 80")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit marks" })).toBeDisabled();
    await inputs.first().fill("72.5");
    await page.getByRole("button", { name: "Submit marks" }).click();
    await expect(page.getByText("Marks submitted.")).toBeVisible();
    await expect(page.getByText("These marks are submitted.")).toBeVisible();
    await logout(page);

    await login(page, "principal.sps@demo.eduos.test");
    await page.goto("/app/exams");
    await page.getByRole("link", { name: /Half-Yearly/ }).click();
    await expect(page.getByRole("button", { name: "Publish results" })).toBeDisabled();
    await expect(page.getByRole("row", { name: /Class 6 - A Mathematics/ }).getByText("Submitted")).toBeVisible();
  });

  test("parent opens a published report card; another parent cannot", async ({ page }) => {
    await login(page, "parent@demo.eduos.test");
    await page.getByRole("link", { name: "Details for Aanya Sharma" }).click();
    await expect(page.getByText("Half-Yearly")).toHaveCount(0); // not published
    await page.getByRole("link", { name: /Unit Test 1/ }).click();
    await expect(page.getByRole("heading", { name: "Unit Test 1 report card" })).toBeVisible();
    await expect(page.getByTestId("report-total")).toBeVisible();
    const url = page.url();
    await logout(page);

    await login(page, "parent2@demo.eduos.test");
    await page.goto(new URL(url).pathname);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("admissions officer logs an enquiry, moves it along and admits the child", async ({ page }) => {
    await login(page, "admissions.sps@demo.eduos.test");
    await page.goto("/app/admissions");
    await page.getByRole("link", { name: "New enquiry" }).click();
    await page.getByLabel("First name").fill("Rhea");
    await page.getByLabel("Last name").fill("Kapoor");
    await page.getByLabel("Class applying for").selectOption({ label: "Class 5" });
    await page.getByLabel("Guardian name").fill("Neha Kapoor");
    await page.getByLabel("Mobile number").fill("9811122233");
    await page.getByRole("button", { name: "Log enquiry" }).click();
    await expect(page.getByRole("heading", { name: "Rhea Kapoor" })).toBeVisible();

    await page.getByLabel("Move to").selectOption("APPLIED");
    await page.getByRole("button", { name: "Update stage" }).click();
    await expect(page.getByText("Stage updated.")).toBeVisible();

    await page.getByLabel("Admission number").fill("SPS-E2E-ENQ");
    await page.getByLabel("Section").selectOption({ label: "Class 5 - A" });
    await page.getByLabel("Date of birth").fill("2021-02-11");
    await page.getByRole("button", { name: "Admit student" }).click();
    await expect(page).toHaveURL(/\/app\/students\//);
    await expect(page.getByRole("heading", { name: "Rhea Kapoor" })).toBeVisible();
    await expect(page.getByText("Neha Kapoor")).toBeVisible();
  });

  test("principal sends a notice; parents see it; teachers cannot reach admissions", async ({ page }) => {
    await login(page, "principal.sps@demo.eduos.test");
    await page.goto("/app/notices");
    await page.getByLabel("Title").fill("Annual day rehearsal");
    await page.getByLabel("Message").fill("Rehearsals start Monday after school. Pick-up at 5 pm.");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Send notice" }).click();
    await expect(page.getByText(/^Sent\./)).toBeVisible();
    await logout(page);

    await login(page, "parent2@demo.eduos.test");
    await page.goto("/app/family/notices");
    await expect(page.getByRole("heading", { name: "Annual day rehearsal" })).toBeVisible();
    await logout(page);

    await login(page, "teacher.sps@demo.eduos.test");
    await expect(page.getByRole("link", { name: "Admissions" })).toHaveCount(0);
    await page.goto("/app/admissions");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });
});
