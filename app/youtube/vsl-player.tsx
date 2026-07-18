'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useRef, useState } from 'react';
import styles from './youtube.module.css';

const VIDEO_URL = 'https://bms0corilnnjspwi.public.blob.vercel-storage.com/videos/oracao-sagrada-sao-bento-vsl.mp4';
const CTA_AT_SECONDS = 1800;
const WATCH_KEY = 'cc_youtube_watch_v2';
const GUIDANCE = [
  { at: 0, text: 'Se o áudio estiver baixo, use o controle de volume do próprio vídeo ou do celular.' },
  { at: 120, text: 'Assista com calma. Você pode pausar e continuar nesta mesma sessão.' },
  { at: 900, text: 'Ter dificuldade para manter a constância não significa falta de fé. O importante é retomar com serenidade.' },
  { at: 1765, text: 'A orientação final e o próximo passo serão liberados automaticamente em instantes.' },
] as const;

function checkoutHref() {
  const params = new URLSearchParams(window.location.search);
  const allowed = new URLSearchParams();
  for (const [key, value] of params) {
    if (/^(utm_[a-z0-9_]+|src|sck|xcod)$/i.test(key)) allowed.set(key, value.slice(0, 180));
  }
  const query = allowed.toString();
  return `/youtube/finalizar-pagamento${query ? `?${query}` : ''}`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function VslPlayer({ children }: { children?: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [showCta, setShowCta] = useState(false);
  const [href, setHref] = useState('/youtube/finalizar-pagamento');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHref(checkoutHref());
      const watched = Number(sessionStorage.getItem(WATCH_KEY) || 0);
      if (Number.isFinite(watched) && watched >= CTA_AT_SECONDS) setShowCta(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function showFlash(icon: 'play' | 'pause') {
    setFlash(icon);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 600);
  }

  async function startPlayback() {
    const video = videoRef.current;
    if (!video) return;
    setMediaError('');
    setStarted(true);
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
      setMuted(false);
      setVolume(1);
    } catch {
      video.muted = true;
      try {
        await video.play();
        setMuted(true);
        setVolume(0);
      } catch {
        setStarted(false);
        setMediaError('Não foi possível iniciar. Verifique sua conexão e toque novamente.');
      }
    }
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
        showFlash('pause');
      } catch {
        setMediaError('Toque novamente para continuar a reprodução.');
      }
    } else {
      video.pause();
      showFlash('play');
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    if (!nextMuted && video.volume === 0) video.volume = 1;
    setMuted(nextMuted);
    setVolume(nextMuted ? 0 : video.volume);
  }

  function changeVolume(next: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
  }

  function seek(next: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = next;
    setCurrentTime(next);
  }

  async function sharePresentation() {
    const data = {
      title: 'Oração Sagrada de São Bento',
      text: 'Assista a esta apresentação sobre a Oração Sagrada de São Bento.',
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        setShareStatus('Compartilhamento aberto.');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus('Link copiado.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareStatus('Não foi possível compartilhar. Copie o endereço desta página.');
    }
    window.setTimeout(() => setShareStatus(''), 2600);
  }

  async function enterFullscreen() {
    try {
      await frameRef.current?.requestFullscreen();
    } catch {
      setMediaError('A tela cheia não está disponível neste navegador. Gire o celular para ampliar o vídeo.');
    }
  }

  const visibleGuidance = GUIDANCE.filter((item) => currentTime >= item.at);

  return (
    <>
      <section className={styles.playerBox} aria-label="Player da apresentação">
        <div ref={frameRef} className={`${styles.playerFrame} ${started ? styles.started : ''}`}>
          <video
            ref={videoRef}
            className={styles.video}
            src={VIDEO_URL}
            playsInline
            preload="metadata"
            poster="/youtube/capa-vsl.jpg"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setMediaError('O vídeo não pôde ser carregado. Verifique sua internet e tente novamente.')}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => {
              const watched = Math.floor(event.currentTarget.currentTime || 0);
              setCurrentTime(event.currentTarget.currentTime || 0);
              if (watched > 0) sessionStorage.setItem(WATCH_KEY, String(watched));
              if (watched >= CTA_AT_SECONDS) setShowCta(true);
            }}
            aria-label="Apresentação da Oração Sagrada de São Bento"
          />
          <span className={styles.recordedCorner}>APRESENTAÇÃO GRAVADA</span>

          {!started ? (
            <button type="button" className={styles.playOverlay} onClick={startPlayback} aria-label="Reproduzir apresentação">
              <svg viewBox="0 0 68 48" width="72" height="51" aria-hidden="true">
                <path d="M66.5 7.7c-.8-2.9-3-5.1-5.9-5.9C55.3.5 34 .5 34 .5S12.7.5 7.4 1.8C4.5 2.6 2.3 4.8 1.5 7.7.2 13 .2 24 .2 24s0 11 1.3 16.3c.8 2.9 3 5.1 5.9 5.9C12.7 47.5 34 47.5 34 47.5s21.3 0 26.6-1.3c2.9-.8 5.1-3 5.9-5.9C67.8 35 67.8 24 67.8 24s0-11-1.3-16.3z" fill="#f00" />
                <path d="M27 34l18-10-18-10z" fill="#fff" />
              </svg>
              <span>Toque para assistir</span>
            </button>
          ) : null}

          {started ? <button type="button" className={styles.tapZone} onClick={togglePlayback} aria-label={playing ? 'Pausar' : 'Reproduzir'} /> : null}

          {flash ? (
            <span className={styles.pauseFlash} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#fff">
                {flash === 'play' ? <path d="M8 5v14l11-7z" /> : <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />}
              </svg>
            </span>
          ) : null}

          {started && muted ? (
            <button type="button" className={styles.soundBanner} onClick={toggleMute}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
              Toque para ativar o som
            </button>
          ) : null}

          {started ? (
            <div className={styles.controls}>
              <input
                className={styles.progressSlider}
                type="range"
                min="0"
                max={duration || 1}
                step="0.25"
                value={Math.min(currentTime, duration || 1)}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="Progresso do vídeo"
              />
              <button type="button" className={styles.controlButton} onClick={togglePlayback} aria-label={playing ? 'Pausar' : 'Reproduzir'}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
                  {playing ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> : <path d="M8 5v14l11-7z" />}
                </svg>
              </button>
              <div className={styles.volumeWrap}>
                <button type="button" className={styles.controlButton} onClick={toggleMute} aria-label={muted ? 'Ativar som' : 'Silenciar'}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
                    {muted ? <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73L19.73 21 21 19.73z" /> : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77z" />}
                  </svg>
                </button>
                <input
                  className={styles.volumeSlider}
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                  aria-label="Volume"
                />
              </div>
              <span className={styles.timeDisplay}>{formatTime(currentTime)} / {formatTime(duration)}</span>
              <button type="button" className={styles.controlButton} onClick={enterFullscreen} aria-label="Abrir em tela cheia">
                <svg viewBox="0 0 24 24" width="21" height="21" fill="#fff" aria-hidden="true">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {mediaError ? <div className={styles.error} role="alert">{mediaError}</div> : null}

      <div className={styles.videoActions}>
        <button type="button" onClick={sharePresentation}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M15 5.63 20.66 12 15 18.37V15h-1c-3.96 0-7.14 1-9.75 3.09C6.09 14.02 9.36 11.44 15 11.03V8l-1-2.37zM14 3v4C7.45 7.5 3.22 11.33 2 18c2.52-2.84 6.12-4.5 10-4.5h2V20l8-8-8-8z" />
          </svg>
          Compartilhar
        </button>
        <span role="status" aria-live="polite">{shareStatus}</span>
      </div>

      {children}

      {showCta ? (
        <section className={styles.offer} aria-labelledby="offer-title">
          <p>Próximo passo, com calma</p>
          <h2 id="offer-title">Leve a Oração Sagrada de São Bento para seus 7 dias de prática</h2>
          <span>
            Acesso digital por <strong>R$ 22,90</strong>, aproximadamente <strong>R$ 3,27 por dia</strong>.
          </span>
          <Link className={styles.cta} href={href}>CONTINUAR COM AJUDA NO PAGAMENTO</Link>
          <small>Pagamento único por PIX. O áudio completo de R$ 9,90 é opcional e apresentado separadamente.</small>
        </section>
      ) : null}

      <section className={styles.guidance} aria-labelledby="guidance-title">
        <div className={styles.guidanceHeader}>
          <div>
            <h2 id="guidance-title">Orientações da apresentação</h2>
            <p>Mensagens de apoio da equipe, liberadas durante o vídeo</p>
          </div>
          <span>{visibleGuidance.length}</span>
        </div>
        <div className={styles.guidanceFeed} aria-live="polite">
          {visibleGuidance.map((item) => (
            <article key={item.at}>
              <span className={styles.teamAvatar}>CC</span>
              <div>
                <strong>Equipe Contemplação Católica</strong>
                <small>{item.at ? `No minuto ${formatTime(item.at)}` : 'Ao iniciar'}</small>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
