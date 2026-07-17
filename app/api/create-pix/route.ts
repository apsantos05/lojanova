import { randomBytes } from 'node:crypto';
import { blackcat, normalizePaymentStatus, responseData } from '@/lib/blackcat';
import { buildCart } from '@/lib/catalog';
import { serverEnv } from '@/lib/env';
import { json, readJson } from '@/lib/http';
import { db, consumeRateLimit } from '@/lib/supabase';
import { clientIp, digits, hashIdentity, hashSession, text, validCpf, validSession } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const sessionId = text(body.session_id, 64);
    const name = text(body.name, 80);
    const phone = digits(body.phone);
    const document = digits(body.document);
    let email = text(body.email, 120);
    const { bumpIds, items, amountCents } = buildCart(body.bumps);

    if (!validSession(sessionId)) return json({ ok: false, message: 'Sessão inválida. Recarregue a conversa e tente novamente.' }, 422);
    if (name.split(/\s+/).filter(Boolean).length < 2) return json({ ok: false, message: 'Informe seu nome completo.' }, 422);
    if (phone.length < 10 || phone.length > 11) return json({ ok: false, message: 'WhatsApp inválido. Informe com DDD.' }, 422);
    if (!validCpf(document)) return json({ ok: false, message: 'CPF inválido.' }, 422);
    const ipHash = hashIdentity(clientIp(request) || 'unknown');
    if (!(await consumeRateLimit(`create_pix_public:${ipHash}`, 60, 300))) return json({ ok: false, message: 'Muitas tentativas nesta conexão. Aguarde um minuto e tente novamente.' }, 429);
    const rateKey = `create_pix:${hashIdentity(`${clientIp(request)}|${sessionId}`)}`;
    if (!(await consumeRateLimit(rateKey, 10, 300))) return json({ ok: false, message: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, 429);
    if (!/^\S+@\S+\.\S+$/.test(email)) email = `lead+${sessionId.replace(/[^a-z0-9]/gi, '').slice(0, 20)}@oracaosaobento.online`;

    const externalRef = `SB-${Date.now()}-${randomBytes(6).toString('hex')}`;
    const env = serverEnv();
    const payload = {
      amount: amountCents,
      currency: 'BRL',
      paymentMethod: 'pix',
      items: items.map((item) => ({ title: item.name, unitPrice: item.price_cents, quantity: 1, tangible: false })),
      customer: { name, email, phone, document: { number: document, type: 'cpf' } },
      pix: { expiresInDays: 1 },
      externalRef,
      postbackUrl: `${env.appUrl}/api/webhook-blackcat`,
    };
    const result = await blackcat('POST', '/sales/create-sale', payload);
    const provider = responseData(result);
    if (!result.ok || !provider) {
      console.error('BLACKCAT_CREATE_PIX', { httpCode: result.status, errorType: result.status === 0 ? 'network_error' : 'provider_rejected' });
      return json({ ok: false, message: 'Não foi possível gerar o PIX agora. Tente novamente em instantes.' }, 502);
    }

    const paymentData = provider.paymentData && typeof provider.paymentData === 'object' ? provider.paymentData as Record<string, unknown> : {};
    const transactionId = text(provider.transactionId, 64);
    const brcode = text(paymentData.copyPaste || paymentData.qrCode, 4096);
    const rawImage = text(paymentData.qrCodeBase64 || paymentData.qrCodeUrl, 2_000_000);
    const qrcodeImage = /^(https?:\/\/|data:image\/)/i.test(rawImage) ? rawImage : null;
    const rawExpiresAt = text(paymentData.expiresAt, 80);
    const expiresAt = rawExpiresAt && Number.isFinite(Date.parse(rawExpiresAt)) ? new Date(rawExpiresAt).toISOString() : null;
    const status = normalizePaymentStatus(provider.status);
    if (!transactionId || !brcode) return json({ ok: false, message: 'BlackCat respondeu sem QR Code. Tente novamente.' }, 502);

    const { error } = await db().from('orders').insert({
      transaction_id: transactionId,
      external_ref: externalRef,
      status,
      amount_cents: amountCents,
      items,
      bumps: bumpIds,
      name,
      phone,
      document_last4: document.slice(-4),
      session_hash: hashSession(sessionId),
      brcode,
      qrcode_image: qrcodeImage,
      expires_at: expiresAt,
    });
    if (error) {
      console.error('ORDER_INSERT_ERROR', { code: error.code });
      return json({ ok: false, message: 'O PIX foi gerado, mas não pôde ser salvo com segurança. Tente novamente.' }, 503);
    }

    return json({ ok: true, transactionId, status, amount_cents: amountCents, brcode, qrcodeImage, expiresAt, items });
  } catch (error) {
    if (error instanceof Error && error.message === 'payload_too_large') return json({ ok: false, message: 'Dados acima do limite permitido.' }, 413);
    console.error('CREATE_PIX_ERROR', { kind: error instanceof Error ? error.message : 'unknown' });
    return json({ ok: false, message: 'Não foi possível gerar o PIX agora. Tente novamente em instantes.' }, 500);
  }
}
