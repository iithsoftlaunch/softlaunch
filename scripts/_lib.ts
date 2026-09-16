// Shared helpers for the operator scripts (run with `tsx`, service-role access).
import 'dotenv/config';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Prefer .env.local (Next convention) if present.
config({ path: '.env.local', override: true });

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
