import { expect, test } from "./fixtures";

test.describe("student site (signed out)", () => {
  test("today page shows the live menu with timings and actions", async ({ page, cspViolations }) => {
    void cspViolations;
    await page.goto("/");
    await expect(page.locator("#mainContainer")).toBeVisible();
    const rows = page.locator("#mainContainer tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Breakfast");
    await expect(page.locator(".meal-items").first()).not.toBeEmpty();
    await expect(page.getByRole("button", { name: "Rate" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Nust Mess Menu" })).toBeVisible();
    await expect(page.getByText("© 2025 Muhammad Fateh")).toBeVisible();
  });

  test("weekly page lists 7 days, today open, expand/collapse all", async ({ page, cspViolations }) => {
    void cspViolations;
    await page.goto("/weekly");
    await expect(page.locator(".day-card")).toHaveCount(7);
    await expect(page.locator(".day-card.is-today")).toHaveClass(/is-open/);
    await expect(page.getByText(/Week \d menu rotation/)).toBeVisible();
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(page.locator(".day-card.is-open")).toHaveCount(7);
    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(page.locator(".day-card.is-open")).toHaveCount(0);
    await expect(page.locator(".day-preview").first()).not.toBeEmpty();
  });

  test("reviews are readable anonymously; rating asks for sign-in", async ({ page, cspViolations }) => {
    void cspViolations;
    await page.goto("/daily");
    await page.locator(".reviews-btn").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Meal feedback")).toBeVisible();
    await expect(dialog.locator(".reviews-summary")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Rate" }).first().click();
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("navbar collapses on mobile and the toggler opens it", async ({ page, cspViolations }) => {
    void cspViolations;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const menu = page.locator("#navbarSupportedContent");
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole("link", { name: "This Week" })).toBeVisible();
  });
});

test("unknown URLs get the site's own 404 page", async ({ page, cspViolations }) => {
  void cspViolations;
  const res = await page.goto("/no/such/page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nust Mess Menu" })).toBeVisible();
});
