import { chromium, type FullConfig, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"] ?? "admin@example.com";
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "changeme123";
const ROTATED_PASSWORD =
  process.env["E2E_ADMIN_PASSWORD_ROTATED"] ?? `${ADMIN_PASSWORD}-rotated`;

async function attemptSignIn(page: Page, password: string) {
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(password);
  return await Promise.all([
    page.waitForResponse(
      (candidate) => candidate.url().includes("/api/auth/sign-in/email"),
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]).then(([candidate]) => candidate);
}

async function signInWithPassword(
  page: Page,
  password: string,
): Promise<boolean> {
  let response = await attemptSignIn(page, password);
  // Better Auth throttles /sign-in/email, so two suite runs in quick
  // succession would otherwise fail setup outright with a 429.
  for (let attempt = 0; response.status() === 429 && attempt < 4; attempt += 1) {
    await page.waitForTimeout(15_000);
    await page.goto("/sign-in");
    response = await attemptSignIn(page, password);
  }
  if (!response.ok()) return false;
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"), {
    timeout: 15_000,
  });
  return true;
}

/**
 * Sign in once and persist the storage state. Specs reference the file
 * via `use.storageState`, so individual tests start already-authenticated
 * and avoid races on the seeded admin's first-boot password rotation.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const stateFile = path.resolve(process.cwd(), "e2e", ".storage-state.json");
  // eslint-disable-next-line no-console
  console.log("[global-setup] writing storage state to", stateFile);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/sign-in");

  let signedIn = await signInWithPassword(page, ADMIN_PASSWORD);
  if (!signedIn) {
    signedIn = await signInWithPassword(page, ROTATED_PASSWORD);
  }
  if (!signedIn) throw new Error("Could not sign in with the seeded or rotated admin password");

  // The must-change-password gate lives in the dashboard layout, so the
  // redirect only settles once a full navigation to /dashboard completes.
  // Reading page.url() straight after the client-side push races that
  // redirect and would skip the rotation below.
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  if (page.url().includes("/change-password")) {
    await page.getByLabel(/current password/i).fill(ADMIN_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(ROTATED_PASSWORD);
    await page.getByLabel(/confirm new password/i).fill(ROTATED_PASSWORD);
    const changeResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/auth/change-password"),
      { timeout: 15_000 },
    );
    const clearResponsePromise = page
      .waitForResponse(
        (r) => r.url().includes("/api/v1/me/clear-must-change-password"),
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    await page
      .getByRole("button", {
        name: /change password|update password|update|save/i,
      })
      .click();
    const changeResponse = await changeResponsePromise;
    if (!changeResponse.ok()) throw new Error("Admin password rotation failed");

    const clearResponse = await clearResponsePromise;
    if (!clearResponse?.ok()) {
      await page.goto("/sign-in");
      if (!(await signInWithPassword(page, ROTATED_PASSWORD))) {
        throw new Error("Could not sign in after rotating the admin password");
      }
      const clearAfterSignIn = await ctx.request.post(
        "/api/v1/me/clear-must-change-password",
      );
      if (!clearAfterSignIn.ok()) {
        throw new Error("Could not clear the admin password-change requirement");
      }
    }
    await page.goto("/dashboard");
  }

  // eslint-disable-next-line no-console
  console.log("[global-setup] final url before save:", page.url());
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await ctx.storageState({ path: stateFile });
  await browser.close();
  // eslint-disable-next-line no-console
  console.log("[global-setup] state saved");
}

export default globalSetup;
