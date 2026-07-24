# Prompt cirúrgico — nome completo, objeções e fluidez do chatbot

Trabalhe no projeto `D:\Projetos\public_html`, preservando a identidade visual, o tom pastoral, a oferta principal de R$ 22,90, o adicional de áudio por R$ 9,90 e o fluxo protegido de pagamento e entrega já existentes.

## Objetivo

Eliminar falhas na coleta do nome completo e nas rotas de quebra de objeção, garantindo uma conversa natural, sem repetições, becos sem saída, pressão artificial ou caminhos quebrados antes da geração do PIX.

## Escopo obrigatório

### 1. Nome completo antes do PIX

- Exigir nome e pelo menos um sobrenome real no campo `nome`.
- Recusar nome isolado, como `Maria`.
- Recusar combinações formadas apenas por nome e partícula, como `Maria da`.
- Recusar números e caracteres incompatíveis com nomes, como `Maria 123`.
- Aceitar nomes compostos e grafias brasileiras, como `João da Silva` e `Ana D'Ávila`.
- Mostrar uma orientação clara no próprio campo, sem apagar o que o lead digitou.
- Aplicar a mesma regra no navegador e no servidor de criação do PIX.
- O servidor deve continuar sendo a autoridade final, mesmo que a validação do navegador seja contornada.

### 2. Quebras de objeção

Revisar integralmente as rotas:

- preço;
- forma de recebimento;
- tradição católica e natureza do material;
- expectativa de resultado;
- primeira compra online.

Em cada rota:

- acolher a dúvida sem confrontar o lead;
- responder com clareza e sem promessas garantidas;
- evitar repetir em texto exatamente o que acabou de ser explicado em áudio;
- não mencionar itens que não fazem parte da oferta;
- não criar prazo de acesso inexistente;
- oferecer três saídas quando aplicável:
  1. continuar para o cadastro;
  2. tirar outra dúvida;
  3. encerrar sem pressão.

### 3. Integridade do fluxo

- Toda opção deve possuir uma transição válida.
- Toda transição deve apontar para um grupo existente.
- O retorno ao menu de dúvidas não pode duplicar respostas, perder variáveis ou reiniciar o funil.
- O encerramento deve ser respeitoso e não deve encaminhar ao pagamento.
- A continuação deve chegar ao cadastro e preservar as respostas anteriores.
- Não alterar catálogo, valores, regras do PIX, download protegido ou entrega pós-pagamento.

### 4. Cache e compatibilidade

- Incrementar a versão dos ativos do chatbot para impedir que navegadores reutilizem o funil antigo.
- Preservar a experiência móvel, as esperas proporcionais, a retomada por bloco e o bloqueio contra mensagens ou áudios duplicados.
- Não adicionar dependências novas para esta atualização.

## Arquivos previstos

- `public/app.js`
- `public/funnel.json`
- `lib/validation.ts`
- `app/api/create-pix/route.ts`
- `tests/frontend-contract.test.ts`
- `tests/validation.test.ts`

## Critérios de aceite

- `Maria` é bloqueado no navegador.
- `Maria da` e `Maria 123` são bloqueados no navegador e no servidor.
- `Maria Silva`, `João da Silva` e `Ana D'Ávila` são aceitos.
- O texto de ajuda informa que nome e sobrenome são obrigatórios.
- As cinco rotas de objeção permitem continuar ou voltar às dúvidas; as rotas detalhadas também permitem encerrar.
- Não existem opções sem destino, transições sem origem ou grupos de destino inexistentes.
- Não há repetição imediata entre áudio e copy nas objeções de preço e primeira compra.
- O material é descrito sem garantia de resultado automático.
- O fluxo do PIX continua com preço calculado pelo servidor.

## Validação obrigatória antes do deploy

1. Validar estruturalmente todos os grupos, blocos, itens e transições do `funnel.json`.
2. Executar `pnpm test`.
3. Executar `pnpm lint`.
4. Executar `pnpm type-check`.
5. Executar `pnpm build`.
6. Testar no navegador:
   - nome sem sobrenome bloqueado;
   - nome completo aceito;
   - objeção de preço;
   - retorno ao menu de dúvidas;
   - segunda objeção;
   - continuação até o cadastro.
7. Não gerar PIX real durante a validação.
8. Revisar exatamente os arquivos que serão versionados, excluindo credenciais, leads, pedidos e dados pessoais.
9. Publicar por GitHub e aguardar a implantação de produção ficar `READY`.
10. No domínio público, confirmar:
    - página principal e `funnel.json` com HTTP 200;
    - versão nova dos ativos;
    - novas rotas de objeção presentes;
    - ausência de erros de execução na Vercel.

## Resultado esperado

O chatbot deve impedir a geração de PIX com nome incompleto, responder objeções com transparência, permitir navegação natural entre dúvidas e cadastro e continuar funcional após atualização, retorno ou carregamento em celular.
