import { ADMIN, adminLogin, expect, test } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("unauthenticated visits are redirected to sign-in", async ({ page, cspViolations }) => {
  void cspViolations;
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("wrong password shows an error and clears the field", async ({ page, cspViolations }) => {
  void cspViolations;
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password", { exact: true }).fill("nope-nope");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-testid=login-error]")).toContainText("Incorrect username or password");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});

test("session cookie is HttpOnly and invisible to scripts", async ({ page, context, cspViolations }) => {
  void cspViolations;
  await adminLogin(page);
  const cookie = (await context.cookies()).find((c) => c.name.includes("mess_admin"))!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect(await page.evaluate(() => document.cookie)).not.toContain("mess_admin");
});

test("board shows both weeks and switching asks for confirmation", async ({ page, cspViolations }) => {
  void cspViolations;
  await adminLogin(page);
  await expect(page.getByText(/21 of 21 slots set/)).toBeVisible();
  const live = page.locator("[data-testid=live-week]");
  const before = await live.textContent();
  await page.getByRole("button", { name: /Switch to Week/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Students will immediately see");
  await page.getByRole("dialog").getByRole("button", { name: /Switch to Week/ }).click();
  await expect(page.getByText(/is now live for students/)).toBeVisible();
  await expect(live).not.toHaveText(before!);
  // Switch back so other tests see the original week
  await page.getByRole("button", { name: /Switch to Week/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Switch to Week/ }).click();
  await expect(live).toHaveText(before!);
});

test("edit a slot by entering dishes, then pick a library meal, then clear it", async ({ page, cspViolations }) => {
  void cspViolations;
  await adminLogin(page);
  await page.getByRole("radio", { name: /Week 2/ }).click();
  await page.getByRole("button", { name: "Edit Week 2 · Sunday · Dinner" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Enter dishes" }).click();
  const input = dialog.getByLabel(/Dishes/);
  await input.fill("Chicken Karahi, Naan, Kheer");
  await input.press("Enter");
  await expect(dialog.locator("[data-testid=chip]")).toHaveCount(3);
  await dialog.getByRole("button", { name: "Save slot" }).click();
  await expect(page.getByText("Week 2 · Sunday · Dinner updated.")).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Sunday" });
  await expect(row).toContainText("Chicken Karahi");

  await page.getByRole("button", { name: "Edit Week 2 · Sunday · Dinner" }).click();
  await dialog.getByPlaceholder("Search by dish, name or ID").fill("biryani");
  const option = dialog.getByRole("option", { name: /biryani/i }).first();
  await option.click();
  await expect(option).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("button", { name: "Save slot" }).click();
  await expect(page.getByText("Week 2 · Sunday · Dinner updated.")).toBeVisible();
  await expect(row).toContainText(/biryani/i);

  await page.getByRole("button", { name: "Clear Week 2 · Sunday · Dinner" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear slot" }).click();
  await expect(page.getByText(/20 of 21 slots set/)).toBeVisible();
  await page.getByRole("button", { name: "Assign meal" }).click();
  await expect(page.getByRole("dialog")).toContainText("Empty");
});

test("meal library: create, find, edit, copy", async ({ page, context, cspViolations }) => {
  void cspViolations;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await adminLogin(page);
  await page.getByRole("tab", { name: /Meal library/ }).click();
  await page.getByRole("button", { name: "New meal" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Display name/).fill("Eid Special");
  await dialog.getByLabel("Category").selectOption("dinner");
  const dishes = dialog.getByLabel(/Dishes/);
  await dishes.fill("Mutton Biryani, Shami Kabab, Zarda");
  await dishes.press("Enter");
  await dialog.getByRole("button", { name: "Create meal" }).click();
  await expect(page.getByText("Meal created.")).toBeVisible();

  await page.getByPlaceholder("Search by dish, name or ID").fill("Eid Special");
  const card = page.locator("[data-testid=meal-card]").filter({ hasText: "Eid Special" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Not on the menu");
  await card.getByTitle("Copy meal ID").click();
  await expect(page.getByText("Meal ID copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^meal_/);

  await card.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel(/Display name/).fill("Eid Special Feast");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Meal updated.")).toBeVisible();
  await page.getByPlaceholder("Search by dish, name or ID").fill("Feast");
  await expect(page.locator("[data-testid=meal-card]")).toHaveCount(1);
});

test("bulk editor validates JSON live and applies a confirmed update", async ({ page, cspViolations }) => {
  void cspViolations;
  await adminLogin(page);
  await page.getByRole("tab", { name: "Bulk editor" }).click();
  const editor = page.getByLabel("Menu JSON");

  await editor.fill('{"week1": {"monday": ');
  await expect(page.locator("#bulk-status")).toContainText(/Invalid JSON/);
  await expect(page.getByRole("button", { name: /^Save/ })).toBeDisabled();

  await page.getByRole("button", { name: "Load current menu" }).click();
  await expect(page.locator("#bulk-status")).toContainText("41 slots will be updated");

  await editor.fill(
    JSON.stringify({ week2: { sunday: { dinner: ["Haleem", "Naan"] }, funday: { lunch: ["x"] } } })
  );
  await expect(page.locator("#bulk-status")).toContainText("2 slots will be updated");
  await page.getByRole("button", { name: /^Save 2 slots/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Apply update" }).click();
  await expect(page.locator("[data-testid=bulk-result]")).toContainText("1 saved, 1 failed");
  await expect(page.locator("[data-testid=bulk-errors]")).toContainText('invalid day "funday"');

  await page.getByRole("tab", { name: "Weekly menu" }).click();
  await page.getByRole("radio", { name: /Week 2/ }).click();
  await expect(page.getByRole("row").filter({ hasText: "Sunday" })).toContainText("Haleem");
});

test("sign out ends the session server-side for this browser", async ({ page, cspViolations }) => {
  void cspViolations;
  await adminLogin(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  const res = await page.request.get("/api/admin/week");
  expect(res.status()).toBe(401);
});

test("an admin edit reaches a student straight away", async ({ page, browser, cspViolations }) => {
  void cspViolations;
  await adminLogin(page);
  const today = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "long" }).format(new Date());
  await expect(page.locator("[data-testid=live-week]")).toHaveText(/Week \d/);
  const live = (await page.locator("[data-testid=live-week]").textContent())!.trim().replace("Week ", "");
  await page.getByRole("radio", { name: new RegExp(`Week ${live}`) }).click();
  await page.getByRole("button", { name: `Edit Week ${live} · ${today} · Lunch` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Enter dishes" }).click();
  const input = dialog.getByLabel(/Dishes/);
  await input.fill("Freshness Test Pulao");
  await input.press("Enter");
  await dialog.getByRole("button", { name: "Save slot" }).click();
  await expect(page.getByText(/updated\.$/)).toBeVisible();

  // A student opening the site now (no local cache) sees the new lunch
  const student = await browser.newPage();
  await student.goto("/");
  await expect(student.locator("#mainContainer tbody tr").nth(1)).toContainText("Freshness Test Pulao");
  await student.close();
});
