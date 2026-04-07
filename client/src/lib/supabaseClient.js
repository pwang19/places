import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL || "";
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

/** Null when env is missing; do not call auth or REST until configured. */
export const supabase = isSupabaseConfigured()
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
