import { json, readJson } from '@/lib/http';
import { findOrder, verifyAndUpdateOrder } from '@/lib/orders';
import { consumeRateLimit } from '@/lib/supabase';
import { clientIp, hashIdentity, text, validTransaction } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const transactionId = text(body.transactionId, 64);
    if (!validTransaction(transactionId)) return json({ received: true, ignored: true, reason: 'Sem transactionId válido.' });
    if (!(await consumeRateLimit(`webhook_public:${hashIdentity(clientIp(request) || 'unknown')}`, 600, 60))) return json({ received: true }, 202);
    if (!(await consumeRateLimit(`webhook:${hashIdentity(`${clientIp(request)}|${transactionId}`)}`, 60, 60))) return json({ received: true }, 202);
    const order = await findOrder(transactionId);
    if (!order) return json({ received: true });
    await verifyAndUpdateOrder(order, request);
    return json({ received: true });
  } catch (error) {
    console.error('WEBHOOK_ERROR', { kind: error instanceof Error ? error.message : 'unknown' });
    return json({ received: true, pending_verify: true });
  }
}
