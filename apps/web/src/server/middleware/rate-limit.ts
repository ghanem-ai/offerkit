import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { logger } from "@offerkit/core/observability";
import { db } from "@/lib/db";

const log = logger.child({ component: "rate-limit" });

export async function takeToken(keyId: string, rps: number): Promise<void> {
  const limit = Math.max(rps, 1);
  const result = await db().execute<{
    currentCount: number;
    previousCount: number;
    elapsed: number;
  }>(sql`
    WITH bumped AS (
      INSERT INTO ${schema.apiRateLimit} (key_id, window_start, request_count)
      VALUES (${keyId}, date_trunc('second', now()), 1)
      ON CONFLICT (key_id, window_start)
      DO UPDATE SET request_count = ${schema.apiRateLimit.requestCount} + 1
      RETURNING key_id, window_start, request_count
    )
    SELECT
      bumped.request_count AS "currentCount",
      COALESCE(previous.request_count, 0) AS "previousCount",
      EXTRACT(EPOCH FROM (now() - bumped.window_start))::float8 AS "elapsed"
    FROM bumped
    LEFT JOIN ${schema.apiRateLimit} AS previous
      ON previous.key_id = bumped.key_id
      AND previous.window_start = bumped.window_start - interval '1 second'
  `);
  const row = result.rows[0];
  // The previous second still counts, weighted by how much of it overlaps the
  // trailing second, so a burst straddling a window boundary cannot exceed the
  // configured rate.
  const overlap = row ? Math.max(0, Math.min(1, 1 - Number(row.elapsed))) : 0;
  const used = row
    ? Number(row.currentCount) + Number(row.previousCount) * overlap
    : limit + 1;
  if (used > limit) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: `Rate limit exceeded (${rps} rps)`,
    });
  }

  // Opportunistic cleanup keeps the fixed-window table bounded without
  // introducing a separate maintenance job.
  if (Math.random() < 0.01) {
    void db()
      .delete(schema.apiRateLimit)
      .where(sql`${schema.apiRateLimit.windowStart} < now() - interval '5 minutes'`)
      .catch((error: unknown) => {
        log.warn({ err: error }, "api rate limit cleanup failed");
      });
  }
}
