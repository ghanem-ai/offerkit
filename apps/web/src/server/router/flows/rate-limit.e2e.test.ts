import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import {
  E2E_ENABLED,
  TEST_DB_URL,
  deleteTestKey,
  getTestDb,
  makeClient,
  mintTestKey,
} from "./_helpers";

let db: Db | undefined;
let token: string | undefined;
let prefix: string | undefined;

beforeAll(async () => {
  if (!E2E_ENABLED || !TEST_DB_URL) return;
  ({ db } = await getTestDb(TEST_DB_URL));
  const minted = await mintTestKey(db, ["*"], 2);
  token = minted.token;
  prefix = minted.prefix;
}, 30_000);

afterAll(async () => {
  if (db && prefix) await deleteTestKey(db, prefix);
});

describe.skipIf(!E2E_ENABLED)("api key rate limiting", () => {
  it("refuses requests beyond the key's configured rps", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => client.customers.list({ limit: 1 })),
    );
    const rejected = results.filter((result) => result.status === "rejected");

    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected[0]).toMatchObject({
      reason: expect.objectContaining({ code: "TOO_MANY_REQUESTS" }),
    });
  });
});
