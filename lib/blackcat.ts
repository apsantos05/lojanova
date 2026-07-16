import { serverEnv } from './env';

type BlackCatResult = { ok: boolean; status: number; data: Record<string, unknown> | null };

export async function blackcat(method: 'GET' | 'POST', path: string, body?: unknown): Promise<BlackCatResult> {
  const env = serverEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${env.blackcatBaseUrl}/${path.replace(/^\/+/, '')}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-API-Key': env.blackcatSecretKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    let data: Record<string, unknown> | null = null;
    try { data = await response.json() as Record<string, unknown>; } catch { /* resposta inválida */ }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error('BLACKCAT_NETWORK_ERROR', { kind: error instanceof Error ? error.name : 'unknown' });
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timeout);
  }
}

export type PaymentStatus = 'pending' | 'paid' | 'canceled' | 'refunded';

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = String(value ?? '').trim().toUpperCase();
  if (status === 'PAID') return 'paid';
  if (status === 'REFUNDED') return 'refunded';
  if (status === 'CANCELLED' || status === 'CANCELED') return 'canceled';
  return 'pending';
}

export function responseData(result: BlackCatResult) {
  const data = result.data?.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
}
