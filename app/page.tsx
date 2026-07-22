import Script from 'next/script';
import Image from 'next/image';

function pixelBootstrap(pixelId: string) {
  return `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load(${JSON.stringify(pixelId)});ttq.page();}(window,document,'ttq');`;
}

export default function Home() {
  const pixelId = (process.env.TIKTOK_PIXEL_ID || '').trim();

  return (
    <>
      <a className="skip-link" href="#thread">Ir para a conversa</a>
      <div className="chat-shell">
        <h1 className="sr-only">Oração Sagrada de São Bento com Frei Gilson</h1>
        <div id="network-status" className="network-status" role="status" aria-live="polite" hidden />
        <header className="chat-header">
          <svg className="header-back" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          <div className="avatar"><Image src="/frei-gilson-avatar.webp?v=29" alt="Frei Gilson" width={54} height={54} priority unoptimized /></div>
          <div className="who"><div className="name">Frei Gilson</div><div className="status"><span className="dot" /> online</div></div>
          <div className="header-icons" aria-hidden="true">
            <svg className="video-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92z" /></svg>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </div>
        </header>
        <main id="thread" className="thread" aria-live="polite" />
        <button id="jump-latest" className="jump-latest" type="button" aria-label="Ir para a mensagem mais recente" hidden>Mensagem recente ↓</button>
        <div id="input-zone" className="input-zone" aria-hidden="true" />
      </div>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" strategy="beforeInteractive" />
      {pixelId ? <Script id="tiktok-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: pixelBootstrap(pixelId) }} /> : null}
      <Script src="/app.js?v=30" strategy="afterInteractive" />
    </>
  );
}
