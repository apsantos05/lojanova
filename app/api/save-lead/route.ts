import { json, readJson } from '@/lib/http';
import { consumeRateLimit, db } from '@/lib/supabase';
import { sendTikTokOnce } from '@/lib/tiktok';
import { clientIp, digits, hashIdentity, hashSession, text, validSession } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const sessionId = text(body.session_id, 64);
    const whatsapp = digits(body.whatsapp);
    if (!validSession(sessionId)) return json({ error: 'invalid_session' }, 422);
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) return json({ error: 'invalid_whatsapp' }, 422);
    const ipHash = hashIdentity(clientIp(request) || 'unknown');
    if (!(await consumeRateLimit(`save_lead_public:${ipHash}`, 600, 60))) return json({ error: 'rate_limited' }, 429);
    if (!(await consumeRateLimit(`save_lead:${hashIdentity(`${clientIp(request)}|${sessionId}`)}`, 120, 60))) return json({ error: 'rate_limited' }, 429);

    const status = text(body.status || 'progress', 40);
    const lead = {
      session_hash: hashSession(sessionId),
      status,
      name: text(body.nome, 80),
      whatsapp,
      pain: text(body.dor, 40),
      target: text(body.para_quem, 40),
      intention: text(body.intencao, 180),
      bumps: String(body.bumps ?? '').split(',').map(Number).filter((id) => id === 5),
      amount_cents: Math.max(0, Math.min(3280, Number(body.amount_cents) || 0)),
      transaction_id: text(body.transaction_id, 64) || null,
      utm_source: text(body.utm_source, 80),
      utm_medium: text(body.utm_medium, 80),
      utm_campaign: text(body.utm_campaign, 80),
      utm_content: text(body.utm_content, 80),
      utm_term: text(body.utm_term, 80),
      ttclid: text(body.ttclid, 200),
      ip: clientIp(request),
      user_agent: text(request.headers.get('user-agent'), 240),
    };
    const { error } = await db().from('leads').insert(lead);
    if (error) throw error;
    if (status === 'completed' && whatsapp) {
      await sendTikTokOnce('Lead', sessionId, {
        phone: `+55${whatsapp}`,
        ip: lead.ip,
        user_agent: lead.user_agent,
        ttclid: lead.ttclid,
        external_id: sessionId,
      }, { content_name: 'Funil Conversa - Oração São Bento', content_type: 'product', currency: 'BRL' });
    }
    return json({ ok: true });
  } catch (error) {
    console.error('SAVE_LEAD_ERROR', { kind: error instanceof Error ? error.message : 'unknown' });
    return json({ error: 'cannot_save_lead' }, 503);
  }
}
