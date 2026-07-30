import { expect, test } from "@playwright/test";

test.describe("admin route gate", () => {
  test("admin utilities stay hidden from operator nav but remain accessible", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: /^users$/i })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Audit log", exact: true }),
    ).toHaveCount(0);

    await page.goto("/settings/users");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /users|staff/i,
    );

    // Member-role coverage: the API call this page makes (`users.list`)
    // returns 403 for non-admin actors. That branch is exercised by the
    // server-side requireAdmin guard tested in flows/users.e2e.test.ts;
    // creating a fresh member-role session in Playwright would need
    // change-password automation against a one-time temp password and
    // adds flake without proportional value here.
  });
});
