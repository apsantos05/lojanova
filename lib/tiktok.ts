import { createHash } from 'node:crypto';
import { serverEnv } from './env';
import { db } from './supabase';

type TikTokUser = { email?: string; phone?: string; ip?: string; user_agent?: string; ttclid?: string; external_id?: string };

function sha(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase(), 'utf8').digest('hex');
}

async function claim(eventKey: string, eventName: string, transactionId?: string) {
  const now = new Date().toISOString();
  const { error } = await db().from('payment_events').insert({
    event_key: eventKey,
    event_name: eventName,
    transaction_id: transactionId || null,
    source: 'tiktok',
    delivery_status: 'processing',
    attempts: 1,
    claimed_at: now,
  });
  if (!error) return true;
  if (error.code !== '23505') throw error;

  const { data } = await db().from('payment_events').select('delivery_status,claimed_at,attempts').eq('event_key', eventKey).maybeSingle();
  if (!data || data.delivery_status === 'sent') return false;
  const stale = !data.claimed_at || Date.now() - new Date(data.claimed_at).getTime() > 5 * 60_000;
  if (data.delivery_status === 'processing' && !stale) return false;
  const { data: claimed } = await db().from('payment_events')
    .update({ delivery_status: 'processing', claimed_at: now, attempts: Number(data.attempts || 0) + 1, last_error: null })
    .eq('event_key', eventKey).neq('delivery_status', 'sent').select('id').maybeSingle();
  return Boolean(claimed);
}

export async function sendTikTokOnce(eventName: string, eventId: string, userData: TikTokUser, properties: Record<string, unknown>, transactionId?: string) {
  const env = serverEnv();
  if (!env.tiktokAccessToken || !env.tiktokPixelId) return false;
  const eventKey = `tiktok:${eventName}:${eventId}`;
  if (!(await claim(eventKey, eventName, transactionId))) return false;

  const user: Record<string, string> = {};
  if (userData.email) user.email = sha(userData.email);
  if (userData.phone) user.phone = sha(userData.phone);
  if (userData.ip) user.ip = userData.ip;
  if (userData.user_agent) user.user_agent = userData.user_agent;
  if (userData.ttclid) user.ttclid = userData.ttclid;
  if (userData.external_id) user.external_id = sha(userData.external_id);

  try {
    const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': env.tiktokAccessToken },
      body: JSON.stringify({
        event_source: 'web',
        event_source_id: env.tiktokPixelId,
        data: [{ event: eventName, event_time: Math.floor(Date.now() / 1000), event_id: eventId, user, properties }],
      }),
      cache: 'no-store',
    });
    const status = response.ok ? 'sent' : 'failed';
    await db().from('payment_events').update({ delivery_status: status, delivered_at: response.ok ? new Date().toISOString() : null, last_error: response.ok ? null : `http_${response.status}` }).eq('event_key', eventKey);
    return response.ok;
  } catch (error) {
    await db().from('payment_events').update({ delivery_status: 'failed', last_error: error instanceof Error ? error.name : 'network_error' }).eq('event_key', eventKey);
    return false;
  }
}
