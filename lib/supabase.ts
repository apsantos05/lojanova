import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

let client: SupabaseClient | undefined;

export function db() {
  if (!client) {
    const env = serverEnv();
    client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

export async function consumeRateLimit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await db().rpc('consume_api_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('RATE_LIMIT_DB_ERROR', { code: error.code });
    throw new Error('rate_limit_unavailable');
  }
  return data === true;
}
