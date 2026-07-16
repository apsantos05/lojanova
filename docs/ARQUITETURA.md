# Arquitetura da migração

## Aplicação

- Next.js 16, TypeScript e App Router.
- A página mantém a estrutura visual do HTML anterior.
- O CSS, o JavaScript do funil, o JSON e os áudios foram reaproveitados em `public/`.
- As rotas em `app/api/` executam em Node.js na Vercel.

## Pagamento

1. O navegador envia dados pessoais e somente os IDs dos adicionais selecionados.
2. `/api/create-pix` valida nome, WhatsApp, CPF e sessão, reconstrói o carrinho e chama a BlackCat.
3. O pedido é salvo no Supabase com a sessão em SHA-256 e somente os quatro últimos dígitos do CPF.
4. `/api/check-payment` exige transação e a mesma sessão, consulta a BlackCat e atualiza o pedido.
5. `/api/webhook-blackcat` usa o corpo apenas para localizar o pedido; o status sempre é reconfirmado na BlackCat.
6. A transição para pago e o evento TikTok `CompletePayment` são idempotentes.

## Conteúdo protegido

O PDF não pertence ao repositório nem à pasta `public`. Ele fica em um bucket privado do Supabase Storage. `/api/download-oracao` valida pedido pago e hash da sessão antes de baixar o objeto pelo servidor e transmiti-lo com cache desabilitado.

O áudio do bump 5 não possui rota de download. A confirmação pós-pagamento informa o envio manual para o final do WhatsApp cadastrado.

## Dados e segurança

- `orders`: pedido, carrinho calculado, PIX e status.
- `leads`: eventos do progresso, UTMs e `ttclid`.
- `payment_events`: trava de idempotência e tentativas de eventos server-side.
- `api_rate_limits`: limitação persistente, adequada a funções sem filesystem gravável.
- RLS habilitada e acesso de `anon`/`authenticated` revogado nas quatro tabelas.
- A chave do Supabase e os tokens de pagamento/marketing existem somente no servidor.
