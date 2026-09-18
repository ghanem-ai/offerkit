# OfferKit: app isolation by tagging (alternative to a second instance)

**Date:** 2026-09-18
**Status:** Implemented in this repo on the working tree, uncommitted. Client-side changes in
api-v2 and muder-api are not part of this repo.

## Problem

One OfferKit instance serves Ghanem and Muder. Vouchers are looked up by code only
(`packages/core/src/redemption/validate.ts`, `redeem.ts`). Codes share one unique index
(`packages/db/src/schema/voucher.ts`). API keys carry action scopes only, no tenant
(`packages/db/src/schema/api-key.ts`). So a code made for one app works in the other.

## How it works

1. **Tag the code.** Every voucher and campaign stores `metadata.app`, either `ghanem` or `muder`.
2. **Tag the customer.** Each app upserts its users with `metadata.app` set to its own name.
3. **OfferKit checks the tags.** On validate, redeem, stack redeem, and qualify, a tagged voucher
   is rejected with `app_mismatch` unless the customer carries the same tag. Untagged vouchers are
   not restricted. A migration tags every pre-existing voucher and campaign as `ghanem`.

## What changed

| Area | Change | Files |
|---|---|---|
| Core check | `checkAppBinding` compares `voucher.metadata.app` with `customer.metadata.app`. Runs in validate, redeem, stack redeem, qualify. New failure code `app_mismatch`. | `packages/core/src/redemption/shared.ts`, `redeem.ts`, `stack.ts`, `types.ts`, `explanations.ts` |
| Contract | `app_mismatch` added to explanation codes. `voucherApp` enum. `POST /promotions` now requires `app`. | `packages/contract/src/schemas/redemption.ts`, `schemas/voucher.ts`, `routes/campaigns.ts`, `index.ts` |
| Promotion create | `app` written to campaign metadata and voucher metadata. | `apps/web/src/server/router/campaigns.ts` |
| Voucher create | A code added to a tagged campaign inherits the campaign's `app` when the request does not set one. | `apps/web/src/server/router/vouchers.ts` |
| Dashboard | Required App dropdown on New promotion. App column on Promotions and Promotion codes lists. | `promotion-form.tsx`, `campaigns/page.tsx`, `vouchers/page.tsx` |
| Migration | `0024_app_tag_backfill`: sets `metadata.app = ghanem` where missing, on `campaign` and `voucher`. | `packages/db/drizzle/0024_app_tag_backfill.sql` |
| Tests | Core live-DB tests for cross-app rejection and untagged pass-through. Web e2e test for promotion isolation and inheritance. Playwright specs pick the App and tag the customer. | `redeem.test.ts`, `explanations.test.ts`, `flows/campaigns.e2e.test.ts`, `apps/web/e2e/*.spec.ts` |

Not changed: `POST /vouchers` still accepts free-form metadata. Referral codes created by api-v2
or muder-api must include `metadata.app` themselves.

## Still required outside this repo

| # | Repo | Change |
|---|---|---|
| 1 | api-v2, muder-api | Send `metadata.app` when creating referral vouchers (`POST /vouchers`). |
| 2 | api-v2, muder-api | Before validate or redeem, `PUT /customers/by-external-id` with `metadata.app`. Auto-created customers are untagged and get `app_mismatch`. |
| 3 | api-v2, muder-api | Map the new `app_mismatch` code in the client DTOs and error handling. |
| 4 | Data | Existing Muder referral vouchers are tagged `ghanem` by the backfill. Re-tag them to `muder`, matched by `metadata.user_id`. |
| 5 | Ops | Deploy order: OfferKit image (runs the migration on boot), then both APIs. |
| 6 | Staging twin | Add `metadata.app` to voucher fixtures and the app check. |

## Run locally

Requires Node 24+, pnpm 10+, and Postgres. Redis is optional for this test.

```sh
pnpm install
cp .env.example .env
# Docker:      docker compose up -d postgres redis
# Homebrew PG: createdb offerkit && edit DATABASE_URL in .env to postgres://localhost:5432/offerkit
pnpm --filter @offerkit/db migrate
pnpm --filter @offerkit/web dev      # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. Change the password when asked.
Mint an API key at `http://localhost:3000/settings/api-keys` (hidden from the menu, open by URL).

```sh
export OK=http://localhost:3000/api/v1
export KEY=<paste key>
```

## Validate by hand

1. Create a Muder promotion. The dashboard form at `/campaigns/new` now requires the App field, or:

```sh
curl -s -X POST $OK/promotions -H "authorization: Bearer $KEY" -H "content-type: application/json" \
  -d '{"name":"muder promo","app":"muder","code":"MUDER25","amount":1000}'
```

2. Tag two customers:

```sh
curl -s -X PUT $OK/customers/by-external-id -H "authorization: Bearer $KEY" -H "content-type: application/json" \
  -d '{"externalId":"muder-user-1","metadata":{"app":"muder"}}'
curl -s -X PUT $OK/customers/by-external-id -H "authorization: Bearer $KEY" -H "content-type: application/json" \
  -d '{"externalId":"ghanem-user-1","metadata":{"app":"ghanem"}}'
```

3. Redeem from each side:

```sh
for u in ghanem-user-1 muder-user-1 nobody-1; do
curl -s -X POST $OK/vouchers/MUDER25/redemption -H "authorization: Bearer $KEY" -H "content-type: application/json" \
  -d "{\"customerExternalId\":\"$u\",\"order\":{\"amount\":5000,\"currency\":\"SAR\"}}"; echo
done
```

Expected:

| Customer | Result |
|---|---|
| `ghanem-user-1` | `"ok":false`, `"code":"app_mismatch"` |
| `muder-user-1` | `"ok":true`, `"amount":1000` |
| `nobody-1` (never upserted) | `"ok":false`, `"code":"app_mismatch"` |

4. Backfill check. Vouchers created before this change now carry `app = ghanem`:

```sh
psql "$DATABASE_URL" -c "select count(*) from voucher where not (metadata ? 'app')"   # 0
```

## Automated verification run on 2026-09-18

Local Postgres 17, fresh database, all migrations including 0024 applied.

```sh
pnpm -r typecheck && pnpm -r lint                                  # clean (one pre-existing warning)
TEST_DATABASE_URL=postgres://localhost:5432/offerkit_apptag pnpm --filter @offerkit/core test   # 75 passed
TEST_DATABASE_URL=postgres://localhost:5432/offerkit_apptag pnpm --filter @offerkit/web test    # 139 passed
```

Backfill SQL proven on the same database: 71 untagged vouchers before, 0 after.

Not run: Playwright specs under `apps/web/e2e` (need a browser and a running server).

## Side effects to know

- A tagged voucher with no matching customer fails. The dashboard redeem panel on a code's page
  now needs a customer external id that was upserted with the right `app`.
- `POST /promotions` without `app` returns a validation error. Any caller of that route must send it.
- Promotions still carry a per-customer limit, so a validate call with no customer returns
  `customer_required` before the app check runs.

## What this does not fix

- One code namespace. If Ghanem creates `SUMMER25`, Muder cannot.
- One API key sees and redeems everything within its own app tag. There is no key-to-app binding.
- One dashboard and one Orders page for both entities.
- Changes to OfferKit's core and dashboard to maintain against upstream.

A second instance needs none of this and removes all four.
