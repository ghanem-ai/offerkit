import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { db } from "@/lib/db";

export async function takeToken(keyId: string, rps: number): Promise<void> {
  const limit = Math.max(rps, 1);
  const result = await db().execute<{ requestCount: number }>(sql`
    INSERT INTO ${schema.apiRateLimit} (key_id, window_start, request_count)
    VALUES (${keyId}, date_trunc('second', now()), 1)
    ON CONFLICT (key_id, window_start)
    DO UPDATE SET request_count = ${schema.apiRateLimit.requestCount} + 1
    RETURNING request_count AS "requestCount"
  `);
  if ((result.rows[0]?.requestCount ?? limit + 1) > limit) {
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
      .catch(() => {});
  }
}
