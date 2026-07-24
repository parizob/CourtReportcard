// Creates a Stripe Checkout Session (one-time payment) for a token pack.
// Called by the client (DashboardBilling.jsx) with the caller's JWT attached
// automatically by supabase-js. Pricing is looked up server-side only — the
// client sends a pack_id, never an amount/price, so it can't be tampered with.
//
// Mirrored from src/lib/tokenPacks.js — Deno can't import local relative
// modules across the two deploy targets the way the browser bundle can.
// Update both sides if you change pack ids/amounts/prices.

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import Stripe from 'npm:stripe@22.3.1'

const TOKEN_PACKS: Record<string, { tokens: number; priceUsd: number }> = {
  pack_300: { tokens: 300, priceUsd: 20 },
  pack_500: { tokens: 500, priceUsd: 30 },
  pack_1000: { tokens: 1000, priceUsd: 50 },
}

// Only these origins are allowed as Checkout return targets — the client
// picks one via window.location.origin, but we still validate server-side
// so this endpoint can never be used as an open redirect. Any localhost port
// is allowed since local dev servers vary; it's also how we detect "this is
// local dev" to force test-mode keys below, regardless of STRIPE_MODE.
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/
// Production serves both apex and www (canonical is www); allow either so
// Checkout success/cancel URLs match the tab the user bought from.
const isAllowedOrigin = (origin: string) =>
  origin === 'https://courtreportcard.com' ||
  origin === 'https://www.courtreportcard.com' ||
  LOCALHOST_ORIGIN.test(origin)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  let packId: string
  let origin: string
  try {
    const body = await req.json()
    packId = body.pack_id
    origin = body.origin
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const pack = packId ? TOKEN_PACKS[packId] : undefined
  if (!pack) return json({ error: 'Unknown token pack.' }, 400)
  if (!isAllowedOrigin(origin)) return json({ error: 'Invalid origin.' }, 400)

  // Local dev always uses test keys, no matter what STRIPE_MODE is set to —
  // that way flipping STRIPE_MODE to "live" for production can never cause a
  // real charge from someone's laptop.
  const STRIPE_MODE = LOCALHOST_ORIGIN.test(origin) ? 'test' : (Deno.env.get('STRIPE_MODE') || 'test').trim()
  const STRIPE_SECRET_KEY =
    STRIPE_MODE === 'live'
      ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
      : Deno.env.get('STRIPE_SECRET_KEY_TEST')

  if (!STRIPE_SECRET_KEY) {
    return json({ error: `Stripe secret key not configured for STRIPE_MODE=${STRIPE_MODE}.` }, 500)
  }

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData } = await userClient.auth.getUser()
  const user = userData?.user
  if (!user) return json({ error: 'Unauthorized.' }, 401)

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.priceUsd * 100,
            product_data: {
              name: `${pack.tokens.toLocaleString()} Tokens`,
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        pack_id: packId,
        tokens: String(pack.tokens),
      },
      success_url: `${origin}/dashboard/billing?checkout=success`,
      cancel_url: `${origin}/dashboard/billing?checkout=canceled`,
    })

    return json({ url: session.url })
  } catch (err) {
    console.error('Failed to create checkout session:', err)
    return json({ error: 'Could not start checkout. Please try again.' }, 500)
  }
})
