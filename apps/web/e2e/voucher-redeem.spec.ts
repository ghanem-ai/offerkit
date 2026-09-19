import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "./_helpers";

test.describe("promotion flow from dashboard", () => {
  test("create active SAR promotion + code → validate → redeem", async ({ page }) => {
    const suffix = uniqueSuffix();
    const promotionName = `e2e-promotion-${suffix}`;
    const promotionCode = `GH-E2E-${suffix}`.toUpperCase();

    await page.goto("/campaigns/new");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Type", { exact: true })).toHaveCount(0);
    await page.getByLabel("Name", { exact: true }).fill(promotionName);
    await page.getByRole("combobox", { name: "App" }).click();
    await page.getByRole("option", { name: "Ghanem" }).click();
    await page.getByLabel("Code", { exact: true }).fill(promotionCode);
    await page.getByLabel(/reward amount \(sar\)/i).fill("25.00");
    await page.getByLabel(/total redemptions/i).fill("2");
    await page.getByLabel(/redemptions per customer/i).fill("1");

    const create = page.getByRole("button", { name: /create promotion/i });
    await expect(create).toBeEnabled();
    const [creationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/promotions") &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      ),
      create.click(),
    ]);
    expect(creationResponse.ok()).toBe(true);
    await page.waitForURL(/\/vouchers\/[^?]+\?campaignId=[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(promotionCode);
    await expect(page.getByText("active", { exact: true })).toBeVisible();

    const customerId = `dashboard-e2e-${suffix}`;
    await page.getByLabel(/order amount \(sar\)/i).fill("25.00");
    await page.getByLabel(/customer external id/i).fill(customerId);
    await page.getByLabel(/idempotency key/i).fill(`dashboard-${suffix}`);

    const [validationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/api\/v1\/vouchers\/[^/]+\/validate$/.test(response.url()) &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /^validate$/i }).click(),
    ]);
    expect(validationResponse.ok()).toBe(true);
    await expect(page.getByText(/"amount": 2500/)).toBeVisible();

    const [redemptionResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/api\/v1\/vouchers\/[^/]+\/redemption$/.test(response.url()) &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /^redeem$/i }).click(),
    ]);
    expect(redemptionResponse.ok()).toBe(true);
    await expect(page.getByText(/redemption succeeded/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/"ok": true/)).toBeVisible();
    await expect(page.getByText(/"amount": 2500/).last()).toBeVisible();
  });
});
