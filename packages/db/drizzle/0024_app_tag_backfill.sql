-- Backfill app tag: everything created before app scoping belongs to Ghanem.
-- A campaign's tag is only a default for codes that do not name their own app, so tagging the
-- shared referral campaign ghanem does not stop muder-api minting muder codes under it.
--
-- Muder's pre-existing codes are swept up as ghanem here and are re-tagged separately, outside
-- this migration.
UPDATE "campaign"
SET "metadata" = "metadata" || '{"app":"ghanem"}'::jsonb
WHERE NOT ("metadata" ? 'app');
--> statement-breakpoint
UPDATE "voucher"
SET "metadata" = "metadata" || '{"app":"ghanem"}'::jsonb
WHERE NOT ("metadata" ? 'app');
