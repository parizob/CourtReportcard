// One-time token packs sold via Stripe Checkout. Mirrored (same ids/amounts)
// in supabase/functions/create-checkout-session/index.ts — Deno can't import
// local relative modules across the two deploy targets the way the browser
// bundle can. Update both sides if you change pricing.
export const TOKEN_PACKS = [
  { id: 'pack_300', tokens: 300, priceUsd: 20 },
  { id: 'pack_500', tokens: 500, priceUsd: 30 },
  { id: 'pack_1000', tokens: 1000, priceUsd: 50 },
]
