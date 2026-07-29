import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_DB_URL, rawRequest } from "./_helpers";

function stubWorkerReadiness(reachable: boolean): void {
  process.env["WORKER_READINESS_URL"] = "http://worker.test.local/ready";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url !== "http://worker.test.local/ready") {
        throw new Error(`unexpected fetch to ${url}`);
      }
      if (!reachable) throw new Error("worker unreachable");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }),
  );
}

describe("health and readiness probes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["WORKER_READINESS_URL"];
  });

  it("returns liveness through the public route", async () => {
    const health = await rawRequest(new Request("http://test.local/api/v1/health"));
    expect(health.ok).toBe(true);
    await expect(health.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("reports a reachable worker without changing the aggregate status", async () => {
    if (TEST_DB_URL) process.env["DATABASE_URL"] = TEST_DB_URL;
    stubWorkerReadiness(true);
    const ready = await rawRequest(new Request("http://test.local/api/v1/ready"));
    expect(ready.ok).toBe(true);
    const dbExpected = Boolean(TEST_DB_URL);
    await expect(ready.json()).resolves.toMatchObject({
      status: dbExpected ? "ok" : "degraded",
      checks: { db: dbExpected, worker: true },
    });
  });

  it("stays ready when only the worker is unreachable", async () => {
    if (TEST_DB_URL) process.env["DATABASE_URL"] = TEST_DB_URL;
    stubWorkerReadiness(false);
    const ready = await rawRequest(new Request("http://test.local/api/v1/ready"));
    expect(ready.ok).toBe(true);
    const dbExpected = Boolean(TEST_DB_URL);
    await expect(ready.json()).resolves.toMatchObject({
      status: dbExpected ? "ok" : "degraded",
      checks: { db: dbExpected, worker: false },
    });
  });
});
