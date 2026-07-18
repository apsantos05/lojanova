import type { Metadata } from 'next';
import styles from './simulation.module.css';

export const metadata: Metadata = {
  title: 'Simulação acadêmica | Oração Sagrada de São Bento',
  description: 'Demonstração acadêmica de uma apresentação gravada.',
  robots: { index: false, follow: false },
};

export default function YoutubeSimulationPage() {
  return (
    <main className={styles.page}>
      <div className={styles.notice} role="status">
        <strong>SIMULAÇÃO ACADÊMICA</strong>
        <span>Apresentação gravada. Audiência e interações exibidas são fictícias.</span>
      </div>
      <iframe
        className={styles.frame}
        src="/youtube/index.html"
        title="Simulação acadêmica da apresentação da Oração Sagrada de São Bento"
        allow="autoplay; fullscreen"
      />
    </main>
  );
}
