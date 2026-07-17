import type { Metadata } from 'next';
import { CheckoutAssistant } from './checkout-assistant';

export const metadata: Metadata = {
  title: 'Finalizar pagamento | Contemplação Católica',
  description: 'Assistente para finalizar o pagamento da Oração Sagrada de São Bento.',
  robots: { index: false, follow: false },
};

export default function FinalizarPagamentoPage() {
  return <CheckoutAssistant />;
}
