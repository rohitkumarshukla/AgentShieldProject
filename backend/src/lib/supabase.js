import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env.js";

/**
 * Factory to create a Supabase client if valid credentials are provided,
 * or return null if credentials are absent.
 *
 * Designed as a factory function to support dependency injection and testability
 * without making external network calls on module import.
 *
 * @param {{ supabaseUrl?: string | null, supabaseAnonKey?: string | null }} [cfg=config]
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function createSupabaseClient(cfg = config) {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return null;
  }

  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Returns true if Supabase credentials are configured in the environment.
 *
 * @param {{ supabaseUrl?: string | null, supabaseAnonKey?: string | null }} [cfg=config]
 * @returns {boolean}
 */
export function isSupabaseConfigured(cfg = config) {
  return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
}

/**
 * Returns the active Supabase client instance or null if not configured.
 *
 * @param {{ supabaseUrl?: string | null, supabaseAnonKey?: string | null }} [cfg=config]
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function getSupabaseClient(cfg = config) {
  return createSupabaseClient(cfg);
}

/**
 * Default singleton instance based on ambient environment configuration.
 * Will be null when SUPABASE_URL or SUPABASE_ANON_KEY are not configured.
 */
export const supabase = createSupabaseClient(config);
