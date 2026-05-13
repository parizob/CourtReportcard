const ALLOWED_MODELS = ['gemini-2.5-pro']
const DEFAULT_MODEL = 'gemini-2.5-pro'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on server.' })
  }

  const { prompt, filePart, model: requestedModel } = req.body
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
