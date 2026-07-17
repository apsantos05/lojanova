import { json, readJson } from '@/lib/http';
import { consumeRateLimit } from '@/lib/supabase';
import { sendTikTokOnce } from '@/lib/tiktok';
import { clientIp, hashIdentity, text, validSession } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['ViewContent', 'ClickButton', 'InitiateCheckout', 'Lead', 'CompleteRegistration', 'AddToCart', 'AddPaymentInfo']);

function safeProperties(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 20).map(([key, item]) => {
    const safeKey = text(key, 60).replace(/[^A-Za-z0-9_.-]/g, '_');
    const safeValue = typeof item === 'number' || typeof item === 'boolean' ? item : text(item, 240);
    return [safeKey, safeValue];
  }).filter(([key]) => Boolean(key)));
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const event = text(body.event, 60);
    const sessionId = text(body.session_id, 64);
    if (!validSession(sessionId)) return json({ error: 'invalid_session' }, 422);
    if (!ALLOWED.has(event)) return json({ error: 'event_not_allowed' }, 422);
    const ipHash = hashIdentity(clientIp(request) || 'unknown');
    if (!(await consumeRateLimit(`track_public:${ipHash}`, 900, 60))) return json({ error: 'rate_limited' }, 429);
    if (!(await consumeRateLimit(`track:${hashIdentity(`${clientIp(request)}|${sessionId}`)}`, 180, 60))) return json({ error: 'rate_limited' }, 429);
    const properties = safeProperties(body.properties);
    const requestedId = text(body.event_id, 120);
    const eventId = event === 'Lead' ? sessionId : (requestedId || `${sessionId}:${event}`);
    const forwarded = await sendTikTokOnce(event, eventId, {
      ip: clientIp(request), user_agent: request.headers.get('user-agent') || '', ttclid: text(body.ttclid, 200), external_id: sessionId,
    }, properties);
    return json({ ok: true, forwarded });
  } catch (error) {
    console.error('TRACK_ERROR', { kind: error instanceof Error ? error.message : 'unknown' });
    return json({ error: 'cannot_track' }, 503);
  }
}
