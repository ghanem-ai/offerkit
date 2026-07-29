import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { logger } from "@offerkit/core/observability";
import { db } from "@/lib/db";

const log = logger.child({ component: "rate-limit" });

/** Rows removed per opportunistic sweep, so one sweep can never lock the table. */
const CLEANUP_BATCH_SIZE = 1_000;

async function sweepExpiredWindows(): Promise<void> {
  await db().execute(sql`
    DELETE FROM ${schema.apiRateLimit}
    WHERE ctid IN (
      SELECT ctid FROM ${schema.apiRateLimit}
      WHERE window_start < now() - interval '5 minutes'
      LIMIT ${CLEANUP_BATCH_SIZE}
    )
  `);
}

export async function takeToken(keyId: string, rps: number): Promise<void> {
  const limit = Math.max(rps, 1);
  const accepted = await db().transaction(async (tx) => {
    // A separate statement is intentional: it guarantees the transaction has
    // acquired the per-key lock before any usage rows are read.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${keyId}, 0))`);
    const result = await tx.execute<{ accepted: boolean }>(sql`
    WITH clock AS MATERIALIZED (
      SELECT
        observed_at,
        date_trunc('second', observed_at) AS window_start
      FROM (
        SELECT clock_timestamp() AS observed_at
      ) AS sampled
    ),
    usage AS (
      SELECT
        clock.window_start,
        COALESCE(current_window.request_count, 0) AS current_count,
        COALESCE(previous_window.request_count, 0) AS previous_count,
        EXTRACT(EPOCH FROM (clock.observed_at - clock.window_start))::float8 AS elapsed
      FROM clock
      LEFT JOIN ${schema.apiRateLimit} AS current_window
        ON current_window.key_id = ${keyId}
        AND current_window.window_start = clock.window_start
      LEFT JOIN ${schema.apiRateLimit} AS previous_window
        ON previous_window.key_id = ${keyId}
        AND previous_window.window_start = clock.window_start - interval '1 second'
    ),
    decision AS (
      SELECT
        window_start,
        (
          current_count +
          previous_count * GREATEST(0, LEAST(1, 1 - elapsed)) +
          1
        ) <= ${limit} AS accepted
      FROM usage
    ),
    bumped AS (
      INSERT INTO ${schema.apiRateLimit} (key_id, window_start, request_count)
      SELECT ${keyId}, decision.window_start, 1
      FROM decision
      WHERE decision.accepted
      ON CONFLICT (key_id, window_start)
      DO UPDATE SET request_count = ${schema.apiRateLimit.requestCount} + 1
      RETURNING request_count
    )
    SELECT decision.accepted AS "accepted"
    FROM decision
    LEFT JOIN bumped ON true
  `);
    return result.rows[0]?.accepted === true;
  }).catch((error: unknown) => {
    // The limiter is a guard, not the request itself: a database blip must not
    // turn every API call into a 500.
    log.warn({ err: error, keyId }, "api rate limit check failed, allowing request");
    return true;
  });
  if (!accepted) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: `Rate limit exceeded (${rps} rps)`,
    });
  }

  // Opportunistic cleanup keeps the fixed-window table bounded without
  // introducing a separate maintenance job.
  if (Math.random() < 0.01) {
    void sweepExpiredWindows().catch((error: unknown) => {
      log.warn({ err: error }, "api rate limit cleanup failed");
    });
  }
}
