import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

/** Timetable, calendar and helpdesk. */
test.describe.serial("Timetable, calendar and helpdesk", () => {
  test("principal edits a class timetable and is stopped from double-booking a teacher", async ({ page }) => {
    await login(page, "principal.sps@demo.eduos.test");
    await page.goto("/app/timetable");
    await page.getByLabel("Class", { exact: true }).selectOption({ label: "Class 6 - A" });
    await page.getByRole("button", { name: "Show" }).click();
    await page.getByRole("button", { name: "Edit Sat Period 5" }).click();
    await page.getByLabel("Subject for Sat Period 5").selectOption({ label: "English" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit Sat Period 5" })).toContainText("English");

    await page.getByLabel("Class", { exact: true }).selectOption({ label: "Class 6 - B" });
    await page.getByRole("button", { name: "Show" }).click();
    await page.getByRole("button", { name: "Edit Mon Period 1" }).click();
    await page.getByLabel("Teacher for Mon Period 1").selectOption({ label: "Demo Teacher Lakshmi" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("That teacher already has Class 6 - A on Monday, Period 1.")).toBeVisible();
    await logout(page);

    await login(page, "teacher.sps@demo.eduos.test");
    await page.goto("/app/timetable");
    await expect(page.getByRole("heading", { name: "My week" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  });

  test("principal adds a holiday; parents see it, staff-only events stay hidden", async ({ page }) => {
    await login(page, "principal.sps@demo.eduos.test");
    await page.goto("/app/calendar");
    await page.getByLabel("Title").fill("Founders' Day holiday");
    await page.getByLabel("Type").selectOption("HOLIDAY");
    await page.getByRole("button", { name: "Add to calendar" }).click();
    await expect(page.getByText("Added to the calendar.")).toBeVisible();
    await expect(page.getByText("Founders' Day holiday")).toBeVisible();
    await logout(page);

    await login(page, "parent2@demo.eduos.test");
    await page.goto("/app/family/calendar");
    await expect(page.getByText("Founders' Day holiday")).toBeVisible();
    await expect(page.getByText("Staff training: new report cards")).toHaveCount(0);
  });

  test("parent raises a request; helpdesk replies; the parent sees the reply but not internal notes", async ({ page }) => {
    await login(page, "parent2@demo.eduos.test");
    await page.goto("/app/support");
    await page.getByLabel("Topic").selectOption("FEES");
    await page.getByLabel("Subject").fill("Need fee receipt copy");
    await page.getByLabel("Details").fill("Please send a copy of the term 1 receipt for Kabir.");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByRole("heading", { name: "Need fee receipt copy" })).toBeVisible();
    const url = new URL(page.url()).pathname;
    await logout(page);

    await login(page, "helpdesk.sps@demo.eduos.test");
    await page.goto("/app/helpdesk");
    await page.getByRole("link", { name: "Need fee receipt copy" }).click();
    await page.getByLabel("Reply").fill("Asked accounts to re-issue it.");
    await page.getByLabel("Internal note (staff only)").check();
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Internal note", { exact: true })).toBeVisible();
    await page.getByLabel("Reply").fill("A copy of the receipt will be emailed to you today.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("A copy of the receipt will be emailed to you today.")).toBeVisible();
    await page.getByLabel("Status").selectOption("RESOLVED");
    await expect(page.getByText("Ticket updated.")).toBeVisible();
    await logout(page);

    await login(page, "parent2@demo.eduos.test");
    await page.goto(url);
    await expect(page.getByText("A copy of the receipt will be emailed to you today.")).toBeVisible();
    await expect(page.getByText("Asked accounts to re-issue it.")).toHaveCount(0);
    await expect(page.getByText("Resolved")).toBeVisible();
    await logout(page);

    // Another parent cannot open it.
    await login(page, "parent@demo.eduos.test");
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });
});
