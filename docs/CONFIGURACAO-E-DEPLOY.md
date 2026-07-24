# Configuração, Vercel e DNS

## 1. Supabase

1. Escolha ou crie o projeto Supabase de produção.
2. Aplique `supabase/migrations/20260716123000_vercel_checkout.sql` pelo fluxo de migrations da equipe ou pelo SQL Editor.
3. Confirme que as tabelas `orders`, `leads`, `payment_events` e `api_rate_limits` existem, possuem RLS ativa e não são acessíveis com chave pública.
4. No Storage, confirme que `protected-content` é privado.
5. Envie manualmente `oracao-sao-bento-guia-7-dias.pdf` para a raiz desse bucket.

Esta migration é aditiva: não contém `drop`, `truncate` ou `delete`. Ela ainda não foi aplicada por este repositório, pois nenhum projeto Supabase foi indicado/autorizado.

## 2. Variáveis da Vercel

Cadastre em Production e Preview conforme o ambiente:

```text
BLACKCAT_BASE_URL=https://api.blackcatoficial.com/api
BLACKCAT_SECRET_KEY=<segredo>
NEXT_PUBLIC_APP_URL=https://contemplacaocatolica.site
SUPABASE_URL=<url do projeto>
SUPABASE_SERVICE_ROLE_KEY=<chave secreta apenas do servidor>
SUPABASE_PDF_BUCKET=protected-content
SUPABASE_PDF_OBJECT=oracao-sao-bento-guia-7-dias.pdf
TIKTOK_PIXEL_ID=<id público>
TIKTOK_ACCESS_TOKEN=<segredo>
```

Nunca use `SUPABASE_SERVICE_ROLE_KEY`, `BLACKCAT_SECRET_KEY` ou `TIKTOK_ACCESS_TOKEN` em variáveis `NEXT_PUBLIC_*`.

## 3. Deploy com Git/Vercel

Depois de revisar e autorizar commit/push:

```powershell
git add --all
git commit -m "Migra funil para Vercel e Supabase"
git push origin <nome-da-branch>
```

Na Vercel, importe o repositório, mantenha a raiz do projeto no diretório atual, cadastre as variáveis e gere primeiro um Preview. Valide o Preview antes de promover a mesma build para produção.

Alternativa com CLI, somente depois de vincular o projeto e autorizar o deploy:

```powershell
pnpm dlx vercel pull --yes --environment=preview
pnpm dlx vercel build
pnpm dlx vercel deploy --prebuilt
```

Para produção, depois do checklist:

```powershell
pnpm dlx vercel promote <URL_DO_PREVIEW_VALIDADO>
```

## 4. BlackCat

- Base: `https://api.blackcatoficial.com/api`
- Criar PIX: `POST /sales/create-sale`
- Consultar: `GET /sales/{transactionId}/status`
- Header: `X-API-Key`
- Webhook final: `https://contemplacaocatolica.site/api/webhook-blackcat`

Cadastre a URL de webhook no painel da BlackCat se o painel exigir configuração adicional. A implementação não pressupõe assinatura não documentada; toda notificação é reconfirmada pela consulta de status.

## 5. DNS na Hostinger

1. Mantenha `contemplacaocatolica.site` como domínio principal do projeto na Vercel.
2. Adicione também `www.contemplacaocatolica.site` e escolha no painel qual versão redirecionará para a principal.
3. No painel da Vercel, abra Domains e copie exatamente os registros mostrados para `@` e `www`.
4. Na zona DNS da Hostinger, remova ou substitua apenas os registros A/AAAA/CNAME conflitantes de `@` e `www`.
5. Crie os registros usando exatamente tipo, nome e valor apresentados pela Vercel. Não use valores genéricos de tutoriais.
6. Preserve MX, TXT e demais registros de e-mail/verificação que não conflitem.
7. Não altere os nameservers; a Hostinger continua gerenciando a zona DNS.
8. Aguarde a Vercel marcar os dois domínios como válidos antes de interromper a hospedagem antiga.
