import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env for local, or Vercel env for deploy.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Extracted case JSON is upserted to a fixed path. Storage/CDN can keep
 * serving a pre-accept object for that path. Prefer a fresh signed URL
 * (unique token = cache miss) plus cache: no-store; fall back to download().
 */
export async function downloadCaseFile(storagePath) {
  const { data: signed, error: signErr } = await supabase.storage
    .from('case-files')
    .createSignedUrl(storagePath, 60)

  if (!signErr && signed?.signedUrl) {
    const sep = signed.signedUrl.includes('?') ? '&' : '?'
    try {
      const res = await fetch(`${signed.signedUrl}${sep}cb=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        return {
          data: null,
          error: new Error(`Storage download failed (${res.status})`),
        }
      }
      return { data: await res.blob(), error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  return supabase.storage
    .from('case-files')
    .download(storagePath, {}, { cache: 'no-store' })
}

export function uploadCaseFile(storagePath, body, contentType = 'application/json') {
  return supabase.storage.from('case-files').upload(storagePath, body, {
    upsert: true,
    cacheControl: '0',
    contentType,
  })
}
