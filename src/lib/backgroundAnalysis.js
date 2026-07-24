import { supabase } from './supabase'

// Analysis runs server-side in `analyze-case`. This module is a safety net: if
// the user still has cases stuck in `processing`, ask the server-side sweeper
// to re-kick once (then refund). The browser never runs Gemini itself.

/**
 * Asks sweep-stuck-cases to handle this user's stuck processing cases.
 * Safe to call repeatedly; the Edge Function is idempotent per case.
 */
export async function retryStuckCases() {
  const { error } = await supabase.functions.invoke('sweep-stuck-cases', { body: {} })
  if (error) console.error('Stuck-case sweep failed:', error.message || error)
}
