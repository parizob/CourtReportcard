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

const ALERT_FROM = 'Court Reportcard Alerts <noreply@courtreportcard.com>'
const ALERT_TO = 'courtreportcard@gmail.com'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const text = (body: string, status = 200) =>
    new Response(body, { status, headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const STRIPE_WEBHOOK_SECRET_TEST = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST')
  const STRIPE_WEBHOOK_SECRET_LIVE = Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE')

  if (!STRIPE_WEBHOOK_SECRET_TEST && !STRIPE_WEBHOOK_SECRET_LIVE) {
    console.error('No Stripe webhook secrets configured (test or live).')
    return text('Webhook not configured.', 500)
  }

  // Stripe calls this same URL for both test-mode and live-mode webhook
  // endpoints — there's no request origin to key off of like there is in
  // create-checkout-session. So instead we just try whichever signing
  // secrets are configured; only the one matching this event's actual mode
  // will verify. constructEventAsync only checks the signature locally, so
  // the API key passed to Stripe() here doesn't need to match the mode.
  const signature = req.headers.get('Stripe-Signature') || ''
  const rawBody = await req.text()
  const stripe = new Stripe('sk_dummy_not_used_for_signature_verification', {
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event: Stripe.Event | undefined
  for (const secret of [STRIPE_WEBHOOK_SECRET_TEST, STRIPE_WEBHOOK_SECRET_LIVE]) {
    if (!secret) continue
    try {
      // Async variant required outside Node — Deno has no Node crypto module,
      // constructEvent's sync signature check would throw here.
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
      break
    } catch {
      // Try the next configured secret — could just be the other mode.
    }
  }
  if (!event) {
    console.error('Webhook signature verification failed against all configured secrets.')
    return text('Invalid signature.', 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Best-effort email to courtreportcard@gmail.com whenever a paid checkout
  // session doesn't end in tokens landing in the customer's balance — this is
  // the one gap automatic Stripe retries don't cover (see billing-stripe.md).
  // Never throws: a broken alert must not affect the webhook's own response.
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const sendFulfillmentAlert = async (
    reason: string,
    session: Stripe.Checkout.Session,
    extra: Record<string, string> = {},
  ) => {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured — skipping fulfillment failure alert email.')
      return
    }
    const mode = event?.livemode ? 'LIVE' : 'test'
    const rows: Record<string, string> = {
      Mode: mode,
      Reason: reason,
      'Checkout Session ID': session.id,
      'Customer Email': session.customer_details?.email || session.customer_email || 'unknown',
      'User ID (metadata)': session.metadata?.user_id || 'missing',
      'Pack ID (metadata)': session.metadata?.pack_id || 'missing',
      'Tokens (metadata)': session.metadata?.tokens || 'missing',
      'Amount Paid': session.amount_total != null ? `$${(session.amount_total / 100).toFixed(2)}` : 'unknown',
      'Payment Status': session.payment_status || 'unknown',
      ...extra,
    }
    const rowsHtml = Object.entries(rows)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px;color:#6b7280;white-space:nowrap;">${k}</td><td style="padding:6px 12px;font-weight:600;">${v}</td></tr>`,
      )
      .join('')
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
        <div style="background: #b91c1c; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">
            Token fulfillment failed — action needed
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 24px 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
            A Stripe checkout session did not result in tokens being credited. Use the
            details below to look up the session in the Stripe Dashboard (${mode} mode)
            and the <code>token_ledger</code> table.
          </p>
          <table style="width:100%; border-collapse:collapse; font-size: 13px;">${rowsHtml}</table>
        </div>
      </div>
    `
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: ALERT_FROM,
          to: [ALERT_TO],
          subject: `[${mode}] Token fulfillment failed — ${reason}`,
          html,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to send fulfillment alert email:', err)
      }
    } catch (err) {
      console.error('Failed to reach Resend while sending fulfillment alert:', err)
    }
  }

  const fulfill = async (session: Stripe.Checkout.Session) => {
    const userId = session.metadata?.user_id
    const tokens = Number(session.metadata?.tokens)
    if (!userId || !tokens || tokens <= 0) {
      console.error(`Checkout session ${session.id} missing/invalid metadata — skipping credit.`)
      await sendFulfillmentAlert('Missing or invalid checkout metadata', session)
      return
    }

    const { data, error } = await admin.rpc('credit_tokens', {
      p_user_id: userId,
      p_amount: tokens,
      p_description: 'Purchase',
      p_stripe_session_id: session.id,
    })

    if (error) {
      await sendFulfillmentAlert('credit_tokens RPC failed', session, { Error: error.message })
      throw new Error(`credit_tokens failed for session ${session.id}: ${error.message}`)
    }
    if (data === null || data === undefined) {
      console.error(`credit_tokens returned no balance for session ${session.id} (user ${userId}) — no profile row?`)
      await sendFulfillmentAlert('credit_tokens returned no balance (no profile row?)', session)
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
