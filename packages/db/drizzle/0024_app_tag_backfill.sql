-- Backfill app tag: everything created before app scoping belongs to Ghanem.
UPDATE "campaign"
SET "metadata" = "metadata" || '{"app":"ghanem"}'::jsonb
WHERE NOT ("metadata" ? 'app');
--> statement-breakpoint
UPDATE "voucher"
SET "metadata" = "metadata" || '{"app":"ghanem"}'::jsonb
WHERE NOT ("metadata" ? 'app');
--> statement-breakpoint
-- Re-tag Muder's codes. The backfill above cannot tell the two apps apart, so it marks every
-- pre-existing voucher ghanem — including Muder's. Left uncorrected that is worse than the bug
-- it fixes: muder-api refuses its own referral codes, and a Ghanem user redeeming one is no
-- longer a leak but the documented behaviour (TP-1455, production case GH-7VJSP9).
--
-- INCOMPLETE — extend this list with every Muder referral code before merging. GH-7VJSP9 is the
-- one code named in TP-1455; it is not the whole set. Get the rest from muder-api:
--   SELECT referral_code FROM users WHERE referral_code IS NOT NULL;
-- Codes that do not exist here simply match nothing, so an over-broad list is safe.
UPDATE "voucher"
SET "metadata" = "metadata" || '{"app":"muder"}'::jsonb
WHERE "code" IN (
  'GH-7VJSP9'
);
