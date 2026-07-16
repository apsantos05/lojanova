import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const funnel = readFileSync(new URL('../public/funnel.json', import.meta.url), 'utf8');

describe('contrato do frontend migrado', () => {
  it('usa apenas as novas rotas e envia o bump selecionado', () => {
    expect(app).not.toMatch(/fetch\([^)]*\.php/);
    expect(app).toContain("fetch('/api/create-pix'");
    expect(app).toContain('bumps: selectedBumpIds()');
    expect(app).toContain('return [5].filter');
  });

  it('mantém preço, remoção e entrega manual do único áudio', () => {
    expect(funnel).toContain('R$ 22,90');
    expect(funnel).toContain('R$ 9,90');
    expect(funnel).toContain('Remover o áudio adicional');
    expect(funnel).toContain('envio manual para o WhatsApp');
  });

  it('não contém produtos antigos', () => {
    expect(`${app}\n${funnel}`).not.toMatch(/terço|terco|kit sacramental|40 dias|frete|shipping/i);
  });
});
