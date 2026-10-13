import { expect, test } from "./fixtures";

/**
 * Google sign-in through the Firebase Auth emulator's account picker, then the
 * full rating + review + upvote flow against the real backend.
 */
async function signIn(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "Login" }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await popup.getByText("Add new account").click();
  await popup.getByText("Auto-generate user information").click();
  await popup.locator("#display-name-input").fill(name);
  await popup.getByText("Sign in with Google.com").click();
  await expect(page.locator(".user-name")).toHaveText(name.split(" ")[0]);
}

test("sign in, rate with a review, see it anonymised, sign out", async ({ page, cspViolations }) => {
  void cspViolations;
  await page.goto("/");
  await signIn(page, "Ayesha Khan");

  // Username is shown in the user menu
  await page.locator(".user-button").click();
  await expect(page.getByText(/Posts as/)).toBeVisible();
  const username = (await page.locator(".dropdown-user-alias strong").textContent())!.trim();
  await page.locator(".dropdown-overlay").click();

  await page.getByRole("button", { name: "Rate" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "8 out of 10" }).click();
  await expect(dialog.getByText("Very good")).toBeVisible();
  await expect(dialog.getByText(`Posting as ${username}`)).toBeVisible();
  await dialog.locator("#mealComment").fill("Chana was <b>great</b> today");
  await dialog.getByRole("button", { name: "Submit rating" }).click();

  await expect(page.getByText("Thanks! Your rating and review are now live.")).toBeVisible();
  await page.getByTestId("thanks-close").click();
  await expect(page.locator(".rated-note").first()).toHaveText("Your rating: 8/10");

  // The review appears under the generated username, markup stripped, real name hidden
  await page.locator(".reviews-btn").first().click();
  const review = page.getByTestId("review").first();
  await expect(review.getByTestId("review-name")).toHaveText(username);
  await expect(review.getByTestId("review-you")).toBeVisible();
  await expect(review.getByTestId("review-text")).toHaveText("Chana was great today");
  await expect(page.getByTestId("reviews")).not.toContainText("Ayesha");
  await page.keyboard.press("Escape");

  await page.locator(".user-button").click();
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});

test("a second student can upvote someone else's review", async ({ page, cspViolations }) => {
  void cspViolations;
  await page.goto("/");
  await signIn(page, "Bilal Ahmed");
  await page.locator(".reviews-btn").first().click();
  const upvote = page.getByTestId("review-upvote").first();
  await expect(upvote).toBeVisible();
  await upvote.click();
  await expect(upvote).toHaveAttribute("aria-pressed", "true");
  await expect(upvote.getByTestId("review-upvote-count")).toHaveText("1");
  // Reload: the vote persisted server-side
  await page.reload();
  await page.locator(".reviews-btn").first().click();
  await expect(page.getByTestId("review-upvote").first()).toHaveAttribute("aria-pressed", "true");
});
