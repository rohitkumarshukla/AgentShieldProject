/**
 * Supabase client configuration module.
 * Re-exports the canonical Supabase client instance and helpers from lib/supabase.
 */
export {
  supabase,
  getSupabaseClient,
  createSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase.js";
