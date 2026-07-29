import { implement } from "@orpc/server";
import { sql } from "drizzle-orm";
import { contract } from "@offerkit/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { apiKeysRouter } from "./api-keys";
import { campaignsRouter } from "./campaigns";
import { customersRouter } from "./customers";
import { loyaltyRouter } from "./loyalty";
import { promotionsRouter } from "./promotions";
import { referralsRouter } from "./referrals";
import { rewardTypesRouter } from "./reward-types";
import { segmentsRouter } from "./segments";
import { validationRulesRouter } from "./validation-rules";
import { vouchersRouter } from "./vouchers";
import { eventsRouter, webhooksRouter } from "./webhooks";
import { insightsRouter } from "./insights";
import { usersRouter } from "./users";
import { ordersRouter } from "./orders";
import { auditLogRouter } from "./audit-log";
import { workspaceRouter } from "./workspace";

const os = implement(contract).$context<RequestContext>();

const health = os.health.handler(() => ({
  status: "ok" as const,
  version: process.env["npm_package_version"] ?? "0.0.0",
}));

const ready = os.ready.handler(async () => {
  let dbOk = false;
  let workerOk = false;
  try {
    await db().execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  try {
    const workerHealthUrl =
      process.env["WORKER_READINESS_URL"] ?? "http://offerkit-worker:9091/ready";
    const response = await fetch(workerHealthUrl, {
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
    workerOk = response.ok;
  } catch {
    workerOk = false;
  }
  return {
    status: dbOk && workerOk ? ("ok" as const) : ("degraded" as const),
    checks: { db: dbOk, worker: workerOk },
  };
});

export const router = os.router({
  health,
  ready,
  customers: customersRouter,
  segments: segmentsRouter,
  campaigns: campaignsRouter,
  promotions: promotionsRouter,
  vouchers: vouchersRouter,
  validationRules: validationRulesRouter,
  rewardTypes: rewardTypesRouter,
  loyalty: loyaltyRouter,
  referrals: referralsRouter,
  apiKeys: apiKeysRouter,
  webhooks: webhooksRouter,
  events: eventsRouter,
  insights: insightsRouter,
  users: usersRouter,
  orders: ordersRouter,
  auditLog: auditLogRouter,
  workspace: workspaceRouter,
});
