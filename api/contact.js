const FROM_ADDRESS = 'Court Reportcard <noreply@courtreportcard.com>'
const TO_ADDRESS   = 'courtreportcard@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured.' })
  }

  const { name, email, category, subject, message } = req.body

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields.' })
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">
          New Support Request — Court Reportcard
        </p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">From</td><td style="padding: 8px 0; font-weight: 600;">${name} &lt;${email}&gt;</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Category</td><td style="padding: 8px 0;">${category}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Subject</td><td style="padding: 8px 0; font-weight: 600;">${subject}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">Message</p>
        <p style="font-size: 14px; line-height: 1.7; white-space: pre-wrap; margin: 0;">${message}</p>
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
        subject: `[Support] ${subject}`,
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
