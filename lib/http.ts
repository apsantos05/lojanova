export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function readJson(request: Request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 65_536) throw new Error('payload_too_large');
  const raw = await request.text();
  if (raw.length > 65_536) throw new Error('payload_too_large');
  if (!raw) return {} as Record<string, unknown>;
  const value: unknown = JSON.parse(raw);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
