import { json } from '@/lib/http';
import { findOrder, orderSnapshot, verifyAndUpdateOrder } from '@/lib/orders';
import { consumeRateLimit } from '@/lib/supabase';
import { clientIp, hashIdentity, hashSession, safeEqual, validSession, validTransaction } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const transactionId = (url.searchParams.get('id') || '').trim();
    const sessionId = (url.searchParams.get('sid') || '').trim();
    if (!validTransaction(transactionId)) return json({ ok: false, message: 'ID da transação inválido.' }, 400);
    if (!validSession(sessionId)) return json({ ok: false, message: 'Sessão não autorizada.' }, 403);
    if (!(await consumeRateLimit(`check_payment_public:${hashIdentity(clientIp(request) || 'unknown')}`, 60, 60))) return json({ ok: false, message: 'Muitas verificações. Aguarde alguns segundos.' }, 429);
    const order = await findOrder(transactionId);
    if (!order || !safeEqual(order.session_hash, hashSession(sessionId))) return json({ ok: false, message: 'Sessão não autorizada.' }, 403);
    if (!(await consumeRateLimit(`check_payment:${hashIdentity(`${transactionId}|${sessionId}`)}`, 20, 60))) return json({ ok: false, message: 'Muitas verificações. Aguarde alguns segundos.' }, 429);
    const status = await verifyAndUpdateOrder(order, request);
    return json({ ok: true, transactionId, status, ...orderSnapshot(order) });
  } catch (error) {
    console.error('CHECK_PAYMENT_ERROR', { kind: error instanceof Error ? error.message : 'unknown' });
    return json({ ok: false, message: 'Não foi possível verificar agora. Tentaremos novamente.' }, 503);
  }
}
