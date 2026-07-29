import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const apiRateLimit = pgTable(
  "api_rate_limit",
  {
    keyId: text("key_id").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.keyId, table.windowStart] })],
);
