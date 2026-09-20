-- Backfill app tag: everything created before app scoping belongs to Ghanem.
-- A campaign's tag is only a default for codes that do not name their own app, so tagging the
-- shared referral campaign ghanem does not stop muder-api minting muder codes under it.
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
-- GH-7VJSP9 is the only Muder referral code issued to date (confirmed against muder-api's
-- users.referral_code). Re-check that just before deploying: a code minted by the current
-- muder-api between now and this migration would be caught by the ghanem backfill above and
-- would need adding here. Codes absent from the instance match nothing, so extra entries are
-- safe.
UPDATE "voucher"
SET "metadata" = "metadata" || '{"app":"muder"}'::jsonb
WHERE "code" IN (
  'GH-7VJSP9'
);
