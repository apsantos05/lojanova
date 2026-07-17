import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const checkout = readFileSync('app/youtube/finalizar-pagamento/checkout-assistant.tsx', 'utf8');
const vsl = readFileSync('app/youtube/vsl-player.tsx', 'utf8');

describe('funil da VSL', () => {
  it('usa apenas a oferta principal e o bump 5', () => {
    expect(checkout).toContain('const total = 2290 + (bump ? 990 : 0)');
    expect(checkout).toContain('bumps: bump ? [5] : []');
    expect(checkout).not.toMatch(/bump[234]|terço|kit|40 dias/i);
    expect(checkout).toContain('Nenhum frete ou produto físico');
  });

  it('não guarda nem repete o CPF', () => {
    expect(checkout).toContain("setCpf('')");
    expect(checkout).not.toMatch(/localStorage\.setItem\([^)]*cpf/i);
    expect(checkout).toContain('CPF informado com segurança');
  });

  it('mantém download protegido e áudio manual', () => {
    expect(checkout).toContain('/api/download-oracao?id=');
    expect(checkout).toContain('O áudio adicional será enviado manualmente');
    expect(checkout).not.toContain('download-audio');
  });

  it('apresenta a VSL como conteúdo gravado e encaminha para a rota correta', () => {
    expect(vsl).toContain('/youtube/finalizar-pagamento');
    expect(vsl).toContain('public.blob.vercel-storage.com/videos/oracao-sagrada-sao-bento-vsl.mp4');
    expect(vsl).not.toContain('video.oracaosaobento.online');
    expect(vsl).toContain('controls');
    expect(vsl).not.toMatch(/AO VIVO|viewers|pushState|popstate|login/i);
  });
});
