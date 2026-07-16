import { createHash } from 'node:crypto';

export function text(value: unknown, max = 200) {
  return String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

export function digits(value: unknown) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function validSession(value: string) {
  return /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

export function validTransaction(value: string) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export function validCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length < 11; length += 1) {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    if (Number(cpf[length]) !== ((10 * sum) % 11) % 10) return false;
  }
  return true;
}

export function hashSession(sessionId: string) {
  return createHash('sha256').update(sessionId, 'utf8').digest('hex');
}

export function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export function clientIp(request: Request) {
  const raw = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || '';
  return text(raw.split(',')[0], 64);
}

export function hashIdentity(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
