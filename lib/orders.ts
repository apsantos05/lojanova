import { blackcat, normalizePaymentStatus, responseData, type PaymentStatus } from './blackcat';
import { db } from './supabase';
import { sendTikTokOnce } from './tiktok';

export type Order = {
  transaction_id: string;
  status: PaymentStatus;
  amount_cents: number;
  session_hash: string;
  phone: string;
  brcode: string;
  qrcode_image: string | null;
  expires_at: string | null;
  items: Array<{ id: string; name: string; price_cents: number }>;
  bumps: number[];
};

export async function findOrder(transactionId: string) {
  const { data, error } = await db().from('orders').select('*').eq('transaction_id', transactionId).maybeSingle();
  if (error) throw error;
  return data as Order | null;
}

export function orderSnapshot(order: Order) {
  return { brcode: order.brcode, qrcodeImage: order.qrcode_image, amount_cents: order.amount_cents, expiresAt: order.expires_at };
}

async function sendCompletePayment(order: Order, request: Request) {
  await sendTikTokOnce('CompletePayment', order.transaction_id, {
    phone: `+55${order.phone}`,
    ip: request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || '',
    user_agent: request.headers.get('user-agent') || '',
    external_id: order.session_hash,
  }, {
    content_id: 'oracao-sao-bento', content_type: 'product', currency: 'BRL', value: order.amount_cents / 100,
  }, order.transaction_id);
}

export async function verifyAndUpdateOrder(order: Order, request: Request) {
  if (order.status === 'paid') {
    await sendCompletePayment(order, request);
    return 'paid' as PaymentStatus;
  }
  const result = await blackcat('GET', `/sales/${encodeURIComponent(order.transaction_id)}/status`);
  const provider = responseData(result);
  if (!result.ok || !provider) return order.status;
  const status = normalizePaymentStatus(provider.status);

  if (status === 'paid') {
    const { data: paid } = await db().from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('transaction_id', order.transaction_id).neq('status', 'paid').select('*').maybeSingle();
    const paidOrder = (paid || { ...order, status: 'paid' }) as Order;
    await sendCompletePayment(paidOrder, request);
  } else {
    await db().from('orders').update({ status, updated_at: new Date().toISOString() }).eq('transaction_id', order.transaction_id);
  }
  return status;
}
