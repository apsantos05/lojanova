import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const funnel = readFileSync(new URL('../public/funnel.json', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const createPix = readFileSync(new URL('../app/api/create-pix/route.ts', import.meta.url), 'utf8');
const saveLead = readFileSync(new URL('../app/api/save-lead/route.ts', import.meta.url), 'utf8');
const track = readFileSync(new URL('../app/api/track/route.ts', import.meta.url), 'utf8');
const webhook = readFileSync(new URL('../app/api/webhook-blackcat/route.ts', import.meta.url), 'utf8');

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

  it('mantém a resposta digitada legível e com orientação visível', () => {
    expect(app).toContain("label.className = 'text-input-label'");
    expect(app).toContain("error.className = 'input-error'");
    expect(css).toContain('-webkit-text-fill-color:var(--text)');
    expect(css).toContain('caret-color:#075e54');
    expect(funnel).toContain('"label": "Digite seu WhatsApp com DDD"');
  });

  it('exibe um resumo visual com valores calculados pelo catálogo', () => {
    expect(app).toContain('function appendOrderSummary()');
    expect(app).toContain("addRow('Total do pagamento', fmtBRL(cartTotalCents())");
    expect(css).toContain('.order-summary-total');
    expect(funnel).not.toContain('blk-pedido-preparado-card');
  });

  it('prepara os áudios com ritmo humano antes de exibi-los', () => {
    expect(app).toContain('function showAudioPreparing()');
    expect(app).toContain('enviando mensagem de voz…');
    expect(app).toContain('await skippableSleep(audioPreparationDelay(content))');
    expect(css).toContain('.audio-preparing-wave');
    expect(css).toContain('@keyframes audio-wave');
    expect(app).not.toContain('gravando áudio agora');
    expect(funnel.match(/Mensagem de voz de Frei Gilson/g)?.length).toBe(15);
    expect(funnel).toContain('audio-02-aquecimento.mp3');
    expect(funnel).toContain('audio-06-como-pagar-pix.mp3');
    expect(funnel).toContain('audio-07-duvida.mp3');
    expect(funnel).toContain('audio-08-transicao-oracao.mp3');
    expect(funnel).toContain('audio-09-orientacao-cadastro.mp3');
    expect(funnel).toContain('audio-10-explicacao-audio-opcional.mp3');
    expect(funnel).toContain('audio-11-acolhimento-preco.mp3');
    expect(funnel).toContain('audio-12-ajuda-primeira-compra.mp3');
  });

  it('evita saltos da tela enquanto o lead digita no celular', () => {
    const inputHandler = app.match(/input\.addEventListener\('input',[\s\S]*?\n  \}\);/)?.[0] || '';
    expect(inputHandler).not.toContain('scheduleAppHeight');
    expect(app).toContain("visualViewport.addEventListener('scroll', () => scheduleAppHeight(false)");
    expect(app).toContain('if (submitted) return;');
    expect(app).toContain('input.blur();');
    expect(app).toContain('function readingPause(text)');
  });

  it('não grava CPF no localStorage nem o exibe como mensagem do lead', () => {
    expect(app).toContain("const PRIVATE_VAR_NAMES = ['nome','whatsapp','cpf'");
    expect(app).toContain("PRIVATE_VAR_NAMES.filter(k => k !== 'cpf')");
    expect(app).toContain('sessionStorage.setItem(PRIVATE_STATE_KEY');
    expect(app).not.toMatch(/localStorage\.setItem\([^)]*cpf/i);
    expect(app).toContain("kind === 'cpf' ? 'CPF informado com segurança ✓' : value");
  });

  it('limita abuso também por conexão, sem depender só da sessão escolhida pelo navegador', () => {
    expect(createPix).toContain('create_pix_public:');
    expect(saveLead).toContain('save_lead_public:');
    expect(track).toContain('track_public:');
    expect(webhook).toContain('webhook_public:');
  });
  it('não repete áudio nem envia mensagem de voz depois do QR Code', () => {
    expect(app).toContain('const renderedAudioUrls = new Set()');
    expect(app).toContain('if (renderedAudioUrls.has(url)) return null');
    expect(app).not.toContain('appendPixVoiceAfterDelay();');
  });

  it('mantém o ritmo do chat ágil, com esperas curtas e puláveis', () => {
    expect(app).toContain('const TYPING_MAX = 2400');
    expect(app).toContain('const POST_TYPING_DELAY = 360');
    expect(app).toContain('function skippableSleep(ms)');
  });
});
