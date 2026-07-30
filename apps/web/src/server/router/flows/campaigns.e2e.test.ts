import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import {
  E2E_ENABLED,
  TEST_DB_URL,
  deleteTestKey,
  getTestDb,
  makeClient,
  mintTestKey,
  randomId,
} from "./_helpers";

let db: Db | undefined;
let token: string | undefined;
let prefix: string | undefined;

beforeAll(async () => {
  if (!E2E_ENABLED || !TEST_DB_URL) return;
  ({ db } = await getTestDb(TEST_DB_URL));
  const minted = await mintTestKey(db);
  token = minted.token;
  prefix = minted.prefix;
}, 30_000);

afterAll(async () => {
  if (db && prefix) await deleteTestKey(db, prefix);
});

describe.skipIf(!E2E_ENABLED)("campaigns CRUD", () => {
  it("creates an immediately redeemable fixed-SAR promotion and code atomically", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);
    const name = randomId("ghanem-promotion");
    const code = randomId("GHANEM").toUpperCase();

    const created = await client.campaigns.createPromotion({
      name,
      code,
      amount: 2_500,
      status: "active",
      timezone: "Asia/Riyadh",
      redemptionLimit: 10,
      perUserRedemptionLimit: 1,
    });

    expect(created.campaign).toMatchObject({
      name,
      type: "DISCOUNT",
      status: "active",
      currency: "SAR",
      timezone: "Asia/Riyadh",
      voucherCount: 1,
    });
    expect(created.voucher).toMatchObject({
      code,
      campaignId: created.campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 2_500 },
      redemptionLimit: 10,
      perUserRedemptionLimit: 1,
      metadata: { type: "promo" },
    });

    const visibleCodes = await client.vouchers.list({
      search: code,
      campaignType: "DISCOUNT",
      limit: 5,
    });
    expect(visibleCodes.data.map((voucher) => voucher.id)).toContain(created.voucher.id);

    const validation = await client.vouchers.validate({
      params: { code },
      body: {
        customerExternalId: randomId("customer"),
        order: { amount: 2_500, currency: "SAR" },
      },
    });
    expect(validation).toMatchObject({
      valid: true,
      preview: { amount: 2_500 },
    });

    const redemption = await client.vouchers.redeem({
      params: { code },
      body: {
        customerExternalId: randomId("customer"),
        order: { amount: 2_500, currency: "SAR" },
        idempotencyKey: randomId("promotion-redemption"),
      },
    });
    expect(redemption).toMatchObject({ ok: true, amount: 2_500 });

    await expect(
      client.campaigns.createPromotion({
        name: `${name}-duplicate`,
        code,
        amount: 2_500,
      }),
    ).rejects.toThrow(/already exists/i);
    const duplicateCampaign = await client.campaigns.list({
      search: `${name}-duplicate`,
      type: "DISCOUNT",
      limit: 5,
    });
    expect(duplicateCampaign.data).toHaveLength(0);
  });

  it("create → update → list (search) → soft-delete excludes from list", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const name = randomId("camp");
    const created = await client.campaigns.create({
      name,
      type: "DISCOUNT",
      currency: "USD",
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe(name);

    const updated = await client.campaigns.update({
      params: { id: created.id },
      body: { patch: { description: "tagged for e2e" } },
    });
    expect(updated.description).toBe("tagged for e2e");

    const search = await client.campaigns.list({ search: name, limit: 5 });
    expect(search.data.find((c) => c.id === created.id)).toBeDefined();

    await client.campaigns.delete({ params: { id: created.id } });

    const after = await client.campaigns.list({ search: name, limit: 5 });
    expect(after.data.find((c) => c.id === created.id)).toBeUndefined();

    // get on a soft-deleted row returns NOT_FOUND.
    await expect(client.campaigns.get({ params: { id: created.id } })).rejects.toThrow(
      /not found/i,
    );
  });

  it("filters campaigns by the requested type", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);
    const name = randomId("typed-camp");

    const discount = await client.campaigns.create({
      name: `${name}-discount`,
      type: "DISCOUNT",
      currency: "SAR",
    });
    const referral = await client.campaigns.create({
      name: `${name}-referral`,
      type: "REFERRAL_PROGRAM",
      currency: "SAR",
    });

    const result = await client.campaigns.list({
      search: name,
      type: "DISCOUNT",
      limit: 10,
    });

    expect(result.data.map((campaign) => campaign.id)).toContain(discount.id);
    expect(result.data.map((campaign) => campaign.id)).not.toContain(referral.id);
  });

  it("updates optional campaign fields used by qualification and code generation", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const rule = await client.validationRules.create({
      name: randomId("camp-rule"),
      appliesTo: "voucher",
      rule: { ">=": [{ var: "order.amount" }, 100] },
    });
    const created = await client.campaigns.create({
      name: randomId("camp-full"),
      type: "DISCOUNT",
      currency: "USD",
      timezone: "UTC",
      startDate: new Date(Date.now() + 3_600_000).toISOString(),
      endDate: new Date(Date.now() + 7_200_000).toISOString(),
      codeConfig: { prefix: "FULL", length: 10 },
      validationRuleId: rule.id,
      perUserRedemptionLimit: 2,
      autoApply: true,
      metadata: { source: "create" },
    });

    const updated = await client.campaigns.update({
      params: { id: created.id },
      body: {
        patch: {
          name: `${created.name}-updated`,
          status: "active",
          currency: "EUR",
          timezone: "Europe/Amsterdam",
          startDate: new Date(Date.now() + 10_800_000).toISOString(),
          endDate: new Date(Date.now() + 14_400_000).toISOString(),
          codeConfig: { prefix: "UPD", length: 12 },
          validationRuleId: rule.id,
          perUserRedemptionLimit: 3,
          autoApply: false,
          metadata: { source: "update" },
        },
      },
    });

    expect(updated.name).toBe(`${created.name}-updated`);
    expect(updated.status).toBe("active");
    expect(updated.currency).toBe("EUR");
    expect(updated.timezone).toBe("Europe/Amsterdam");
    expect(updated.codeConfig).toEqual({ prefix: "UPD", length: 12 });
    expect(updated.perUserRedemptionLimit).toBe(3);
    expect(updated.autoApply).toBe(false);
  });
});
