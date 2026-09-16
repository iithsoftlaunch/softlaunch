// Browser-only Supabase client (anon/publishable key, subject to RLS).
// Option C: the site is fully static, so there is no server client. The session
// lives in the browser, and OAuth redirects are completed client-side
// (detectSessionInUrl). A singleton avoids multiple-GoTrueClient warnings.
'use client';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;
  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    },
  );
  return client;
}
