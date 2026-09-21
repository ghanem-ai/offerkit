import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "./_helpers";

test.describe("promotion code generation", () => {
  test("create promotion → bulk-mint 5 more codes → list shows all 6", async ({
    page,
  }) => {
    const name = `e2e-camp-${uniqueSuffix()}`;
    await page.goto("/campaigns/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel(/reward amount \(sar\)/i).fill("10.00");

    const submit = page.getByRole("button", { name: /create promotion/i });
    await expect(submit).toBeEnabled();
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/v1/promotions") &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      submit.click(),
    ]);
    await page.waitForURL(/\/vouchers\/[^?]+\?campaignId=[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    const campaignId = new URL(page.url()).searchParams.get("campaignId");
    expect(campaignId).toMatch(/^[0-9a-f-]{36}$/);
    await page.goto(`/campaigns/${campaignId}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

    // Bulk-mint 5 additional codes from the in-page form.
    await page.getByLabel(/number of codes/i).fill("5");
    await page
      .getByRole("button", { name: /generate codes/i })
      .click();

    // The initial code plus 5 new codes show up (header row excluded).
    await expect(page.getByRole("row")).toHaveCount(7, { timeout: 15_000 });
  });
});
