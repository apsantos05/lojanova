import { serverEnv } from '@/lib/env';
import { json } from '@/lib/http';
import { findOrder } from '@/lib/orders';
import { db } from '@/lib/supabase';
import { hashSession, safeEqual, validSession, validTransaction } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const transactionId = (url.searchParams.get('id') || '').trim();
    const sessionId = (url.searchParams.get('sid') || '').trim();
    if (!validTransaction(transactionId) || !validSession(sessionId)) return json({ ok: false, message: 'Dados inválidos.' }, 400);
    const order = await findOrder(transactionId);
    if (!order || order.status !== 'paid' || !safeEqual(order.session_hash, hashSession(sessionId))) return json({ ok: false, message: 'Acesso não autorizado.' }, 403);

    const env = serverEnv();
    const { data, error } = await db().storage.from(env.pdfBucket).download(env.pdfObject, {}, { cache: 'no-store' });
    if (error || !data) return json({ ok: false, message: 'Oração indisponível.' }, 503);
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length < 5 || bytes.length > 25 * 1024 * 1024 || new TextDecoder().decode(bytes.slice(0, 4)) !== '%PDF') return json({ ok: false, message: 'Arquivo da oração inválido.' }, 503);
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="oracao-sao-bento-guia-7-dias.pdf"',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error('DOWNLOAD_ERROR', { kind: error instanceof Error ? error.message : 'unknown' });
    return json({ ok: false, message: 'Oração indisponível.' }, 503);
  }
}
