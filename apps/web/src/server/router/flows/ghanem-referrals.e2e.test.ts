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
  rawRequest,
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

describe.skipIf(!E2E_ENABLED)("Ghanem referral voucher compatibility", () => {
  it("issues one stable code and lets different referees redeem it once each", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);
    const referrerId = crypto.randomUUID();
    const refereeA = crypto.randomUUID();
    const refereeB = crypto.randomUUID();

    const campaign = await client.campaigns.create({ app: "ghanem",
      name: randomId("ghanem-referral"),
      type: "REFERRAL_PROGRAM",
      currency: "SAR",
      codeConfig: {
        prefix: "GH-",
        length: 8,
        charset: "uppercase",
        excludeConfusable: true,
      },
    });
    await client.campaigns.update({
      params: { id: campaign.id },
      body: { patch: { status: "active" } },
    });

    const body = {
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 2_500 },
      perUserRedemptionLimit: 1,
      metadata: { type: "referral", user_id: referrerId },
    };
    const idempotencyKey = `referral:${referrerId}`;
    const createRequest = () =>
      new Request("http://test.local/api/v1/vouchers", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

    const firstResponse = await rawRequest(createRequest());
    expect(firstResponse.status).toBe(200);
    const first = (await firstResponse.json()) as {
      id: string;
      code: string;
      discount: { type: string; amount: number };
      metadata: Record<string, unknown>;
    };
    const replayResponse = await rawRequest(createRequest());
    expect(replayResponse.status).toBe(200);
    const replay = (await replayResponse.json()) as typeof first;

    expect(replay.id).toBe(first.id);
    expect(replay.code).toBe(first.code);
    expect(first.discount).toEqual({ type: "AMOUNT", amount: 2_500 });
    expect(first.metadata).toMatchObject({
      type: "referral",
      user_id: referrerId,
    });

    const validationA = await client.vouchers.validate({
      params: { code: first.code },
      body: {
        customerExternalId: refereeA,
        order: { amount: 2_500, currency: "SAR" },
      },
    });
    expect(validationA.valid).toBe(true);
    expect(validationA.preview?.amount).toBe(2_500);

    const redemptionA = await client.vouchers.redeem({
      params: { code: first.code },
      body: {
        customerExternalId: refereeA,
        order: { amount: 2_500, currency: "SAR" },
        externalOrderId: `reward:${refereeA}:${first.code}`,
        idempotencyKey: `reward:${refereeA}:${first.code}`,
      },
    });
    expect(redemptionA.ok).toBe(true);
    expect(redemptionA.amount).toBe(2_500);

    const replayA = await client.vouchers.redeem({
      params: { code: first.code },
      body: {
        customerExternalId: refereeA,
        order: { amount: 2_500, currency: "SAR" },
        externalOrderId: `reward:${refereeA}:${first.code}`,
        idempotencyKey: `reward:${refereeA}:${first.code}`,
      },
    });
    expect(replayA.redemptionId).toBe(redemptionA.redemptionId);
    expect(replayA.idempotent).toBe(true);

    const duplicateA = await client.vouchers.redeem({
      params: { code: first.code },
      body: {
        customerExternalId: refereeA,
        order: { amount: 2_500, currency: "SAR" },
        idempotencyKey: randomId("different-reward"),
      },
    });
    expect(duplicateA.ok).toBe(false);
    expect(duplicateA.code).toBe("per_user_redemption_limit_reached");

    const redemptionB = await client.vouchers.redeem({
      params: { code: first.code },
      body: {
        customerExternalId: refereeB,
        order: { amount: 2_500, currency: "SAR" },
        externalOrderId: `reward:${refereeB}:${first.code}`,
        idempotencyKey: `reward:${refereeB}:${first.code}`,
      },
    });
    expect(redemptionB.ok).toBe(true);
    expect(redemptionB.amount).toBe(2_500);
  });
});
