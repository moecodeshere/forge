import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";
const hasCreds = Boolean(E2E_EMAIL && E2E_PASSWORD);

test.describe("Graph CRUD flow", () => {
  test.skip(!hasCreds, "Set E2E_EMAIL and E2E_PASSWORD to run auth E2E.");

  test("signup/login -> template -> edit -> run -> inspect logs", async ({ page }) => {
    const flowStartMs = Date.now();

    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_EMAIL);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("link", { name: /Daily Email Summary/i }).click();
    await expect(page).toHaveURL(/\/canvas\/new\?template=daily-summary/);

    await page.getByRole("button", { name: "MCP Tool" }).click();

    // Wait for autosave debounce
    await page.waitForTimeout(2500);
    await expect(page.getByText("Saved")).toBeVisible();

    const currentUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(currentUrl);
    await expect(page.getByText("Fetch Context")).toBeVisible();

    await page.getByRole("button", { name: "Run Full" }).click();
    await expect(page.getByText("Completed")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Execution Log")).toBeVisible();

    const elapsedMs = Date.now() - flowStartMs;
    // Release gate target: first successful workflow run < 10 minutes.
    expect(elapsedMs).toBeLessThan(10 * 60 * 1000);
  });
});
