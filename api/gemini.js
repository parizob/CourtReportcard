const ALLOWED_MODELS = ['gemini-2.5-pro']
const DEFAULT_MODEL = 'gemini-2.5-pro'
const MAX_FILE_BYTES = 1 * 1024 * 1024 // 1MB — well above any real transcript, blocks abuse

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on server.' })
  }

  const { prompt, filePart, model: requestedModel } = req.body

  // File size guard — base64 is ~33% larger than raw bytes, so adjust accordingly
  if (filePart?.inlineData?.data) {
    const base64 = filePart.inlineData.data
    const rawBytes = Math.floor(base64.length * 0.75)
    if (rawBytes > MAX_FILE_BYTES) {
      return res.status(413).json({ error: 'TRANSCRIPT_TOO_LARGE' })
    }

    // UTF-8 / plain-text validation — decode and check for non-text binary content
    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8')
      // Reject if more than 5% of characters are non-printable (indicates binary file)
      const nonPrintable = (decoded.match(/[\x00-\x08\x0E-\x1F\x7F]/g) || []).length
      if (nonPrintable / decoded.length > 0.05) {
        return res.status(415).json({ error: 'Only plain text files are supported.' })
      }
    } catch {
      return res.status(415).json({ error: 'Only plain text files are supported.' })
    }
  }
  const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : DEFAULT_MODEL
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`

  const parts = []
  if (filePart) parts.push(filePart)
  parts.push({ text: prompt })

  let response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 131072,
          responseMimeType: 'application/json',
        },
      }),
    })
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Gemini API: ' + err.message })
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    return res.status(response.status).json({ error: errBody?.error?.message || `Gemini API error: ${response.status}` })
  }

  const data = await response.json()
  return res.status(200).json(data)
}
