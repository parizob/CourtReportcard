# Billing & Payments (Stripe)

One-time token purchases via Stripe Checkout. Subscriptions are not built —
`DashboardBilling.jsx`'s subscription tier UI is commented out
("HIDDEN UNTIL LAUNCH") and not wired to anything.

## Architecture

| Piece | Where | Notes |
|---|---|---|
| Pricing (client display + request) | `src/lib/tokenPacks.js` | `TOKEN_PACKS`: `pack_300`/`pack_500`/`pack_1000`, tokens + priceUsd |
| Pricing (server-side source of truth) | `supabase/functions/create-checkout-session/index.ts` | **Separately maintained copy** of the same pack ids/amounts/prices — Deno can't import `src/`. If you change a pack, update both files. Same mirroring pattern as the Gemini prompts (see `architecture.md`), same risk of drift if only one side changes. |
| Checkout session creation | `supabase/functions/create-checkout-session/index.ts` | `verify_jwt: true`. Takes `{ pack_id, origin }` from the client, looks up price server-side (client never sends an amount), builds the session with **inline `price_data`** — see "No Stripe catalog" below. |
| Fulfillment | `supabase/functions/stripe-webhook/index.ts` | `verify_jwt: false` (Stripe has no Supabase JWT — its own signature is the only auth). Listens for `checkout.session.completed` / `checkout.session.async_payment_succeeded`; on `payment_status === 'paid'`, calls the `credit_tokens` RPC. |
| Idempotent credit | `credit_tokens` RPC (`supabase/migrations/20260721230000_add_stripe_token_credits.sql`, fixed in `20260722010000_fix_credit_tokens_on_conflict.sql`) | `security definer`, `service_role`-only. Keyed on `token_ledger.stripe_checkout_session_id` (partial unique index) so a webhook retry/duplicate delivery can never double-credit. |
| Fulfillment failure alerting | `supabase/functions/stripe-webhook/index.ts` (`sendFulfillmentAlert`) | Emails `courtreportcard@gmail.com` via Resend whenever a paid session doesn't end in a credit — see "Fulfillment failure alerts" below. |
| Purchase UI | `src/pages/dashboard/DashboardBilling.jsx` | Gated by `canPurchase` — see "Beta gating" below. |

## No Stripe catalog — pricing is 100% code-driven

`create-checkout-session` builds each Checkout line item with inline
`price_data` (currency/amount/name computed from `TOKEN_PACKS` at request
time) — it never references a Stripe Product/Price object by ID. This means:

- **Any Products you create manually in the Stripe Dashboard are decorative
  and unused.** They don't affect what a customer sees or pays. If pricing
  looks wrong at checkout, the bug is in `TOKEN_PACKS`
  (`create-checkout-session/index.ts`), not the dashboard catalog.
- Launching to Stripe live mode does **not** require recreating any
  Products/Prices — only new API keys and a live webhook endpoint (see
  "Test vs. live mode" below).
- Checkout line-item images: `product_data.images` can be set to a public
  URL if ever wanted again — tried once (a generated coin-pile PNG), user
  didn't like it on the actual Checkout page, reverted. Not currently set.

## Test vs. live mode

Every Stripe-touching secret is named with an explicit `_TEST`/`_LIVE` suffix
in Supabase secrets: `STRIPE_SECRET_KEY_TEST`/`_LIVE`,
`STRIPE_WEBHOOK_SECRET_TEST`/`_LIVE`. There's also a `STRIPE_MODE` secret
(`test` default) — but as of 2026-07-22 it's effectively a fallback, not the
real switch, because of how the two functions actually decide mode:

- **`create-checkout-session`** picks mode from the request's `origin`, not
  `STRIPE_MODE`: any `http://localhost:<any port>` origin always forces
  `test` keys, regardless of what `STRIPE_MODE` is set to. Non-localhost
  (i.e. `https://courtreportcard.com`) falls back to `STRIPE_MODE`. This
  means once `STRIPE_MODE` is flipped to `live` for launch, local dev keeps
  working against Stripe test mode automatically, forever, on any port —
  no more manual flipping, and no risk of a real charge from a laptop.
- **`stripe-webhook`** has no origin to inspect (Stripe calls it
  server-to-server) — instead it tries signature verification against
  `STRIPE_WEBHOOK_SECRET_TEST` first, then `_LIVE`, and uses whichever one
  actually verifies. Only the secret matching the event's real mode will
  ever succeed, so this self-sorts correctly without needing to know the
  mode in advance. The Stripe API key passed to `new Stripe(...)` in this
  function is a throwaway placeholder — `constructEventAsync` only does a
  local HMAC check, it never calls the Stripe API, so the key doesn't need
  to be real or mode-matched.

**Going live checklist** (as of 2026-07-22, account not yet activated —
`charges_enabled: false`, pending Stripe's own address verification; check
`GetAccountsAccount` via the Stripe MCP or the Dashboard before assuming
you're ready):

1. Get the live secret key (`sk_live_...`) from Stripe Dashboard → API keys
   → Live mode.
2. Create a **live-mode webhook endpoint** at the same function URL,
   listening for the same 3 events (`checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.expired`).
   Test/live webhook endpoints are separate in Stripe even at the same URL —
   this doesn't carry over automatically. Grab its signing secret.
3. Add `STRIPE_SECRET_KEY_LIVE` and `STRIPE_WEBHOOK_SECRET_LIVE` to Supabase
   secrets.
4. Flip `STRIPE_MODE` to `live` (affects the non-localhost path only, per
   above).
5. Remove/expand the `canPurchase` beta gate (see below) — this is the one
   actual code change required for public launch, everything else above is
   config.
6. Do one real small live purchase end-to-end before announcing.

## Beta gating (`DashboardBilling.jsx`)

`canPurchase = user.email === VITE_BILLING_TEST_USER_EMAIL` (case-insensitive).
Only that one account sees the real Buy UI; everyone else sees a static
"we'll top you up for free, email us" notice. This is intentional and
temporary — remove or replace with real rollout logic before public launch
(see checklist above, item 5).

## Fulfillment failure alerts

Stripe's own retry backoff (~3 days) covers *transient* fulfillment failures,
but there was no signal at all if retries ever exhausted — a customer could
be charged with tokens never credited and nobody would know without manually
checking logs. `stripe-webhook`'s `fulfill()` now emails
`courtreportcard@gmail.com` (via the Resend HTTP API, same account/domain as
`api/contact.js`) the moment either failure path happens — it does not wait
for retries to exhaust, so the same incident can generate more than one email
if Stripe redelivers before it's fixed:

- Missing/invalid `session.metadata` (`user_id`/`tokens`) — previously just a
  silent `console.error`.
- `credit_tokens` RPC throwing (the 2026-07-21 incident below would have
  emailed on the very first failed purchase instead of going unnoticed).
- `credit_tokens` returning no balance (no matching `user_profiles` row).

The email includes the checkout session ID, customer email, `user_id`/pack/
tokens from metadata, amount paid, payment status, live vs. test mode, and
the specific error message when there is one — enough to look up the session
in the Stripe Dashboard and the `token_ledger` table without digging through
logs first.

**Requires the `RESEND_API_KEY` Supabase secret** (same key already used by
the Vercel `api/contact.js` support-form endpoint works fine — it's just a
Resend API key, not tied to Vercel). If unset, `sendFulfillmentAlert` no-ops
with a `console.error` rather than failing the webhook response — a missing
alert key must never turn a successful credit into a `500` for Stripe to
retry forever.

Sending is wrapped in its own try/catch so a Resend outage can never affect
the webhook's actual response code to Stripe.

## Debugging

- **"Payment succeeded but token balance didn't update"** — check
  `token_ledger` for a row with the checkout session's `stripe_checkout_session_id`,
  and `get_logs` (service: `edge-function`) for `stripe-webhook` response
  codes. A `500` here means `credit_tokens` (or signature verification)
  threw — see the 2026-07-21 incident below for the exact kind of bug this
  can hide.
- **Reproducing a webhook call directly, without waiting on a real Stripe
  event:** you can hand-craft a validly-signed test event and curl the
  deployed function directly — this is far faster than triggering a real
  sandbox payment and works even without touching the Dashboard:
  ```js
  const crypto = require('crypto')
  const secret = '<STRIPE_WEBHOOK_SECRET_TEST value>'
  const payload = JSON.stringify({ /* minimal checkout.session.completed event shape */ })
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  // Stripe-Signature header: `t=${timestamp},v1=${sig}`
  ```
  Then `curl -i -X POST <function-url> -H "Stripe-Signature: ..." --data-binary <payload>`
  and read the raw response body — the webhook function returns plain-text
  error strings (`'Webhook not configured.'`, `'Invalid signature.'`,
  `'Internal error.'`), which usually pinpoints the failure immediately. If
  this leaves a real ledger row/balance change behind (it will, if it
  reaches `credit_tokens` successfully), clean it up manually afterward —
  `delete from token_ledger where stripe_checkout_session_id = '...'` +
  revert the `user_profiles.balance` delta.
- **2026-07-21 incident — every real purchase silently failed to credit
  tokens:** `credit_tokens`'s `insert ... on conflict (stripe_checkout_session_id)
  do nothing` threw `42P10: no unique or exclusion constraint matching the ON
  CONFLICT specification` on every call, always caught by the outer
  try/catch in `stripe-webhook` and returned as a generic `500 Internal
  error.` — Stripe's dashboard showed "payment succeeded," the user saw
  nothing wrong on their end, and the token balance just never moved.
  Root cause: `token_ledger_stripe_checkout_session_id_key` is a **partial**
  unique index (`where stripe_checkout_session_id is not null`, since most
  rows — spends, admin grants — have a null value there). Postgres can only
  infer a partial unique index as an `ON CONFLICT` target if the `ON
  CONFLICT` clause **repeats the exact same `WHERE` predicate**; without it,
  Postgres won't consider the index a valid target at all, even though it
  matches the column. Fixed by changing the clause to
  `on conflict (stripe_checkout_session_id) where stripe_checkout_session_id
  is not null do nothing` (see the fix migration). Diagnosed by reproducing
  directly — signed-test-webhook curl first to confirm the exact `500` and
  rule out secrets/config, then calling `credit_tokens` directly via SQL as
  `service_role` to get Postgres's real error message instead of the
  generic caught-and-logged one. **If a future idempotency key is ever added
  as a partial unique index, remember this — it's an easy trap.**
