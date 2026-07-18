# Prompt cirúrgico — VSL e assistente de pagamento

Trabalhe no projeto `D:\Projetos\public_html` sem alterar o funil principal da raiz.

## Objetivo

Manter três percursos independentes no mesmo domínio:

1. `/` — chatbot original.
2. `/youtube` — apresentação gravada da Oração Sagrada de São Bento.
3. `/youtube/finalizar-pagamento` — assistente móvel que conduz o pagamento da oferta exibida na VSL.

## VSL

- Hospedar a interface e os ativos visuais no próprio projeto.
- Reproduzir o MP4 da VSL armazenado no Vercel Blob, em H.264/AAC 720p, com `faststart` e suporte a requisições parciais.
- Preservar o player customizado do arquivo original: capa, botão vermelho central, “Toque para assistir”, toque para pausar/continuar, controles de reprodução, volume e aviso para ativar o som.
- Permitir pausar, retomar, buscar um trecho, controlar volume, compartilhar e abrir em tela cheia.
- Preservar UTMs permitidas ao avançar para o pagamento.
- Mostrar a chamada comercial no tempo previsto pela apresentação, com preço e natureza da oferta claramente informados.
- Exibir orientações cronometradas somente como mensagens assinadas pela Equipe Contemplação Católica, sem atribuí-las a espectadores.
- Não simular transmissão ao vivo, audiência, curtidas, comentários, login do Google, notificações, escassez, depoimentos ou atividade de terceiros.
- Não prender o botão voltar, não disparar redirecionamento automático e não impedir zoom.
- Informar que a apresentação é gravada e que a página não é afiliada ao YouTube ou Google.

## Direção de copy

- Usar linguagem curta, falada, acolhedora e pastoral, sem fingir que um padre está digitando pessoalmente.
- Conduzir a mensagem por acolhimento, clareza, esperança e decisão.
- Reconhecer dores reais com respeito: dificuldade de manter a constância, preocupação com a família e desejo de retomar a serenidade.
- Tratar idade e experiência do público com dignidade, sem explorar vulnerabilidade, medo ou confusão.
- Explicar limites, preço, entrega e caráter opcional do áudio antes da decisão.
- Usar somente testemunhos, números e provas que tenham origem verificável e autorização de uso.
- Não usar depoimentos criados “para parecer reais”, números sem fonte, mensagens atribuídas ao Papa, alegações pseudocientíficas, cura, quitação de dívidas, milagre garantido, censura, ameaça espiritual, hipnose, dupla vinculação ou falsa urgência.
- Não ocultar a natureza comercial quando a oferta for apresentada.

## Assistente de pagamento

- Priorizar pessoas mais velhas: texto mínimo de 16 px nos campos, botões com pelo menos 48 px, alto contraste, uma pergunta por vez e progresso visível.
- Identificar o atendimento como assistente digital e orientação automática.
- Coletar nome completo, WhatsApp com DDD e CPF real do titular exigido pelo processador.
- Explicar o motivo do CPF antes de pedir.
- Nunca repetir o número do CPF em uma mensagem, salvar o CPF no `localStorage` ou incluí-lo no cadastro do lead.
- Enviar o CPF apenas no `POST /api/create-pix`.
- Manter a oferta principal por R$ 22,90.
- Manter somente o bump 5, Áudio Completo da Oração Sagrada de São Bento, por R$ 9,90.
- Ao aceitar, enviar `bumps: [5]` e mostrar R$ 32,80.
- Ao recusar ou remover, enviar `bumps: []` e mostrar R$ 22,90.
- Permitir remover o áudio no resumo antes de criar o PIX.
- Informar que o adicional é opcional e será enviado manualmente pelo WhatsApp após a confirmação.
- Não oferecer download do áudio no site.
- Usar `/api/create-pix`, `/api/check-payment`, `/api/save-lead` e `/api/download-oracao`.
- Fazer polling seguro, retomar após foco, visibilidade ou retorno do banco e restaurar PIX pendente apenas na mesma sessão.
- Detectar PIX expirado e permitir gerar outro.
- Após pagamento confirmado, liberar somente o download protegido da oração.
- Exibir o áudio existente `audio-06-como-pagar-pix.mp3` como orientação, depois de um breve estado “preparando áudio”, sem reprodução automática.

## Privacidade, segurança e Git

- O servidor deve recalcular catálogo e total; nunca confiar no valor enviado pelo navegador.
- O download exige transação paga e hash da mesma sessão.
- Não incluir chaves, `.env`, leads, pedidos, dumps, CPF ou logs privados no Git.
- Não importar `.htaccess`, PHP legado nem bibliotecas minificadas de rastreamento do pacote antigo.
- Não alterar as rotas ou a identidade do chatbot da raiz.

## Validação obrigatória

- Testar 320, 360, 390 e 430 px sem rolagem horizontal.
- Testar entrada visível com teclado móvel, foco, retorno à mensagem recente e áreas seguras de iPhone.
- Não abrir o teclado automaticamente ao carregar a página.
- Testar aceitar, recusar e remover o bump.
- Confirmar payloads `[5]` e `[]`, e totais R$ 32,80 e R$ 22,90.
- Testar QR Code, Copia e Cola, expiração, retomada, polling, retorno do banco e confirmação.
- Confirmar que o CPF não aparece no DOM nem no armazenamento local.
- Confirmar que o PDF não abre sem pagamento e sessão válidos.
- Confirmar que o MP4 responde com `video/mp4`, `Accept-Ranges: bytes`, CORS compatível, duração correta e reprodução com áudio antes de publicar.
- Executar lint, verificação de tipos, testes automatizados, build de produção e teste do domínio publicado.
- Não voltar a depender do antigo HLS `video.oracaosaobento.online`, que estava indisponível na migração.
- Não publicar esta revisão sem aprovação explícita após a auditoria.
