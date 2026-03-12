import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Call delete_items RPC via fetch using the token from localStorage.
 * Bypasses the Supabase client so we avoid auth lock contention (e.g. with useActivityLog).
 */
export async function deleteItemsRpc(ids) {
  const projectRef = typeof supabaseUrl === 'string' && supabaseUrl
    ? new URL(supabaseUrl).hostname.split('.')[0]
    : ''
  const storageKey = projectRef ? `sb-${projectRef}-auth-token` : ''
  const raw = storageKey && typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null
  let accessToken = null
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      accessToken = parsed?.access_token ?? parsed?.session?.access_token ?? null
    } catch (_) {}
  }
  if (!accessToken) {
    return { data: null, error: { message: 'No auth token (read from storage). Log in again.', code: '', details: '' } }
  }
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/delete_items`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) {
    const text = await res.text()
    let errBody = null
    try { errBody = JSON.parse(text) } catch (_) {}
    const message = errBody?.message ?? errBody?.error_description ?? (text || res.statusText)
    return { data: null, error: { message, code: String(res.status), details: text } }
  }
  return { data: null, error: null }
}
