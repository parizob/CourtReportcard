#!/usr/bin/env node
/**
 * Send a sample "prohibited content" failure email so we can review copy.
 *
 * Usage (from repo root):
 *   node --env-file=.env scripts/send-test-prohibited-failure-email.mjs
 *
 * Requires RESEND_API_KEY in env. Does not touch Supabase or deploy anything.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const emailsPath = join(__dirname, '../supabase/functions/analyze-case/emails.ts')
const src = readFileSync(emailsPath, 'utf8')

// Minimal extract of failureEmailHtml behavior for Node without Deno TS import.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function failureEmailHtml(caseName, refunded, kind, siteUrl = 'https://courtreportcard.com') {
  const supportUrl = `${siteUrl}/support`
  const safeName = escapeHtml(caseName)
  let nextStep
  if (kind === 'prohibited') {
    nextStep =
      `This wasn't a temporary glitch. Our review system blocked this file under its content rules ` +
      `(that can happen with some court transcripts even when the content is fine for filing). ` +
      `Uploading the same file again won't help. Email us at ` +
      `<a href="mailto:support@courtreportcard.com" style="color: #001939; font-weight: 700; text-decoration: underline;">support@courtreportcard.com</a> ` +
      `or use <a href="${supportUrl}" style="color: #001939; font-weight: 700; text-decoration: underline;">Contact Support</a> ` +
      `and we'll look at what happened.`
  } else {
    throw new Error('This script only sends the prohibited variant')
  }
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">We couldn't finish your transcript</p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          We hit a problem analyzing <strong>${safeName}</strong>, so it wasn't completed.
          We've <strong>refunded ${Number(refunded) || 0} token${refunded === 1 ? '' : 's'}</strong>. You weren't charged.
        </p>
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          ${nextStep}
        </p>
        <a href="${supportUrl}" style="display: inline-block; background: #001939; color: white; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px;">Contact Support</a>
      </div>
    </div>
  `
}

// Sanity: source of truth still exports prohibited copy.
if (!/wasn't a temporary glitch/.test(src) || !/Uploading the same file again won't help/.test(src)) {
  console.error('emails.ts prohibited copy looks out of sync with this script')
  process.exit(1)
}

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.error('RESEND_API_KEY missing')
  process.exit(1)
}

const to = 'brandon@courtreportcard.com'
const html = failureEmailHtml('Kim sample (PROHIBITED_CONTENT)', 279, 'prohibited')
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    from: 'Court Reportcard <noreply@courtreportcard.com>',
    to: [to],
    subject: `[TEST] We couldn't finish analyzing Kim sample (PROHIBITED_CONTENT)`,
    html,
  }),
})
const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Resend failed', res.status, body)
  process.exit(1)
}
console.log('Sent prohibited-content failure test email to', to, 'id=', body.id || body)
