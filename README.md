# Oração Sagrada de São Bento

Funil móvel preservado em Next.js 16, com API TypeScript para Vercel e persistência no Supabase. A versão PHP anterior está guardada em `legacy-php/` e não é usada pela aplicação nova.

## Regras comerciais

- Oferta principal: R$ 22,90.
- Único adicional: Áudio Completo da Oração Sagrada de São Bento, bump `5`, por R$ 9,90.
- Total sem adicional: R$ 22,90.
- Total com adicional: R$ 32,80.
- O PDF da oração é entregue pelo site somente após pagamento confirmado e validação da sessão.
- O áudio adicional não é disponibilizado para download no site; a equipe faz o envio manual ao WhatsApp cadastrado.

Os preços são reconstruídos no servidor. Valores enviados pelo navegador são ignorados.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e preencha somente com credenciais de teste ou do ambiente correto.
2. Aplique a migration em `supabase/migrations/` no projeto Supabase escolhido.
3. Envie o PDF para o bucket privado `protected-content`, com o nome `oracao-sao-bento-guia-7-dias.pdf`.
4. Instale e valide:

```powershell
pnpm install
pnpm lint
pnpm type-check
pnpm test
pnpm build
pnpm dev
```

Consulte [configuração e deploy](docs/CONFIGURACAO-E-DEPLOY.md) e [checklist de pagamento](docs/CHECKLIST-PAGAMENTO.md).
