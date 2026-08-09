const FROM_ADDRESS = 'Court Reportcard <noreply@courtreportcard.com>'
const TO_ADDRESS   = 'support@courtreportcard.com'

const MAX = {
  name: 100,
  email: 254,
  category: 40,
  subject: 200,
  message: 5000,
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5

/** Best-effort in-memory limiter (per serverless instance). Good enough for low traffic. */
const rateBuckets = new Map()

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

function checkRateLimit(ip) {
  const now = Date.now()
  let bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 }
    rateBuckets.set(ip, bucket)
  }
  bucket.count += 1
  return bucket.count <= RATE_LIMIT_MAX
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asTrimmedString(value, max) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function isValidEmail(email) {
  // Practical check, not full RFC compliance.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/[\r\n]/.test(email)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!checkRateLimit(clientIp(req))) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured.' })
  }

  const name = asTrimmedString(req.body?.name, MAX.name)
  const email = asTrimmedString(req.body?.email, MAX.email)
  const category = asTrimmedString(req.body?.category, MAX.category) || 'general'
  const subject = asTrimmedString(req.body?.subject, MAX.subject)
  const message = asTrimmedString(req.body?.message, MAX.message)

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields.' })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeCategory = escapeHtml(category)
  const safeSubject = escapeHtml(subject)
  const safeMessage = escapeHtml(message)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">
          New Support Request — Court Reportcard
        </p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">From</td><td style="padding: 8px 0; font-weight: 600;">${safeName} &lt;${safeEmail}&gt;</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Category</td><td style="padding: 8px 0;">${safeCategory}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Subject</td><td style="padding: 8px 0; font-weight: 600;">${safeSubject}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">Message</p>
        <p style="font-size: 14px; line-height: 1.7; white-space: pre-wrap; margin: 0;">${safeMessage}</p>
      </div>
    </div>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: email,
        subject: `[Support] ${subject.replace(/[\r\n]+/g, ' ')}`,
        html,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return res.status(502).json({ error: err?.message || 'Failed to send email.' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach email service: ' + err.message })
  }
}
