# Checklist de pagamento e virada

## Automático/local

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
- `pnpm build`
- busca por chamadas `.php` fora de `legacy-php/`
- busca por credenciais, pedidos e leads rastreados pelo Git
- verificação de que nenhuma rota grava no filesystem

## Preview com Supabase e BlackCat configurados

1. Abrir em 320, 360, 390, 414 e 430 px; testar Android Chrome e iPhone Safari.
2. Completar o chat, digitação, áudios, rolagem, retorno à última mensagem e teclado aberto.
3. Recusar o áudio: payload `bumps: []`, total R$ 22,90.
4. Aceitar o áudio: payload `bumps: [5]`, total R$ 32,80.
5. Aceitar e remover no resumo: payload `bumps: []`, total R$ 22,90.
6. Gerar PIX e confirmar `copyPaste`/`qrCode`, QR visual e `expiresAt`.
7. Recarregar a página e validar retomada do PIX pela mesma sessão.
8. Consultar com outra sessão e confirmar HTTP 403.
9. Validar PIX expirado, cancelado e reembolsado.
10. Enviar webhook e confirmar que ele consulta a BlackCat antes de marcar como pago.
11. Confirmar pagamento e conferir somente um `CompletePayment` em `payment_events`.
12. Antes do pagamento, confirmar bloqueio do PDF.
13. Após pagamento, baixar o PDF na mesma sessão em Android e iPhone.
14. Comprar bump 5 e confirmar a mensagem de envio manual ao final do WhatsApp; não deve existir botão de download do áudio.
15. Confirmar UTMs e `ttclid` em `leads` e no evento TikTok.

Não faça uma cobrança real sem autorização específica e sem alinhar estorno/controle financeiro.
