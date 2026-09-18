-- Backfill app tag: everything created before app scoping belongs to Ghanem.
UPDATE "campaign"
SET "metadata" = "metadata" || '{"app":"ghanem"}'::jsonb
WHERE NOT ("metadata" ? 'app');
--> statement-breakpoint
UPDATE "voucher"
SET "metadata" = "metadata" || '{"app":"ghanem"}'::jsonb
WHERE NOT ("metadata" ? 'app');
