(function () {
'use strict';

const CHECKOUT_URL = '/finalizar-pagamento/'; // mantido só como fallback legado (bloco "Redirect")
const ASSET_VERSION = '31.0';
const FUNNEL_URL = '/funnel.json?v=' + ASSET_VERSION;
const TYPING_PER_CHAR = 38;
const TYPING_MIN = 1100;
const TYPING_MAX = 6000;
const POST_TYPING_DELAY = 1000;
const POLL_INTERVAL_MS = 4500;
const POLL_MAX_TRIES = 80; // ~6 minutos
const PROGRESS_KEY = 'sb_chat_progress_v27';
const LEGACY_PROGRESS_KEY = 'sb_chat_progress_v25';
const PRIVATE_STATE_KEY = 'sb_chat_private_v27';
const PAID_ORDER_KEY = 'sb_paid_order_v25';
const PROGRESS_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

// Catálogo — só pra exibir o resumo bonito no chat. Quem manda de verdade
// no preço é o servidor (/api/create-pix ignora qualquer valor vindo daqui).
const SB_PRODUCT = { name: 'Oração Sagrada de São Bento', price_cents: 2290 };
const SB_BUMPS = {
  5: { name: 'Áudio da Oração Sagrada de São Bento', price_cents: 990 },
};

const $ = (s) => document.querySelector(s);
const thread = $('#thread');
const inputZone = $('#input-zone');
const networkStatus = $('#network-status');
const jumpLatest = $('#jump-latest');
let trackingSequence = 0;

function updateNetworkStatus() {
  if (!networkStatus) return;
  networkStatus.hidden = navigator.onLine;
  networkStatus.textContent = navigator.onLine ? '' : 'Você está sem internet. Suas respostas continuam nesta tela e você poderá tentar novamente quando a conexão voltar.';
}
window.addEventListener('online', () => { updateNetworkStatus(); toast('Conexão restaurada. Você já pode continuar.'); });
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

/* ═══════ MOBILE VIEWPORT LOCK ═══════
   Android/iOS mudam a altura útil quando a barra do navegador aparece/some
   ou quando o teclado abre. Usar --app-height evita a página inteira "balançar":
   só o #thread rola; header e zona de input permanecem fixos. */
function isEditableTarget(el) {
  return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]'));
}
function isMobileLike() {
  return matchMedia('(hover: none), (pointer: coarse), (max-width: 700px)').matches;
}
function keyboardLooksOpen() {
  const vv = window.visualViewport;
  if (!vv) return document.body.classList.contains('keyboard-open');
  return isMobileLike() && (window.innerHeight - vv.height > 140 || document.activeElement && isEditableTarget(document.activeElement));
}
function setAppHeight() {
  const vv = window.visualViewport;
  const h = vv && vv.height ? vv.height : window.innerHeight;
  const top = vv && typeof vv.offsetTop === 'number' ? vv.offsetTop : 0;
  document.documentElement.style.setProperty('--app-height', Math.max(320, Math.round(h)) + 'px');
  document.documentElement.style.setProperty('--vv-top', Math.round(top) + 'px');
  document.body.classList.toggle('keyboard-open', keyboardLooksOpen());
}
let appHeightRAF = null;
let bottomSettleTimer = null;
function scheduleAppHeight(forceBottom = false) {
  if (appHeightRAF) cancelAnimationFrame(appHeightRAF);
  if (bottomSettleTimer) clearTimeout(bottomSettleTimer);
  appHeightRAF = requestAnimationFrame(() => {
    setAppHeight();
    if (forceBottom) {
      scrollBottom();
      bottomSettleTimer = setTimeout(scrollBottom, 220);
    }
  });
}
setAppHeight();
window.addEventListener('resize', () => scheduleAppHeight(true), { passive: true });
window.addEventListener('orientationchange', () => setTimeout(() => scheduleAppHeight(true), 250), { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => scheduleAppHeight(true), { passive: true });
  window.visualViewport.addEventListener('scroll', () => scheduleAppHeight(false), { passive: true });
}
document.addEventListener('focusin', (e) => {
  if (isEditableTarget(e.target)) {
    document.body.classList.add('keyboard-open');
    setTimeout(() => scheduleAppHeight(true), 60);
    setTimeout(() => scheduleAppHeight(true), 260);
  }
});
document.addEventListener('focusout', (e) => {
  if (isEditableTarget(e.target)) {
    setTimeout(() => scheduleAppHeight(false), 120);
    setTimeout(() => scheduleAppHeight(false), 420);
  }
});

const state = {
  funnel: null,
  blockMap: new Map(),
  groupBlockOrder: new Map(),
  edgeByItem: new Map(),
  edgeByBlock: new Map(),
  edgeByEvent: new Map(),
  vars: {},
  bumps: { 5: false },
  sessionId: makeSessionId(),
  utm: parseUTM(),
  doneRedirect: false,
  currentGroupId: null,
  currentBlockIndex: 0,
  payment: null,
};

function makeSessionId() {
  try {
    const k = 'sb_session';
    const cached = sessionStorage.getItem(k);
    if (cached) return cached;
    const id = (crypto.randomUUID && crypto.randomUUID()) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    sessionStorage.setItem(k, id);
    return id;
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

function parseUTM() {
  const out = {};
  try {
    const p = new URLSearchParams(location.search);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ttclid'].forEach(k => {
      const v = p.get(k);
      if (v) out[k] = v;
    });
  } catch (e) {}
  return out;
}

/* ═══════ PERSISTÊNCIA DE PROGRESSO ═══════
   Salva em que grupo o lead está + tudo que já respondeu, pra não perder
   nada se o navegador recarregar a página no meio da conversa (muito comum
   em navegador embutido do TikTok / Android mais antigo). */
const PRIVATE_VAR_NAMES = ['nome','whatsapp','cpf','intencao','intencaoResumo','resumo'];
const SESSION_PRIVATE_VAR_NAMES = PRIVATE_VAR_NAMES.filter(k => k !== 'cpf');

function savePrivateState() {
  try {
    const privateVars = {};
    SESSION_PRIVATE_VAR_NAMES.forEach(k => { if (state.vars[k]) privateVars[k] = state.vars[k]; });
    sessionStorage.setItem(PRIVATE_STATE_KEY, JSON.stringify(privateVars));
  } catch (e) {}
}

function loadPrivateState() {
  try { return JSON.parse(sessionStorage.getItem(PRIVATE_STATE_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}

function clearPrivateState() {
  try { sessionStorage.removeItem(PRIVATE_STATE_KEY); } catch (e) {}
  PRIVATE_VAR_NAMES.forEach(k => { delete state.vars[k]; });
}

function publicProgressVars() {
  const vars = Object.assign({}, state.vars);
  PRIVATE_VAR_NAMES.forEach(k => { delete vars[k]; });
  return vars;
}

function saveProgress(currentGroupId, paymentSnapshot, nextBlockIndex) {
  try {
    // `undefined` significa "preserve o PIX atual". Isso evita que a entrada
    // novamente no grupo de pagamento apague o snapshot salvo antes de restaurá-lo.
    if (paymentSnapshot !== undefined) state.payment = paymentSnapshot;
    const data = {
      version: ASSET_VERSION,
      sessionId: state.sessionId,
      vars: publicProgressVars(),
      bumps: state.bumps,
      currentGroupId,
      nextBlockIndex: Number.isInteger(nextBlockIndex) ? nextBlockIndex : state.currentBlockIndex,
      payment: state.payment ? {
        transactionId: state.payment.transactionId || '',
        amount_cents: state.payment.amount_cents || null,
        expiresAt: state.payment.expiresAt || null,
      } : null,
      savedAt: Date.now(),
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    savePrivateState();
  } catch (e) {}
}
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY) || localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (Date.now() - (data.savedAt || 0)) > PROGRESS_MAX_AGE_MS) return null;
    data.vars = Object.assign({}, data.vars || {}, loadPrivateState());
    if (!Number.isInteger(data.nextBlockIndex)) data.nextBlockIndex = 0;
    return data;
  } catch (e) { return null; }
}
function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(LEGACY_PROGRESS_KEY);
  } catch (e) {}
}


function savePaidOrder(transactionId) {
  try {
    localStorage.setItem(PAID_ORDER_KEY, JSON.stringify({
      transactionId,
      sessionId: state.sessionId,
      savedAt: Date.now()
    }));
  } catch (e) {}
}

function loadPaidOrder() {
  try {
    const raw = localStorage.getItem(PAID_ORDER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.transactionId || !data.sessionId) return null;
    return data;
  } catch (e) { return null; }
}

function buildSecureDownloadUrl(url) {
  if (url !== 'SECURE_DOWNLOAD_ORACAO') return url;
  const paid = loadPaidOrder() || {};
  const tx = state.vars.paidTransactionId || paid.transactionId || '';
  const sid = state.sessionId || paid.sessionId || '';
  if (!tx || !sid) return '#';
  return '/api/download-oracao?id=' + encodeURIComponent(tx) + '&sid=' + encodeURIComponent(sid);
}


function indexFunnel(fn) {
  state.funnel = fn;
  fn.groups.forEach(g => {
    const ids = [];
    g.blocks.forEach(b => {
      state.blockMap.set(b.id, { block: b, groupId: g.id });
      ids.push(b.id);
    });
    state.groupBlockOrder.set(g.id, ids);
  });
  fn.edges.forEach(e => {
    if (e.from.itemId) state.edgeByItem.set(e.from.itemId, e);
    else if (e.from.blockId) state.edgeByBlock.set(e.from.blockId, e);
    else if (e.from.eventId) state.edgeByEvent.set(e.from.eventId, e);
  });
}

function makeApelido(fullName) {
  const particles = new Set(['da','de','do','das','dos','e']);
  const clean = String(fullName || '')
    .normalize('NFC')
    .replace(/[^A-Za-zÀ-ÿ\s'-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = clean.find(p => !particles.has(p.toLowerCase())) || clean[0] || '';
  if (!first) return '';
  return first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1).toLocaleLowerCase('pt-BR');
}

function updateDerivedVars() {
  if (!state.vars.apelido && state.vars.nome) state.vars.apelido = makeApelido(state.vars.nome);
  const dor = state.vars.dor || '';
  const dorMap = {
    'Inveja / olho gordo': 'proteção contra inveja, olho gordo e energia pesada',
    'Brigas / desunião em casa': 'paz dentro de casa e reconciliação da família',
    'Saúde de alguém': 'força espiritual para atravessar essa preocupação com saúde',
    'Proteção da casa e família': 'proteção para sua casa e sua família',
  };
  state.vars.dorOferta = dorMap[dor] || 'proteção espiritual para o seu momento';

  const para = state.vars.para_quem || '';
  const paraMap = {
    'Para mim mesmo(a)': 'você',
    'Para meu filho ou filha': 'seu filho ou sua filha',
    'Para meu marido ou esposa': 'seu casamento e sua família',
    'Para toda minha família': 'toda a sua família',
  };
  state.vars.paraQuemOferta = paraMap[para] || 'você e sua família';
  const intention = String(state.vars.intencao || '').trim();
  state.vars.intencaoResumo = intention ? ('\n\nVocê escreveu: “' + intention + '”. Vou considerar essa intenção no seu pedido.') : '';
}

function updateWhatsappMasked() {
  const phoneDigits = String(state.vars.whatsapp || '').replace(/\D+/g, '');
  if (phoneDigits.length >= 4) state.vars.whatsappMasked = 'final ' + phoneDigits.slice(-4);
  else if (!state.vars.whatsappMasked) state.vars.whatsappMasked = 'informado no cadastro';
}

function interpolate(text) {
  updateDerivedVars();
  updateWhatsappMasked();
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => state.vars[k] || '');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ═══════ "TOQUE PRA PULAR" a digitação ═══════
   Pra não deixar o ritmo mais lento virar fricção: se o lead tocar na
   conversa enquanto o Frei "está digitando", pula direto pra mensagem. */
const skipEvents = new EventTarget();
thread.addEventListener('click', () => skipEvents.dispatchEvent(new Event('skip')));
function skippableSleep(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(() => { skipEvents.removeEventListener('skip', onSkip); resolve(); }, ms);
    function onSkip() { clearTimeout(timer); skipEvents.removeEventListener('skip', onSkip); resolve(); }
    skipEvents.addEventListener('skip', onSkip, { once: true });
  });
}

function typingDelay(text) {
  const raw = String(text || '').trim();
  const n = raw.length;
  const punctuation = (raw.match(/[.!?…:;]/g) || []).length;
  const lineBreaks = (raw.match(/\n/g) || []).length;

  // Mensagens curtas não surgem instantaneamente, mas também não parecem um texto longo sendo digitado.
  if (n <= 28) return 850 + Math.round(Math.random() * 650);
  if (n <= 60) return 1400 + Math.round(Math.random() * 900);

  const pauses = punctuation * 170 + lineBreaks * 230;
  const base = Math.max(TYPING_MIN, Math.min(TYPING_MAX, n * TYPING_PER_CHAR + pauses));
  return Math.round(base * (0.90 + Math.random() * 0.24));
}

function shouldShowTyping(text) {
  const n = String(text || '').trim().length;
  if (n <= 28) return Math.random() < 0.62;
  if (n <= 60) return Math.random() < 0.88;
  return true;
}

function conversationalPause(min = 800, max = 1400) {
  return skippableSleep(min + Math.round(Math.random() * Math.max(0, max - min)));
}

function readingPause(text) {
  const raw = String(text || '').trim();
  const words = raw ? raw.split(/\s+/).length : 0;
  const lineBreaks = (raw.match(/\n/g) || []).length;
  const punctuation = (raw.match(/[.!?…:;]/g) || []).length;
  const base = 1000 + words * 115 + lineBreaks * 280 + punctuation * 90;
  const delay = Math.max(1600, Math.min(6500, base));
  return skippableSleep(Math.round(delay * (0.92 + Math.random() * 0.18)));
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  thread.appendChild(el);
  thread.setAttribute('aria-busy', 'true');
  scrollBottom();
  return el;
}

function audioPreparationDelay(content) {
  const durationSeconds = Number(content && content.duration) || 18;
  const base = 1900 + Math.min(2200, durationSeconds * 85);
  return Math.round(base * (0.88 + Math.random() * 0.24));
}

function showAudioPreparing() {
  const previous = thread.querySelector('.audio-preparing');
  if (previous) previous.remove();
  const el = document.createElement('div');
  el.className = 'audio-preparing';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = [
    '<span class="audio-preparing-icon" aria-hidden="true">🎙️</span>',
    '<span class="audio-preparing-copy">enviando mensagem de voz…</span>',
    '<span class="audio-preparing-wave" aria-hidden="true">',
    '<i></i><i></i><i></i><i></i>',
    '</span>'
  ].join('');
  thread.appendChild(el);
  thread.setAttribute('aria-busy', 'true');
  scrollBottom();
  return el;
}

async function prepareAndAppendAudio(content, beforeMin = 760, beforeMax = 1380) {
  await conversationalPause(beforeMin, beforeMax);
  const preparing = showAudioPreparing();
  await skippableSleep(audioPreparationDelay(content));
  preparing.remove();
  thread.setAttribute('aria-busy', 'false');
  appendAudioBubble(content || {});
}

function nowHM() {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

function appendMessage(text, who = 'bot', extraClass = '') {
  thread.setAttribute('aria-busy', 'false');
  const wasNearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 160;
  const el = document.createElement('div');
  el.className = 'msg ' + who + (extraClass ? ' ' + extraClass : '');
  el.textContent = text;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const time = document.createElement('span');
  time.textContent = nowHM();
  meta.appendChild(time);

  if (who === 'user') {
    const tick = document.createElement('span');
    tick.className = 'msg-tick';
    tick.textContent = '✓✓';
    meta.appendChild(tick);
    el.appendChild(meta);
    thread.appendChild(el);
    if (wasNearBottom) scrollBottom();
    // "Lido" com pequeno atraso, do jeito que acontece de verdade no WhatsApp
    setTimeout(() => tick.classList.add('read'), 700 + Math.random() * 500);
    return el;
  }

  el.appendChild(meta);
  thread.appendChild(el);
  if (wasNearBottom) scrollBottom();
  return el;
}

function appendImage(url, altText = 'Imagem do complemento') {
  if (!url || url === 'URL_IMAGEM_PADRE_AQUI') return null;
  const wrap = document.createElement('div');
  wrap.className = 'msg bot image-msg';
  const img = document.createElement('img');
  img.src = url;
  img.alt = altText;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 360;
  img.height = 360;
  img.onerror = () => { wrap.innerHTML = ''; wrap.remove(); };
  img.onload = scrollBottom;
  wrap.appendChild(img);
  thread.appendChild(wrap);
  scrollBottom();
  return wrap;
}

function scrollBottom() {
  requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
    if (jumpLatest) jumpLatest.hidden = true;
  });
}

thread.addEventListener('scroll', () => {
  if (!jumpLatest) return;
  const distance = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  jumpLatest.hidden = distance < 180;
}, { passive: true });
if (jumpLatest) jumpLatest.addEventListener('click', scrollBottom);
if ('ResizeObserver' in window && inputZone) {
  new ResizeObserver(entries => {
    const height = Math.ceil(entries[0].contentRect.height);
    document.documentElement.style.setProperty('--input-zone-height', height + 'px');
    scrollBottom();
  }).observe(inputZone);
}

function clearInputZone() {
  inputZone.innerHTML = '';
  inputZone.setAttribute('aria-hidden', 'true');
}

function showChoices(items, onPick) {
  inputZone.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'choices';
  wrap.setAttribute('aria-label', 'Escolha uma resposta para continuar');
  items.filter(it => !(it.meta && it.meta.showIfBump) || !!state.bumps[it.meta.showIfBump]).forEach((it, i, visibleItems) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn' + ((visibleItems.length === 1 || (it.meta && it.meta.primary)) ? ' primary' : '');
    btn.textContent = it.content;
    btn.setAttribute('aria-label', it.content);
    btn.addEventListener('click', () => {
      [...wrap.querySelectorAll('button')].forEach(b => b.disabled = true);
      onPick(it);
    }, { once: true });
    wrap.appendChild(btn);
  });
  inputZone.appendChild(wrap);
  inputZone.setAttribute('aria-hidden', 'false');
  scrollBottom();
}

function showTextInput(opts, onSubmit) {
  inputZone.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'text-input-wrap';
  const kind = opts.kind || 'text';
  const defaultLabels = {
    first_name: 'Digite seu primeiro nome',
    name: 'Digite seu nome completo',
    phone: 'Digite seu WhatsApp com DDD',
    cpf: 'Digite o CPF do pagador',
    text: 'Digite sua resposta'
  };
  const label = document.createElement('label');
  label.className = 'text-input-label';
  label.textContent = opts.label || defaultLabels[kind] || defaultLabels.text;
  const row = document.createElement('div');
  row.className = 'text-input-row';
  const input = document.createElement('input');
  const inputId = 'chat-input-' + String(opts.variable || kind).replace(/[^a-z0-9_-]/gi, '');
  input.id = inputId;
  label.htmlFor = inputId;
  input.type = kind === 'phone' ? 'tel' : 'text';
  input.inputMode = (kind === 'phone' || kind === 'cpf') ? 'numeric' : 'text';
  input.autocomplete = kind === 'phone' ? 'tel' : ((kind === 'name' || kind === 'first_name') ? 'name' : 'off');
  input.name = opts.variable || kind;
  input.spellcheck = !(kind === 'phone' || kind === 'cpf');
  input.setAttribute('aria-label', opts.label || opts.placeholder || 'Digite sua resposta');
  input.setAttribute('aria-describedby', 'input-help');
  input.className = 'text-input';
  input.placeholder = opts.placeholder || '';
  input.maxLength = Number(opts.maxLength || (kind === 'phone' ? 16 : kind === 'cpf' ? 14 : kind === 'cep' ? 9 : 80));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'send-btn';
  btn.textContent = opts.button || 'Enviar';
  btn.setAttribute('aria-label', opts.button || 'Enviar resposta');
  let skipBtn = null;
  const help = document.createElement('span');
  help.id = inputId + '-help';
  help.className = 'input-help';
  help.textContent = opts.help || 'Preencha o campo e toque em continuar.';
  const error = document.createElement('span');
  error.id = inputId + '-error';
  error.className = 'input-error';
  error.setAttribute('role', 'alert');
  error.setAttribute('aria-live', 'assertive');
  error.hidden = true;
  input.setAttribute('aria-describedby', `${help.id} ${error.id}`);

  input.addEventListener('input', () => {
    if (kind === 'phone') input.value = formatPhoneBR(input.value);
    if (kind === 'cpf') input.value = formatCPF(input.value);
    error.hidden = true;
    input.removeAttribute('aria-invalid');
  });

  let submitted = false;
  const finish = (value, skipped = false) => {
    if (submitted) return;
    submitted = true;
    input.disabled = true; btn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    input.blur();
    onSubmit(value, { skipped });
  };
  const submit = () => {
    const raw = input.value.trim();
    if (opts.optional && raw === '') { finish('', true); return; }
    const err = validate(raw, kind);
    if (err) {
      error.textContent = err;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      toast(err);
      input.focus({ preventScroll: true });
      scheduleAppHeight(true);
      return;
    }
    finish(raw, false);
  };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

  row.appendChild(input);
  row.appendChild(btn);
  wrap.appendChild(label);
  wrap.appendChild(row);
  wrap.appendChild(help);
  wrap.appendChild(error);
  if (opts.optional) {
    skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'input-skip-btn';
    skipBtn.textContent = opts.skipButton || 'Prefiro não responder agora';
    skipBtn.addEventListener('click', () => finish('', true), { once: true });
    wrap.appendChild(skipBtn);
  }
  inputZone.appendChild(wrap);
  inputZone.setAttribute('aria-hidden', 'false');
  scheduleAppHeight(true);
  if (!isMobileLike()) setTimeout(() => input.focus(), 80);
  scrollBottom();
}

function formatPhoneBR(v) {
  const d = (v || '').replace(/\D+/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return '(' + d.slice(0,2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
  return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
}

function formatCPF(v) {
  const d = (v || '').replace(/\D+/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function isValidCPF(cpfRaw) {
  const cpf = (cpfRaw || '').replace(/\D+/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf[i - 1]) * (11 - i);
  rest = (sum * 10) % 11; if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf[i - 1]) * (12 - i);
  rest = (sum * 10) % 11; if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf[10]);
}

function validate(value, kind) {
  if (!value) return 'Por favor, preencha o campo.';
  if (kind === 'name') {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.some(p => p.length < 2)) return 'Digite seu nome completo (nome e sobrenome).';
    if (!/[A-Za-zÀ-ÿ]/.test(value)) return 'Digite um nome válido.';
  }
  if (kind === 'first_name') {
    if (value.trim().length < 2 || !/^[A-Za-zÀ-ÿ' -]+$/.test(value.trim())) return 'Digite um primeiro nome válido.';
  }
  if (kind === 'phone') {
    const d = value.replace(/\D+/g, '');
    if (d.length < 10 || d.length > 11) return 'WhatsApp deve ter 10 ou 11 dígitos (com DDD).';
  }
  if (kind === 'cpf') {
    if (!isValidCPF(value)) return 'Digite um CPF válido.';
  }
  return null;
}

let toastTimer = null;
function toast(msg) {
  const old = document.querySelector('.error-toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'error-toast';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3000);
}

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function fmtBRL(cents) { return brlFormatter.format(cents / 100).replace(/\s/g, ' '); }

function selectedBumpIds() {
  return [5].filter(n => state.bumps[n] && SB_BUMPS[n]);
}

function cartTotalCents() {
  let total = SB_PRODUCT.price_cents;
  selectedBumpIds().forEach(n => { total += SB_BUMPS[n].price_cents; });
  return total;
}

function buildResumo() {
  const lines = [SB_PRODUCT.name + ' — ' + fmtBRL(SB_PRODUCT.price_cents)];
  selectedBumpIds().forEach(n => { if (SB_BUMPS[n]) lines.push('+ ' + SB_BUMPS[n].name + ' — ' + fmtBRL(SB_BUMPS[n].price_cents)); });
  const total = cartTotalCents();
  lines.push('');
  lines.push('TOTAL: ' + fmtBRL(total));
  state.vars.resumo = lines.join('\n');
}

function appendOrderSummary() {
  thread.setAttribute('aria-busy', 'false');
  const wrap = document.createElement('section');
  wrap.className = 'msg bot order-summary';
  wrap.setAttribute('aria-label', 'Resumo do pedido');

  const title = document.createElement('div');
  title.className = 'order-summary-title';
  title.textContent = 'Confira seu pedido';
  wrap.appendChild(title);

  const addRow = (label, value, extraClass = '') => {
    const row = document.createElement('div');
    row.className = 'order-summary-row' + (extraClass ? ' ' + extraClass : '');
    const item = document.createElement('span');
    item.textContent = label;
    const price = document.createElement('strong');
    price.textContent = value;
    row.appendChild(item);
    row.appendChild(price);
    wrap.appendChild(row);
  };

  addRow('Oração Sagrada de São Bento', fmtBRL(SB_PRODUCT.price_cents));
  selectedBumpIds().forEach(id => {
    const bump = SB_BUMPS[id];
    if (bump) addRow('Áudio completo (opcional)', fmtBRL(bump.price_cents));
  });
  addRow('Total do pagamento', fmtBRL(cartTotalCents()), 'order-summary-total');

  const note = document.createElement('div');
  note.className = 'order-summary-note';
  note.textContent = 'Pagamento único por PIX. Sem mensalidade nem cobrança adicional.';
  wrap.appendChild(note);

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = nowHM();
  wrap.appendChild(meta);
  thread.appendChild(wrap);
  scrollBottom();
  return wrap;
}


let activeConversationAudio = null;

function stopOtherConversationAudios(currentAudio) {
  document.querySelectorAll('audio').forEach(other => {
    if (other !== currentAudio && !other.paused) other.pause();
  });
  activeConversationAudio = currentAudio;
}

function bindAudioTracking(audio, src, title) {
  if (!audio) return;
  audio.addEventListener('play', () => {
    track('ClickButton', { content_name: 'audio_play_' + (title || src || ''), audio_src: src || '' });
    saveLead({ status: 'audio_play', audio: src || title || '' });
  }, { once: true });
}

function appendAudioBubble(content) {
  const url = content && content.url;
  if (!url) return null;

  const wrap = document.createElement('div');
  wrap.className = 'msg bot voice-msg';

  const head = document.createElement('div');
  head.className = 'voice-head';
  head.innerHTML = '<span class="voice-dot">▶</span><span></span>';
  head.querySelector('span:last-child').textContent = content.title || 'Mensagem de voz de Frei Gilson';

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'metadata';
  audio.autoplay = false;
  audio.src = url;

  const meta = document.createElement('div');
  meta.className = 'voice-meta';
  meta.textContent = content.duration ? ('Áudio · ' + content.duration + 's') : 'Áudio opcional';

  const fallback = document.createElement('div');
  fallback.className = 'voice-fallback';
  fallback.textContent = content.fallback || 'Se o áudio não tocar, pode continuar pela conversa em texto.';
  fallback.style.display = 'none';

  audio.addEventListener('play', () => {
    stopOtherConversationAudios(audio);
  });
  audio.addEventListener('ended', () => {
    if (activeConversationAudio === audio) activeConversationAudio = null;
  });
  audio.addEventListener('pause', () => {
    if (activeConversationAudio === audio && audio.currentTime > 0 && !audio.ended) activeConversationAudio = null;
  });

  audio.addEventListener('error', () => {
    fallback.style.display = 'block';
    meta.textContent = 'Áudio indisponível — siga pelo texto abaixo';
  }, { once: true });

  wrap.appendChild(head);
  wrap.appendChild(audio);
  wrap.appendChild(meta);
  wrap.appendChild(fallback);
  thread.appendChild(wrap);
  bindAudioTracking(audio, url, content.title || '');
  scrollBottom();
  return wrap;
}


/* ═══════ Bloco: pagamento (gera PIX, mostra QR, timer real, faz polling) ═══════ */
function appendPaymentBubble() {
  thread.setAttribute('aria-busy', 'false');
  const wrap = document.createElement('div');
  wrap.className = 'msg bot payment-msg';
  wrap.innerHTML =
    '<div class="pay-title">PIX seguro gerado</div>' +
    '<div class="pay-qr-wrap"><div class="pay-qr" id="pay-qr-box"></div></div>' +
    '<div class="pay-value" id="pay-value"></div>' +
    '<div class="pay-expire" id="pay-expire" style="display:none"></div>' +
    '<div class="pay-divider">OU COPIE O CÓDIGO ABAIXO</div>' +
    '<div class="pay-code" id="pay-code" tabindex="0" aria-label="Código PIX Copia e Cola"></div>' +
    '<button type="button" class="pay-copy-btn" id="pay-copy-btn">COPIAR CÓDIGO PIX</button>' +
    '<button type="button" class="pay-check-btn" id="pay-check-btn">JÁ PAGUEI, VERIFICAR AGORA</button>' +
    '<button type="button" class="pay-regenerate-btn" id="pay-regenerate-btn" hidden>GERAR NOVO PIX</button>' +
    '<div class="pay-security">🔒 Valor conferido no servidor. Gerar outro código não cobra você automaticamente.</div>' +
    '<div class="pay-status" id="pay-status" role="status" aria-live="polite"><span class="pay-status-dot"></span><span id="pay-status-text">Gerando código seguro…</span></div>';
  thread.appendChild(wrap);
  scrollBottom();
  return wrap;
}

function fillPaymentBubble(bubble, data) {
  if (data && data.transactionId) state.vars.currentTransactionId = data.transactionId;
  const qrBox = bubble.querySelector('#pay-qr-box');
  const codeBox = bubble.querySelector('#pay-code');
  const valueBox = bubble.querySelector('#pay-value');
  const copyBtn = bubble.querySelector('#pay-copy-btn');
  bubble.dataset.expiresAt = data.expiresAt || '';

  valueBox.textContent = fmtBRL(data.amount_cents || cartTotalCents());
  codeBox.textContent = data.brcode || 'Código PIX indisponível. Aguarde alguns segundos e toque em verificar novamente.';

  if (data.qrcodeImage) {
    qrBox.innerHTML = '';
    const qrImg = document.createElement('img');
    qrImg.src = data.qrcodeImage;
    qrImg.alt = 'QR Code PIX';
    qrImg.width = 220;
    qrImg.height = 220;
    qrImg.style.cssText = 'width:100%;max-width:220px;display:block;margin:0 auto;border-radius:8px';
    qrBox.appendChild(qrImg);
  } else if (window.QRCode && data.brcode) {
    qrBox.innerHTML = '';
    new QRCode(qrBox, { text: data.brcode, width: 220, height: 220, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  } else {
    qrBox.textContent = 'Copie o código abaixo';
  }

  copyBtn.onclick = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(data.brcode || '');
      } else {
        const ta = document.createElement('textarea');
        ta.value = data.brcode || '';
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        if (!document.execCommand('copy')) throw new Error('copy_failed');
        ta.remove();
      }
      track('ClickButton', { content_name: 'Copiar Código PIX' });
      saveLead({ status: 'pix_copied', transaction_id: data.transactionId || '' });
      copyBtn.textContent = 'CÓDIGO COPIADO ✓ ABRA SEU BANCO';
      toast('Código copiado. Agora abra seu banco e cole no PIX.');
      setTimeout(() => { copyBtn.textContent = 'COPIAR CÓDIGO PIX'; }, 3200);
    } catch (e) {
      toast('Selecione e copie o código manualmente.');
    }
  };

  startExpireCountdown(bubble, data.expiresAt);
}


/* Timer real, baseado no expiresAt que a própria BlackCat devolve —
   nunca inventamos um prazo, só mostramos o que é verdade. */
function startExpireCountdown(bubble, expiresAtIso) {
  const el = bubble.querySelector('#pay-expire');
  if (!el) return;
  if (!expiresAtIso) { el.style.display = 'none'; return; }
  const target = new Date(expiresAtIso).getTime();
  if (isNaN(target)) { el.style.display = 'none'; return; }

  if (bubble._expireInterval) {
    clearInterval(bubble._expireInterval);
    bubble._expireInterval = null;
  }

  el.style.display = 'block';

  function formatRemaining(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min`;
    }
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function tick() {
    const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
    el.textContent = left > 0
      ? ('Esse código expira em ' + formatRemaining(left))
      : 'Código expirado — gere um novo para continuar.';
    if (left <= 0 && bubble._expireInterval) {
      clearInterval(bubble._expireInterval);
      bubble._expireInterval = null;
    }
  }

  tick();
  bubble._expireInterval = setInterval(tick, 1000);
}

function paymentExpired(paymentInfo) {
  if (!paymentInfo || !paymentInfo.expiresAt) return false;
  const timestamp = new Date(paymentInfo.expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function offerPixRegeneration(bubble, resolve) {
  const statusText = bubble.querySelector('#pay-status-text');
  const copyBtn = bubble.querySelector('#pay-copy-btn');
  const checkBtn = bubble.querySelector('#pay-check-btn');
  const regenerateBtn = bubble.querySelector('#pay-regenerate-btn');
  if (statusText) statusText.textContent = 'Este código expirou. Gere um novo PIX para continuar.';
  if (copyBtn) copyBtn.disabled = true;
  if (checkBtn) checkBtn.disabled = true;
  if (!regenerateBtn) return;
  regenerateBtn.hidden = false;
  regenerateBtn.onclick = () => {
    regenerateBtn.disabled = true;
    state.payment = null;
    saveProgress('grp-checkout-pagamento', null, state.currentBlockIndex);
    bubble.remove();
    runPaymentBlock().then(resolve);
  };
}

function appendPaymentError(message, onRetry) {
  const wrap = document.createElement('div');
  wrap.className = 'msg bot payment-msg payment-error';
  wrap.textContent = message + '\n\nSe isso acontecer, toque em tentar novamente. Você não será cobrado duas vezes apenas por gerar um novo código.';
  thread.appendChild(wrap);
  scrollBottom();
  showChoices([{ content: '🔄 Tentar novamente' }], () => { wrap.remove(); onRetry(); });
}

async function generatePix() {
  const payload = {
    session_id: state.sessionId,
    name: state.vars.nome || '',
    phone: (state.vars.whatsapp || '').replace(/\D+/g, ''),
    document: (state.vars.cpf || '').replace(/\D+/g, ''),
    bumps: selectedBumpIds(),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let r;
  try {
    r = await fetch('/api/create-pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    if (!navigator.onLine) throw new Error('Você está sem conexão. Conecte-se à internet e tente novamente.');
    if (e && e.name === 'AbortError') throw new Error('A operadora demorou para responder. Tente novamente sem fechar esta conversa.');
    throw new Error('Não consegui conectar à operadora agora. Verifique sua internet e tente novamente.');
  } finally {
    clearTimeout(timeout);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(data.message || 'Não foi possível gerar o PIX.');
  return data;
}

async function runPaymentBlock() {
  clearInputZone();

  // Retomando uma sessão com PIX já gerado (ex.: página recarregou)?
  const resumed = state.payment || (loadProgress() && loadProgress().payment);
  if (resumed && resumed.transactionId) {
    if (paymentExpired(resumed)) {
      state.payment = null;
      saveProgress('grp-checkout-pagamento', null, state.currentBlockIndex);
      appendMessage('Seu PIX anterior expirou. Vou gerar um novo código com o mesmo pedido, sem cobrança duplicada.', 'bot');
    } else {
      state.payment = resumed;
      return resumeExistingPayment(resumed);
    }
  }

  const typing = showTyping();
  let data;
  try {
    data = await generatePix();
    typing.remove();
  } catch (e) {
    typing.remove();
    return new Promise(resolve => {
      appendPaymentError(e.message || 'Não foi possível gerar o PIX agora. Vamos tentar de novo?', () => {
        runPaymentBlock().then(resolve);
      });
    });
  }

  track('InitiateCheckout', {
    content_name: 'Oração Sagrada de São Bento',
    content_id: 'oracaosaobento',
    content_type: 'product',
    currency: 'BRL',
    value: cartTotalCents() / 100,
  });
  saveLead({
    status: 'pix_generated',
    transaction_id: data.transactionId || '',
    amount_cents: data.amount_cents || cartTotalCents(),
    bumps: selectedBumpIds().join(','),
  });
  state.payment = {
    transactionId: data.transactionId,
    amount_cents: data.amount_cents,
    expiresAt: data.expiresAt,
    brcode: data.brcode,
    qrcodeImage: data.qrcodeImage,
  };
  saveProgress('grp-checkout-pagamento', state.payment);

  const bubble = appendPaymentBubble();
  fillPaymentBubble(bubble, data);
  appendPixVoiceAfterDelay();

  return new Promise(resolve => {
    pollPayment(data.transactionId, bubble, resolve);
  });
}

async function resumeExistingPayment(paymentInfo) {
  appendMessage('Vamos continuar de onde paramos — deixei seu PIX aqui de novo com o passo a passo:', 'bot');
  const bubble = appendPaymentBubble();
  try {
    const r = await fetch('/api/check-payment?id=' + encodeURIComponent(paymentInfo.transactionId) + '&sid=' + encodeURIComponent(state.sessionId), { cache: 'no-store' });
    const d = await r.json();
    if (d.ok && d.status === 'paid') {
      bubble.remove();
      state.vars.paidTransactionId = paymentInfo.transactionId;
      updateWhatsappMasked();
      savePaidOrder(paymentInfo.transactionId);
      state.payment = null;
      clearProgress();
      clearPrivateState();
      return; // segue o fluxo normal; o download já ficará autorizado
    }
    const restored = (d.ok && d.brcode) ? d : paymentInfo;
    state.payment = {
      transactionId: paymentInfo.transactionId,
      brcode: restored.brcode || paymentInfo.brcode || '',
      qrcodeImage: restored.qrcodeImage || paymentInfo.qrcodeImage || null,
      amount_cents: restored.amount_cents || paymentInfo.amount_cents || cartTotalCents(),
      expiresAt: restored.expiresAt || paymentInfo.expiresAt || null
    };
    saveProgress('grp-checkout-pagamento', state.payment);
    fillPaymentBubble(bubble, state.payment);
    appendPixVoiceAfterDelay();
  } catch (e) {
    state.payment = paymentInfo;
    saveProgress('grp-checkout-pagamento', state.payment);
    fillPaymentBubble(bubble, paymentInfo);
  }
  return new Promise(resolve => {
    pollPayment(paymentInfo.transactionId, bubble, resolve);
  });
}



function appendPixVoiceAfterDelay() {
  window.setTimeout(() => {
    if (!document.querySelector('.payment-msg')) return;
    const content = {
        title: 'Mensagem de voz de Frei Gilson',
        url: 'audio-06-como-pagar-pix.mp3',
        duration: 21,
        fallback: 'Se o áudio não tocar, fique em paz: copie o código PIX, abra seu banco, cole em Pix Copia e Cola e confirme.'
    };
    prepareAndAppendAudio(content, 320, 720);
  }, 900 + Math.round(Math.random() * 700));
}


async function checkPaymentOnce(transactionId) {
  const r = await fetch('/api/check-payment?id=' + encodeURIComponent(transactionId) + '&sid=' + encodeURIComponent(state.sessionId), { cache: 'no-store' });
  return await r.json();
}

async function pollPayment(transactionId, bubble, resolve) {
  const statusText = bubble.querySelector('#pay-status-text');
  const checkBtn = bubble.querySelector('#pay-check-btn');
  let tries = 0;
  let done = false;
  let interval = null;
  let checking = false;
  const timers = [];

  function cleanup() {
    done = true;
    if (interval) clearInterval(interval);
    timers.forEach(t => clearTimeout(t));
    if (checkBtn) checkBtn.disabled = true;
  }

  async function markPaid() {
    if (done) return;
    cleanup();
    statusText.textContent = 'Pagamento confirmado! ✅';
    state.vars.paidTransactionId = transactionId;
    updateWhatsappMasked();
    savePaidOrder(transactionId);
    state.payment = null;
    saveLead({ status: 'completed', transaction_id: transactionId, amount_cents: cartTotalCents(), bumps: selectedBumpIds().join(',') });
    clearProgress();
    clearPrivateState();
    resolve();
  }

  async function checkNow(manual = false) {
    if (done || checking) return;
    if (paymentExpired(state.payment)) {
      cleanup();
      offerPixRegeneration(bubble, resolve);
      return;
    }
    checking = true;
    if (manual) {
      track('ClickButton', { content_name: 'Já paguei - verificar agora' });
      saveLead({ status: 'pix_manual_check', transaction_id: transactionId });
    }
    if (checkBtn) checkBtn.disabled = true;
    const previous = statusText.textContent;
    statusText.textContent = manual ? 'Verificando seu pagamento agora…' : previous;
    try {
      const d = await checkPaymentOnce(transactionId);
      if (!d.ok && d.message && manual) statusText.textContent = d.message;
      if (d.ok && d.status === 'paid') {
        await markPaid();
        return;
      }
      if (manual) {
        statusText.textContent = (state.vars.apelido ? state.vars.apelido + ', ' : '') + 'ainda não apareceu aqui. Às vezes o banco demora alguns segundos. Vou continuar verificando automaticamente.';
      }
    } catch (e) {
      if (manual) statusText.textContent = 'Não consegui verificar agora. Vou continuar tentando automaticamente.';
    } finally {
      checking = false;
      if (checkBtn && !done) checkBtn.disabled = false;
    }
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', () => checkNow(true));
  }

  // Ao voltar do aplicativo do banco, Android/iOS podem congelar timers.
  // Fazemos uma verificação imediata ao recuperar foco/visibilidade.
  const onReturnToPage = () => {
    if (!done && document.visibilityState !== 'hidden') checkNow(false);
  };
  document.addEventListener('visibilitychange', onReturnToPage);
  window.addEventListener('pageshow', onReturnToPage);
  window.addEventListener('focus', onReturnToPage);
  const originalCleanup = cleanup;
  cleanup = function () {
    document.removeEventListener('visibilitychange', onReturnToPage);
    window.removeEventListener('pageshow', onReturnToPage);
    window.removeEventListener('focus', onReturnToPage);
    originalCleanup();
  };

  timers.push(setTimeout(() => {
    if (done) return;
    appendMessage((state.vars.apelido ? state.vars.apelido + ', ' : '') + 'se você já copiou o código, agora é só abrir o app do banco e colar em Pix Copia e Cola. Eu fico aguardando a confirmação por aqui.', 'bot');
  }, 65000));

  timers.push(setTimeout(() => {
    if (done) return;
    appendMessage('Se preferir, toque em copiar novamente. Às vezes o celular não copia na primeira tentativa.', 'bot');
  }, 125000));

  interval = setInterval(async () => {
    if (done) return;
    tries++;
    if (tries === 3) {
      statusText.textContent = (state.vars.apelido ? state.vars.apelido + ', ' : '') + 'se o banco demorar alguns segundos para confirmar, é normal. Pode aguardar nesta tela.';
    }
    await checkNow(false);
    if (tries >= POLL_MAX_TRIES && !done) {
      if (interval) clearInterval(interval);
      interval = null;
      statusText.textContent = 'A confirmação automática está demorando. Se você já pagou, toque em “Já paguei” para verificar agora.';
      if (checkBtn) checkBtn.disabled = false;
    }
  }, POLL_INTERVAL_MS);
}

/* ═══════ Motor da conversa ═══════ */

function appendDownloadCard(content) {
  const url = content && content.url;
  if (!url) return null;

  const wrap = document.createElement('div');
  wrap.className = 'msg bot download-msg';

  const title = document.createElement('div');
  title.className = 'download-title';
  title.textContent = content.title || 'Arquivo liberado';

  const desc = document.createElement('div');
  desc.className = 'download-desc';
  desc.textContent = content.description || 'Toque abaixo para baixar o arquivo.';

  const link = document.createElement('a');
  link.className = 'download-btn';
  link.href = buildSecureDownloadUrl(url);
  link.download = '';
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = content.button || 'BAIXAR ORAÇÃO';
  link.addEventListener('click', (e) => {
    link.href = buildSecureDownloadUrl(url);
    if (link.href.endsWith('#')) {
      e.preventDefault();
      toast('Aguarde a confirmação do pagamento para liberar sua oração.');
      return;
    }
    track('ClickButton', { content_name: 'Baixar Oração de São Bento' });
    saveLead({ status: 'pdf_downloaded', transaction_id: state.vars.paidTransactionId || state.vars.currentTransactionId || '' });
  });

  wrap.appendChild(title);
  wrap.appendChild(desc);
  wrap.appendChild(link);
  thread.appendChild(wrap);
  scrollBottom();
  return wrap;
}

function persistChoiceVars(item) {
  const painMap = {
    'itm-inv': 'Inveja / olho gordo',
    'itm-bri': 'Brigas / desunião em casa',
    'itm-sau': 'Saúde de alguém',
    'itm-pro': 'Proteção da casa e família'
  };
  const targetMap = {
    'itm-mim': 'Para mim mesmo(a)',
    'itm-filho': 'Para meu filho ou filha',
    'itm-conj': 'Para meu marido ou esposa',
    'itm-fam': 'Para toda minha família'
  };
  if (painMap[item.id]) {
    state.vars.dor = painMap[item.id];
    saveLead({ status: 'dor_' + item.id.replace('itm-', '') });
  }
  if (targetMap[item.id]) {
    state.vars.para_quem = targetMap[item.id];
    saveLead({ status: 'para_quem_' + item.id.replace('itm-', '') });
  }
  updateDerivedVars();
}

async function renderBlock(block) {
  const showIfMissing = block.options && block.options.showIfMissing;
  if (showIfMissing && String(state.vars[showIfMissing] || '').trim() !== '') return;
  const showIfBump = block.options && block.options.showIfBump;
  if (showIfBump && !state.bumps[showIfBump]) return;
  const milestoneStatus = {
    'blk-ofe1': 'view_offer',
    'aud-09-orientacao-cadastro': 'view_checkout_registration',
    'blk-cpf-intro': 'view_cpf',
    'blk-resumo-txt': 'view_order_summary',
    'blk-payment': 'view_payment',
    'blk-download-oracao': 'view_download',
    'blk-audio-whatsapp': 'view_audio_whatsapp_delivery'
  };
  if (milestoneStatus[block.id]) saveLead({ status: milestoneStatus[block.id] });
  if (block.type === 'audio') {
    await prepareAndAppendAudio(block.content || {});
    await conversationalPause(1200, 1900);
    return;
  }

  if (block.type === 'download') {
    appendDownloadCard(block.content || {});
    await skippableSleep(POST_TYPING_DELAY);
    return;
  }

  if (block.type === 'image') {
    appendImage(block.content && block.content.url, block.content && block.content.alt || 'Imagem do complemento');
    return;
  }

  if (block.type === 'text') {
    const text = interpolate(block.content && block.content.text || '');
    if (!text) return;
    if (shouldShowTyping(text)) {
      const typing = showTyping();
      await skippableSleep(typingDelay(text));
      typing.remove();
    } else {
      await conversationalPause(900, 1500);
    }
    if (block.id === 'blk-resumo-txt') appendOrderSummary();
    else appendMessage(text, 'bot');
    await readingPause(text);
    return;
  }

  if (block.type === 'choice input') {
    await conversationalPause(900, 1500);
    await new Promise(resolve => {
      showChoices(block.items, (item) => {
        appendMessage(item.content, 'user');
        clearInputZone();
        track('ClickButton', { content_name: item.content, dor: state.vars.dor || '', para_quem: state.vars.para_quem || '' });
        persistChoiceVars(item);
        saveProgress(state.currentGroupId || '');
        if (item.meta && typeof item.meta.bump === 'number') {
          const bumpId = item.meta.bump;
          state.bumps[bumpId] = !!item.meta.value;
          saveProgress(state.currentGroupId || '');
          if (item.meta.value) {
            const b = SB_BUMPS[bumpId];
            track('AddToCart', { content_name: b.name, content_id: 'bump' + bumpId, content_type: 'product', currency: 'BRL', value: b.price_cents / 100 });
          }
        }
        const edge = state.edgeByItem.get(item.id);
        resolve({ edge });
      });
    }).then(({ edge }) => {
      if (edge) state.nextEdge = edge;
      else state.nextEdge = null;
    });
    return;
  }

  if (block.type === 'text input') {
    await conversationalPause(850, 1400);
    const kind = (block.options && block.options.kind) || 'text';
    await new Promise(resolve => {
      showTextInput(block.options || {}, async (value, meta = {}) => {
        const varName = (block.options && block.options.variable) || null;
        if (varName) {
          state.vars[varName] = value;
          if (varName === 'nome' || varName === 'primeiro_nome') state.vars.apelido = makeApelido(value);
          savePrivateState();
        }
        const displayedValue = kind === 'cpf' ? 'CPF informado com segurança ✓' : value;
        appendMessage(meta.skipped ? ((block.options && block.options.skipButton) || 'Prefiro não responder agora') : displayedValue, 'user');
        clearInputZone();
        saveLead({ status: 'progress' });
        saveProgress(state.currentGroupId || (state.blockMap.get(block.id) && state.blockMap.get(block.id).groupId) || '');

        if (kind === 'phone') {
          track('Lead', { content_name: 'Funil Conversa - Oração São Bento' });
        }
        if (kind === 'cpf') {
          track('AddPaymentInfo', { content_name: 'Oração Sagrada de São Bento', currency: 'BRL', value: cartTotalCents() / 100 });
        }

        resolve();
      });
    });
    await conversationalPause(900, 1500);
    const inputEdge = state.edgeByBlock.get(block.id);
    if (inputEdge) state.nextEdge = inputEdge;
    return;
  }

  if (block.type === 'compute') {
    const action = block.options && block.options.action;
    if (action === 'buildResumo') buildResumo();
    return;
  }

  if (block.type === 'payment') {
    await runPaymentBlock();
    return;
  }

  if (block.type === 'Redirect') {
    const url = (block.options && block.options.url) || CHECKOUT_URL;
    await finishAndRedirect(url);
    return;
  }
}

async function runGroup(groupId, startBlockIndex = 0) {
  state.currentGroupId = groupId;
  state.currentBlockIndex = Math.max(0, Number(startBlockIndex) || 0);
  if (groupId === 'grp-obrigado') {
    clearProgress();
  } else {
    saveProgress(groupId, undefined, state.currentBlockIndex);
  }

  const ids = state.groupBlockOrder.get(groupId) || [];
  for (let i = state.currentBlockIndex; i < ids.length; i++) {
    state.currentBlockIndex = i;
    const block = state.blockMap.get(ids[i]).block;
    state.nextEdge = undefined;
    await renderBlock(block);

    if (state.doneRedirect) return;

    if (state.nextEdge === null) {
      return;
    }
    if (state.nextEdge) {
      const target = state.nextEdge.to && state.nextEdge.to.groupId;
      if (target) return runGroup(target);
      return;
    }

    const blockEdge = state.edgeByBlock.get(block.id);
    if (blockEdge && i === ids.length - 1) {
      const target = blockEdge.to && blockEdge.to.groupId;
      if (target) return runGroup(target);
    }
    if (groupId !== 'grp-obrigado') saveProgress(groupId, undefined, i + 1);
  }
}

/* Mantido só como fallback legado — não é mais usado no fluxo principal,
   já que o pagamento acontece dentro do próprio chat agora. */
async function finishAndRedirect(url) {
  state.doneRedirect = true;
  await saveLead({ status: 'completed' });
  const target = buildCheckoutURL(url);
  await sleep(400);
  location.href = target;
}

function buildCheckoutURL(base) {
  const u = new URL(base, location.origin);
  if (state.vars.nome) u.searchParams.set('nome', state.vars.nome);
  if (state.vars.whatsapp) u.searchParams.set('whatsapp', state.vars.whatsapp.replace(/\D+/g, ''));
  u.searchParams.set('sid', state.sessionId);
  Object.entries(state.utm).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

async function saveLead(extra) {
  try {
    await fetch('/api/save-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify(Object.assign({
        session_id: state.sessionId,
        nome: state.vars.nome || state.vars.primeiro_nome || '',
        whatsapp: (state.vars.whatsapp || '').replace(/\D+/g, ''),
        dor: state.vars.dor || '',
        para_quem: state.vars.para_quem || '',
        intencao: state.vars.intencao || '',
        bumps: selectedBumpIds().join(','),
        amount_cents: cartTotalCents(),
      }, state.utm, extra || {}))
    });
  } catch (e) {}
}

function track(event, properties) {
  const eventId = state.sessionId + ':' + event + ':' + (++trackingSequence) + ':' + Date.now();
  try {
    window.ttq && ttq.track && ttq.track(event, properties || {});
  } catch (e) {}
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event,
        event_id: eventId,
        session_id: state.sessionId,
        ttclid: state.utm.ttclid || '',
        properties: properties || {}
      })
    });
  } catch (e) {}
}

async function start() {
  let fn;
  try {
    const res = await fetch(FUNNEL_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    fn = await res.json();
  } catch (e) {
    appendMessage('Não consegui carregar a conversa agora. Tente recarregar a página.', 'bot');
    return;
  }
  indexFunnel(fn);
  track('ViewContent', { content_name: 'Funil Conversa - Oração São Bento' });

  // Retomando uma conversa salva (ex.: página recarregou no meio do caminho)?
  const saved = loadProgress();
  if (saved && saved.currentGroupId && saved.currentGroupId !== 'grp-acolhimento') {
    state.vars = saved.vars || {};
    state.bumps = Object.assign({ 5: false }, saved.bumps || {});
    [2, 3, 4].forEach(id => { delete state.bumps[id]; });
    if (saved.sessionId) state.sessionId = saved.sessionId;
    state.payment = saved.payment || null;

    const checkoutGroups = new Set(['grp-bump-audio','grp-checkout-resumo']);
    if (checkoutGroups.has(saved.currentGroupId) && (!state.vars.nome || !state.vars.whatsapp || !state.vars.cpf)) {
      state.bumps = { 5: false };
      state.payment = null;
      appendMessage('Para proteger seus dados, preciso confirmar novamente o cadastro antes de continuar seu pedido.', 'bot');
      await runGroup('grp-checkout-cpf');
      return;
    }

    if (!state.groupBlockOrder.has(saved.currentGroupId)) {
      clearProgress();
      state.payment = null;
      const freshStart = state.edgeByEvent.get('evt-start');
      if (!freshStart) {
        appendMessage('Funil sem ponto de partida.', 'bot');
        return;
      }
      await runGroup(freshStart.to.groupId);
      return;
    } else if (saved.payment && saved.payment.transactionId) {
      await runGroup('grp-checkout-pagamento');
      return;
    }

    const typing = showTyping();
    await skippableSleep(1200);
    typing.remove();
    updateDerivedVars();
    const greet = state.vars.apelido ? ('Que bom te ver de novo, ' + state.vars.apelido + '! Vamos continuar de onde a gente parou. 🙏') : 'Que bom te ver de novo! Vamos continuar de onde a gente parou. 🙏';
    appendMessage(greet, 'bot');
    await skippableSleep(POST_TYPING_DELAY);
    await runGroup(saved.currentGroupId, saved.nextBlockIndex || 0);
    return;
  }

  const startEdge = state.edgeByEvent.get('evt-start');
  if (!startEdge) {
    appendMessage('Funil sem ponto de partida.', 'bot');
    return;
  }
  await runGroup(startEdge.to.groupId);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

})();
