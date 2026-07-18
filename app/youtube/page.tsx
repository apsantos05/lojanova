import type { Metadata } from 'next';
import Image from 'next/image';
import { VslPlayer } from './vsl-player';
import styles from './youtube.module.css';

export const metadata: Metadata = {
  title: 'Oração Sagrada de São Bento | Contemplação Católica',
  description: 'Apresentação gravada sobre a Oração Sagrada de São Bento.',
  robots: { index: false, follow: false },
};

export default function YoutubeVslPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <svg viewBox="0 0 28.57 20" width="30" height="21" aria-hidden="true">
            <path d="M27.973 3.123A3.578 3.578 0 0 0 25.447.597C23.22 0 14.285 0 14.285 0S5.35 0 3.123.597A3.578 3.578 0 0 0 .597 3.123C0 5.35 0 10 0 10s0 4.65.597 6.877a3.578 3.578 0 0 0 2.526 2.526C5.35 20 14.285 20 14.285 20s8.935 0 11.162-.597a3.578 3.578 0 0 0 2.526-2.526C28.57 14.65 28.57 10 28.57 10s-.003-4.65-.597-6.877z" fill="#f00" />
            <path d="M11.425 14.285 18.848 10l-7.423-4.285v8.57z" fill="#fff" />
          </svg>
          <strong>Contemplação Católica</strong>
        </div>
        <span>Apresentação gravada</span>
      </header>

      <div className={styles.content}>
        <VslPlayer>
          <h1 className={styles.title}>
            PARA QUEM REZA, MAS SENTE QUE PRECISA RETOMAR A PAZ E A CONSTÂNCIA
          </h1>

          <section className={styles.channel} aria-label="Informações da apresentação">
            <Image src="/youtube/apresentador.webp" alt="" width={48} height={48} priority />
            <div>
              <strong>Contemplação Católica</strong>
              <span>Oração Sagrada de São Bento</span>
              <small>Conteúdo gravado para assistir no seu ritmo</small>
            </div>
          </section>

          <details className={styles.description}>
            <summary>Sobre esta apresentação</summary>
            <p>
              Ter dificuldade para manter a constância não significa falta de fé.
              Esta apresentação traz uma orientação simples para quem deseja fazer
              a Oração de São Bento com mais atenção, presença e direção no dia a dia.
            </p>
            <p>Assista no seu ritmo. Ao final, você poderá decidir com calma se deseja continuar.</p>
          </details>
        </VslPlayer>

        <footer className={styles.footer}>
          <p>Conteúdo digital. Nenhum resultado específico é garantido.</p>
          <p>Esta página não é afiliada nem patrocinada pelo YouTube ou Google.</p>
        </footer>
      </div>
    </main>
  );
}
