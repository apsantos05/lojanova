'use client';

import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import styles from './checkout.module.css';

type Step = 'name' | 'phone' | 'cpf' | 'bump' | 'review' | 'pix' | 'paid';
type Message = { id: string; from: 'assistant' | 'user'; text: string; private?: boolean };
type Payment = {
  transactionId: string;
  status: string;
  amount_cents: number;
  brcode: string;
  qrcodeImage?: string | null;
  expiresAt?: string | null;
};

const ORDER_KEY = 'cc_youtube_order_v1';
const SESSION_KEY = 'cc_youtube_session_v1';

const prompts: Record<Step, string> = {
  name: 'Vamos fazer isso com calma. Para começar, qual é o seu nome e sobrenome?',
  phone: 'Obrigado. Agora digite seu WhatsApp com DDD. Se você escolher o áudio adicional, é nesse número que a equipe fará o envio depois da confirmação.',
  cpf: 'Na próxima etapa, o processador do PIX exige o CPF do titular. Ele será usado somente para gerar o pagamento e não será mostrado nem salvo nesta conversa.',
  bump: 'Você quer incluir também o Áudio Completo da Oração Sagrada de São Bento por R$ 9,90? Ele é opcional e será enviado manualmente pelo WhatsApp após a confirmação.',
  review: 'Confira seu pedido antes de gerar o PIX.',
  pix: 'Seu PIX está pronto. Copie o código abaixo e pague no aplicativo do seu banco.',
  paid: 'Pagamento confirmado. Sua oração já está disponível.',
};

function newSession() {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
  const id = crypto.randomUUID().replaceAll('-', '');
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

function validCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length < 11; length += 1) {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    if (Number(cpf[length]) !== ((10 * sum) % 11) % 10) return false;
  }
  return true;
}

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function utms() {
  const params = new URLSearchParams(location.search);
  return Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ttclid'].map((key) => [key, (params.get(key) || '').slice(0, 200)]));
}

export function CheckoutAssistant() {
  const [step, setStep] = useState<Step>('name');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', from: 'assistant', text: 'Que a paz esteja com você. Este é o assistente digital da Contemplação Católica. Vou ajudar a finalizar com calma, uma etapa por vez.' },
    { id: 'prompt-name', from: 'assistant', text: prompts.name },
  ]);
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [bump, setBump] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const checkingPaymentRef = useRef(false);
  const [sessionId, setSessionId] = useState('');
  const total = 2290 + (bump ? 990 : 0);
  const progress = step === 'name' ? 1 : step === 'phone' ? 2 : step === 'cpf' ? 3 : 4;

  useEffect(() => {
    const timer = window.setTimeout(() => setSessionId(newSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const add = useCallback((from: Message['from'], text: string, privateValue = false) => {
    setMessages((current) => [...current, { id: crypto.randomUUID(), from, text, private: privateValue }]);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, step, error, payment]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setTimeout(() => {
      const raw = localStorage.getItem(ORDER_KEY);
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Payment & { sessionId?: string; bump?: boolean };
        if (!saved.transactionId || saved.sessionId !== sessionId) return;
        setBump(Boolean(saved.bump));
        setPayment(saved);
        setStep('pix');
        setMessages((current) => [
          ...current,
          { id: 'resume', from: 'assistant', text: 'Encontrei um PIX já gerado nesta sessão. Vou retomar de onde você parou.' },
          { id: 'resume-pix', from: 'assistant', text: prompts.pix },
        ]);
      } catch {
        localStorage.removeItem(ORDER_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionId]);

  const transactionId = payment?.transactionId || '';

  const checkPayment = useCallback(async () => {
    if (!transactionId || !sessionId || checkingPaymentRef.current) return;
    checkingPaymentRef.current = true;
    try {
      const response = await fetch(`/api/check-payment?id=${encodeURIComponent(transactionId)}&sid=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) return;
      if (data.status === 'paid') {
        setPayment((current) => current ? { ...current, ...data } : current);
        setStep('paid');
        add('assistant', prompts.paid);
        localStorage.removeItem(ORDER_KEY);
      }
    } catch {
      // O polling tenta novamente; não interrompe o usuário por instabilidade breve.
    } finally {
      checkingPaymentRef.current = false;
    }
  }, [add, sessionId, transactionId]);

  useEffect(() => {
    if (step !== 'pix' || !transactionId) return;
    const initialTimer = window.setTimeout(() => void checkPayment(), 0);
    const timer = window.setInterval(() => void checkPayment(), 8000);
    const resume = () => void checkPayment();
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialTimer);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [checkPayment, step, transactionId]);

  useEffect(() => {
    if (!payment?.expiresAt || step !== 'pix') {
      const timer = window.setTimeout(() => setExpired(false), 0);
      return () => window.clearTimeout(timer);
    }
    const update = () => setExpired(Date.parse(payment.expiresAt || '') <= Date.now());
    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [payment?.expiresAt, step]);

  function next(nextStep: Step, userText: string, assistantText: string, privateValue = false) {
    add('user', userText, privateValue);
    add('assistant', assistantText);
    setStep(nextStep);
    setInput('');
    setError('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (step === 'name') {
      if (value.split(/\s+/).length < 2) return setError('Digite seu nome e sobrenome.');
      setName(value.slice(0, 80));
      next('phone', value.slice(0, 80), prompts.phone);
      return;
    }
    if (step === 'phone') {
      const number = digits(value);
      if (number.length < 10 || number.length > 11) return setError('Digite um WhatsApp válido com DDD.');
      setPhone(number);
      next('cpf', value, prompts.cpf);
      return;
    }
    if (step === 'cpf') {
      const number = digits(value);
      if (!validCpf(number)) return setError('Confira os 11 números do CPF e tente novamente.');
      setCpf(number);
      next('bump', 'CPF informado com segurança', prompts.bump, true);
    }
  }

  function chooseBump(selected: boolean) {
    setBump(selected);
    next('review', selected ? 'Sim, incluir o áudio por R$ 9,90' : 'Não, continuar sem o áudio', prompts.review);
  }

  async function createPix() {
    if (!sessionId) {
      setError('A sessão ainda está sendo preparada. Aguarde um instante e tente novamente.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, name, phone, document: cpf, bumps: bump ? [5] : [] }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível gerar o PIX.');
      const created: Payment = data;
      setPayment(created);
      setStep('pix');
      setCpf('');
      add('assistant', prompts.pix);
      localStorage.setItem(ORDER_KEY, JSON.stringify({ ...created, sessionId, bump }));
      void fetch('/api/save-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          nome: name,
          whatsapp: phone,
          status: 'youtube_pix_created',
          bumps: bump ? '5' : '',
          amount_cents: total,
          transaction_id: created.transactionId,
          ...utms(),
        }),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o PIX. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    if (!payment?.brcode) return;
    try {
      await navigator.clipboard.writeText(payment.brcode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Não foi possível copiar automaticamente. Toque e segure o código para selecionar.');
    }
  }

  function removeBump() {
    setBump(false);
    add('user', 'Remover o áudio adicional');
    add('assistant', 'Pronto. O áudio foi removido e o total voltou para R$ 22,90.');
  }

  function restartExpiredPix() {
    localStorage.removeItem(ORDER_KEY);
    setPayment(null);
    setName('');
    setPhone('');
    setCpf('');
    setInput('');
    setStep('name');
    setMessages([
      { id: crypto.randomUUID(), from: 'assistant', text: 'O PIX expirou. Vamos gerar um novo com segurança.' },
      { id: crypto.randomUUID(), from: 'assistant', text: prompts.name },
    ]);
  }

  const label = step === 'name' ? 'Nome completo' : step === 'phone' ? 'WhatsApp com DDD' : 'CPF do titular';
  const inputMode = step === 'name' ? 'text' : 'numeric';

  return (
    <main className={styles.page}>
      <section className={styles.chat} aria-labelledby="checkout-title">
        <header className={styles.header}>
          <a href="/youtube" className={styles.back} aria-label="Voltar para a apresentação">‹</a>
          <Image src="/youtube/apresentador.webp" alt="" width={48} height={48} />
          <div>
            <h1 id="checkout-title">Assistente digital de pagamento</h1>
            <p><span aria-hidden="true" /> orientação automática</p>
          </div>
        </header>

        <div className={styles.progress} aria-label={`Etapa ${progress} de 4`}>
          <span>Etapa {progress} de 4</span>
          <div><i style={{ width: `${progress * 25}%` }} /></div>
        </div>

        <div className={styles.thread} aria-live="polite">
          <div className={styles.safety}>🔒 Pagamento protegido. Seus dados não aparecem nas mensagens.</div>
          {messages.map((message) => (
            <div key={message.id} className={`${styles.bubble} ${message.from === 'user' ? styles.user : styles.assistant}`}>
              {message.private ? '🔒 ' : ''}{message.text}
            </div>
          ))}

          {step === 'bump' ? (
            <div className={styles.choice}>
              <button type="button" onClick={() => chooseBump(true)}>
                <strong>Sim, incluir por R$ 9,90</strong>
                <span>Envio manual pelo WhatsApp após o pagamento</span>
              </button>
              <button type="button" className={styles.secondary} onClick={() => chooseBump(false)}>
                Não, continuar por R$ 22,90
              </button>
            </div>
          ) : null}

          {step === 'review' ? (
            <section className={styles.summary} aria-label="Resumo do pedido">
              <h2>Resumo do seu pedido</h2>
              <div>
                <span>
                  Oração Sagrada de São Bento
                  <small>Aproximadamente R$ 3,27 por dia durante 7 dias</small>
                </span>
                <strong>R$ 22,90</strong>
              </div>
              {bump ? (
                <div>
                  <span>Áudio completo <button type="button" onClick={removeBump}>Remover</button></span>
                  <strong>R$ 9,90</strong>
                </div>
              ) : null}
              <div className={styles.total}><span>Total</span><strong>{money(total)}</strong></div>
              <button type="button" className={styles.primary} onClick={createPix} disabled={busy}>
                {busy ? 'Gerando PIX com segurança…' : `Gerar PIX de ${money(total)}`}
              </button>
              <p>Pagamento único. Nenhum frete ou produto físico. Resultados específicos não são garantidos.</p>
            </section>
          ) : null}

          {step === 'pix' && payment ? (
            <section className={styles.pix} aria-label="Pagamento PIX">
              {expired ? (
                <div className={styles.expired} role="alert">
                  <strong>Este PIX expirou.</strong>
                  <span>Volte ao resumo e gere um novo código para pagar com segurança.</span>
                  <button type="button" onClick={restartExpiredPix}>Gerar novo PIX</button>
                </div>
              ) : (
                <>
                  <div className={styles.qr}>
                    {/* A imagem vem do processador PIX e pode ser data URL ou URL temporária. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {payment.qrcodeImage ? <img src={payment.qrcodeImage} alt="QR Code do PIX" /> : <QRCodeSVG value={payment.brcode} size={210} level="M" />}
                  </div>
                  <strong className={styles.pixTotal}>{money(payment.amount_cents)}</strong>
                  <label htmlFor="pix-code">Código PIX Copia e Cola</label>
                  <textarea id="pix-code" readOnly value={payment.brcode} rows={3} />
                  <button type="button" className={styles.primary} onClick={copyPix}>{copied ? 'Código copiado ✓' : 'Copiar código PIX'}</button>
                  <ol>
                    <li>Abra o aplicativo do seu banco.</li>
                    <li>Escolha PIX e depois “Copia e Cola”.</li>
                    <li>Cole o código e confirme o valor.</li>
                    <li>Volte para esta página. A confirmação é automática.</li>
                  </ol>
                  <button type="button" className={styles.check} onClick={() => void checkPayment()}>Já paguei — verificar agora</button>
                </>
              )}
            </section>
          ) : null}

          {step === 'paid' && payment ? (
            <section className={styles.paid}>
              <div aria-hidden="true">✓</div>
              <h2>Pagamento confirmado</h2>
              <a className={styles.primary} href={`/api/download-oracao?id=${encodeURIComponent(payment.transactionId)}&sid=${encodeURIComponent(sessionId)}`}>
                Baixar minha oração
              </a>
              {bump ? <p>O áudio adicional será enviado manualmente para o WhatsApp informado no pedido.</p> : null}
            </section>
          ) : null}

          {error ? <div ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{error}</div> : null}
          <div ref={endRef} />
        </div>

        {['name', 'phone', 'cpf'].includes(step) ? (
          <form className={styles.composer} onSubmit={submit}>
            <label htmlFor="checkout-input">{label}</label>
            <div>
              <input
                id="checkout-input"
                name={step}
                type={step === 'phone' ? 'tel' : 'text'}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (error) setError('');
                }}
                inputMode={inputMode}
                autoComplete={step === 'name' ? 'name' : step === 'phone' ? 'tel' : 'off'}
                enterKeyHint="send"
                maxLength={step === 'name' ? 80 : 18}
                placeholder={step === 'name' ? 'Digite seu nome e sobrenome…' : step === 'phone' ? '(11) 99999-9999…' : '000.000.000-00…'}
                aria-describedby="input-help"
              />
              <button type="submit" aria-label="Enviar resposta">➤</button>
            </div>
            <small id="input-help">{step === 'cpf' ? 'O número não será exibido nem salvo nesta conversa.' : 'Confira e toque na seta verde para continuar.'}</small>
          </form>
        ) : null}
      </section>
    </main>
  );
}
