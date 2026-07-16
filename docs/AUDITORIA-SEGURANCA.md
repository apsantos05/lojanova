# Auditoria de segurança da migração

## Controles implementados

- Catálogo e totais calculados exclusivamente no servidor.
- Somente bump `5` é aceito; outros IDs são descartados.
- CPF validado no servidor e persistido apenas pelos quatro últimos dígitos.
- Sessão persistida no banco somente como hash SHA-256.
- Consulta, retomada e download exigem transação e a mesma sessão.
- Respostas de consulta/download não revelam se uma transação de outra sessão existe ou está paga.
- Rate limit persistente no Supabase para PIX, polling, webhook, leads e tracking.
- Webhook tratado como gatilho e status reconfirmado pela BlackCat.
- `CompletePayment` não é aceito pela rota pública de tracking.
- Eventos TikTok possuem chave única, trava de processamento e retentativa idempotente.
- PDF lido de bucket privado e validado por tamanho e assinatura `%PDF`.
- RLS habilitada; papéis públicos não recebem acesso às tabelas.
- Filesystem de produção somente leitura: nenhuma rota grava pedidos, leads ou limites localmente.
- Dependências fixadas em lockfile e auditoria de pacotes sem vulnerabilidades conhecidas.
- Legado, dados locais e relatórios antigos excluídos do pacote Vercel por `.vercelignore`.

## Pendências antes de produção

1. O histórico Git ainda contém uma versão antiga do PDF incorporada em `api/download-oracao.php` e os binários antigos de kit/terço. Remover do checkout atual não remove dados de commits anteriores. É necessário autorizar uma reescrita coordenada do histórico ou publicar a migração em um repositório novo e limpo. Como o PDF antigo já foi exposto, o arquivo de produção deve ser uma nova versão antes do upload privado.
2. A migration ainda precisa ser aplicada a um projeto Supabase escolhido e validada com os advisors de segurança/performance.
3. O PDF novo precisa ser enviado manualmente ao bucket privado.
4. Não foi localizada documentação pública de assinatura do webhook BlackCat. A confirmação autoritativa e o rate limit reduzem o risco, mas uma assinatura oficial deve ser adicionada se a BlackCat fornecer esse mecanismo.
5. O fluxo financeiro real depende de credenciais e de um Preview configurado. Deve ser testado com controle financeiro antes da virada de DNS.

Esta foi uma revisão focada da aplicação migrada. Uma varredura exaustiva e formal do histórico completo pelo Codex Security exige iniciar um scan interativo separado; não foi apresentada como concluída aqui.
