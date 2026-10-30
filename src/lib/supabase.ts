import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare global {
  interface Window {
    TG_CONFIG?: { supabaseUrl?: string; supabaseKey?: string; filesUrl?: string }
  }
}

// public/config.js wins (that's what the GitHub Pages build ships); .env is a local-dev fallback.
const url = window.TG_CONFIG?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || ''
const key = window.TG_CONFIG?.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && key)

// Phone + password sign-in (see Login.tsx). Implicit flow keeps any auth redirect in the #fragment,
// which supabase-js reads before the hash router sees it.
export const supabase: SupabaseClient = isConfigured
  ? createClient(url, key, { auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true } })
  : (null as unknown as SupabaseClient)

export const BUCKET = 'gallery'
