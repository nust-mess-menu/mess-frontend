import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test fails if the page reports a Content-Security-Policy violation or
 * an uncaught error: a policy that silently blocks part of the app is a bug.
 */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: async ({ page }, provide) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as unknown as { __csp: string[] }).__csp ??= [];
        (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to (load|execute|connect|frame)/i.test(msg.text())) violations.push(msg.text());
    });
    page.on("pageerror", (err) => violations.push(`pageerror: ${err.message}`));
    await provide(violations);
    const inPage = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []).catch(() => []);
    expect([...violations, ...inPage], "CSP violations / page errors").toEqual([]);
  },
});

export { expect };

export const ADMIN = { username: "menuadmin", password: "local-dev-admin-password-123" };

export async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Menu management" })).toBeVisible();
}
