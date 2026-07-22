// Stripe webhook — the only reliable trigger for fulfillment (redirects
// alone aren't guaranteed: a customer can pay successfully and lose their
// connection before ever reaching success_url). Deployed with verify_jwt
// disabled, since Stripe calls this directly with no Supabase JWT — its own
// signature (Stripe-Signature header) is the only auth here.
//
// Response codes are deliberate, not just "always 200":
//   - 400 on a bad/missing signature (malformed request, never retry it)
//   - 200 on events we recognize but intentionally don't act on
//   - 200 on events we act on successfully
//   - 5xx if crediting itself fails unexpectedly — tells Stripe to retry
//     with its normal backoff instead of silently losing a paid purchase

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import Stripe from 'npm:stripe@22.3.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const text = (body: string, status = 200) =>
    new Response(body, { status, headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const STRIPE_MODE = (Deno.env.get('STRIPE_MODE') || 'test').trim()
  const STRIPE_SECRET_KEY =
    STRIPE_MODE === 'live'
      ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
      : Deno.env.get('STRIPE_SECRET_KEY_TEST')
  const STRIPE_WEBHOOK_SECRET =
    STRIPE_MODE === 'live'
      ? Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE')
      : Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST')

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error(`Stripe keys not configured for STRIPE_MODE=${STRIPE_MODE}.`)
    return text('Webhook not configured.', 500)
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('Stripe-Signature') || ''
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    // Async variant required outside Node — Deno has no Node crypto module,
    // constructEvent's sync signature check would throw here.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return text('Invalid signature.', 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const fulfill = async (session: Stripe.Checkout.Session) => {
    const userId = session.metadata?.user_id
    const tokens = Number(session.metadata?.tokens)
    if (!userId || !tokens || tokens <= 0) {
      console.error(`Checkout session ${session.id} missing/invalid metadata — skipping credit.`)
      return
    }

    const { data, error } = await admin.rpc('credit_tokens', {
      p_user_id: userId,
      p_amount: tokens,
      p_description: 'Purchase',
      p_stripe_session_id: session.id,
    })

    if (error) throw new Error(`credit_tokens failed for session ${session.id}: ${error.message}`)
    if (data === null || data === undefined) {
      console.error(`credit_tokens returned no balance for session ${session.id} (user ${userId}) — no profile row?`)
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status === 'paid') {
          await fulfill(session)
        }
        break
      }
      default:
        // Recognized-but-ignored event type — 200 so Stripe stops retrying it.
        break
    }
    return text('ok', 200)
  } catch (err) {
    console.error('Webhook handling failed:', err)
    return text('Internal error.', 500)
  }
})
