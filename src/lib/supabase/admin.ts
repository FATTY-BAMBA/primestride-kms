// src/lib/supabase/admin.ts
//
// Canonical service-role Supabase client. Bypasses RLS.
// USE ONLY IN SERVER-SIDE CODE (API routes, scripts, server components).
// Never import this in client components or browser bundles.
//
// Singleton pattern: client is created once on first access and reused.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

/**
 * Returns the singleton service-role Supabase client.
 *
 * Configured with:
 * - persistSession: false (no localStorage in server contexts)
 * - autoRefreshToken: false (service role key doesn't expire)
 *
 * @throws if env vars are missing
 */
export function adminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Required for adminClient()."
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for adminClient()."
    );
  }

  _adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _adminClient;
}

// Convenience export: many call sites prefer importing the client directly.
// Lazy via Proxy so the env-var check doesn't fire at import time.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (adminClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});