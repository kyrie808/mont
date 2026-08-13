# Secretária de WhatsApp — design

**Data:** 13/08/2026
**Autor:** Luccas Ferreira (Kyrie) + Claude
**Status:** design aprovado, pendente de plano de implementação

---

## 1. Contexto

O CRM Inteligente (Fase 1) está no ar: toda mensagem do WhatsApp da Mont é capturada,
casada com o contato e virada registro na timeline por um analista com LLM. Mas o sistema
**só lê**. Quem responde continua sendo humano — e são quatro: o Gilmar, o Luccas, a mãe
dele e às vezes a esposa, todos pela mesma conta do WhatsApp Business.

Esta é a virada de categoria: a IA passa a **falar com cliente** em nome da Mont.

O que justifica o risco é a economia do lead pago. A campanha converte 11,5% dos leads a
R$ 34,85 por cliente, e lead de anúncio esfria em minutos. Hoje ele espera o Gilmar estar
livre. A secretária responde em segundos, a qualquer hora.

## 2. Decisões de escopo

| Decisão | Escolha | Por quê |
|---|---|---|
| Autonomia | **Responde sozinha** | O produto que o Luccas quer; o prompt vai sendo apertado com o uso |
| Quem ela atende | **Todo mundo que escrever** | Ela vira a porta de entrada, não só o funil de anúncio |
| Colisão com humano | **Prioridade humana absoluta** | Quatro pessoas na mesma caixa; falar por cima é pior que demorar |
| Limite de autonomia | **Responde o factual, escala o sensível dizendo que vai verificar** | O cliente nunca fica no vácuo, e as decisões que custam dinheiro ficam com humano |
| Fechamento de venda | **Não fecha** — sinaliza intenção e avisa a equipe | Erro dela viraria estoque baixado e recebível fantasma |

### Fora de escopo (projetos próprios, depois)

- **Follow-up proativo** — gatilho por tempo e mensagem não solicitada; risco diferente.
- **RAG** de documentação da empresa.
- **Consulta ao Gilmar antes de responder** o sensível (human-in-the-loop de verdade).
- **Criação de venda e de cliente** pela própria agente.
- Aviso de venda-com-entrega no grupo `🚘 #ENTREGAS` — já tem dono e propósito.

## 3. Arquitetura

O corte não é por camada, é por **o que não pode ser contornado editando um workflow**.

| Peça | Onde | Por quê ali |
|---|---|---|
| Debounce (Redis) | n8n | Timing puro; o Redis já está na stack e hoje está vazio |
| Coreografia (lida → digitando → envia) | n8n | Precisa estar ao lado do aparelho |
| Prompt + LLM (AI Agent + Gemini) | n8n | É a peça que mais vai ser iterada; editar na tela é vantagem |
| **Gaiola de envio (allowlist)** | **repo** | Segurança não pode depender de ninguém não ter editado um nó |
| **Prioridade humana** | **repo** | Consulta ao banco; é a regra que evita falar por cima da equipe |
| **Ferramentas (tools)** | **repo** | Consultam o banco; o dado tem que ser o verdadeiro |

A Edge Function `whatsapp-secretaria` **não decide o que dizer**. Ela responde:
*este número está liberado?*, *quem falou por último foi humano da equipe?*, *estes são os
produtos e preços reais*. O que dizer é do n8n com o Gemini.

### Fluxo

```
mensagem chega (webhook Evolution → n8n)
        │
        ├─→ ingestor (já existe): registra em mensagens_whatsapp
        │
        └─→ debounce Redis: grava a conversa, reinicia o contador
                  │  espera a janela; se chegou mensagem mais nova, esta execução morre
                  ▼
        whatsapp-secretaria: pode responder?
            · número na allowlist?            (gaiola)
            · último a falar foi humano nosso? (prioridade humana → cala)
            · contexto: catálogo + histórico da conversa
                  ▼
        AI Agent (Gemini) + tools → texto da resposta OU decisão de escalar
                  ▼
        coreografia: marca lida → "digitando…" → envia (partido, se longo)
                  ▼
        registra os message_id enviados em wa_envios
                  ▼
        se escalou: avisa o canal interno
```

## 4. `wa_envios` — a peça que sustenta a prioridade humana

Mensagem enviada pela secretária volta pelo webhook como `fromMe: true` — **idêntica** à de
qualquer um dos quatro humanos. Sem distinguir:

- se ela tratar a própria fala como "humano assumiu", **se cala para sempre** na primeira
  resposta que der;
- se ignorar todo `fromMe`, fica **cega** para a equipe e fala por cima.

`wa_envios` guarda o `message_id` que a Evolution devolve no envio. A regra de prioridade
humana vira: *existe mensagem `fromMe` posterior à última do cliente que **não** está em
`wa_envios`?* Se sim, humano assumiu.

Não é otimização. É o que faz a decisão central do projeto funcionar.

## 5. Debounce

Redis, já rodando no `docker-compose` da stack (hoje com zero chaves).

Cada mensagem que chega grava a conversa numa chave e reinicia o contador. A execução
espera a janela (10-15s, ver §6) e, ao acordar, confere se chegou mensagem mais nova — se
chegou, morre; a mais recente assume. Sobra **uma execução, com a conversa inteira**.

O agrupamento que o Luccas pediu sai de graça: a secretária lê *a conversa*, nunca *uma
mensagem*. Cliente que manda cinco mensagens seguidas recebe uma resposta só, cobrindo tudo.

⚠️ **Ponto de observação no teste manual** (levantado pelo Luccas): cliente que manda
mensagem a cada 25 segundos por vários minutos. A condição é *"a última mensagem do cliente
já tem X segundos"*, o que trata o caso por construção — mas é o tipo de coisa que só o uso
real confirma.

## 6. Coreografia humana

Ancorada no estudo da Aalto (37 mil voluntários, 160 países): **36,2 palavras/min** de
média em celular, 38 wpm com dois polegares.

**Aplicado com fator, não cru.** 25 palavras a 36,2 wpm dariam 41 segundos de "digitando",
o que não parece humano — parece travado. Quem atende comercialmente digita em rajadas e
mais rápido que em conversa de lazer.

```
cliente para de escrever
   ↓  10-15s        janela de debounce, com jitter
marca como lida                          ← o "visualizado" aparece
   ↓  1-4s          tempo de "ler"
"digitando…" por T
   ↓  T = palavras ÷ 0,6 × 0,45, limitado a [4s, 15s], com ±20% de jitter
envia
```

Onde **0,6 = palavras por segundo** (36,2 wpm ÷ 60) e **0,45** é o fator de "atendimento
comercial" — o parâmetro a calibrar no teste manual. Os limites existem porque sem eles
uma resposta de uma palavra sairia instantânea (robótico) e uma de cinquenta demoraria
mais de meio minuto (parece travado).

Nenhum valor é fixo: janela, leitura e T variam. Duas respostas do mesmo tamanho nunca
demoram igual.

**Resposta longa sai partida em duas mensagens**, com pausa e novo "digitando…" no meio —
é a assinatura mais humana do WhatsApp. Parâmetro ajustável.

Endpoints confirmados na Evolution v2.3.7 (testados: respondem 400 com corpo vazio, não
404): `chat/markMessageAsRead`, `chat/sendPresence`, `message/sendText` (aceita `delay`).

## 7. Ferramentas

> **Princípio: a lista de ferramentas é a lista de permissões.**
> Ferramenta que existe, a secretária eventualmente usa.

| Tool | Para quê |
|---|---|
| `consultar_produto` | Preço e disponibilidade, por nome aproximado |
| `calcular_frete` | Reusa a lógica que já existe (frete grátis acima de R$ 60 no ABC) |
| `registrar_pedido_intencao` | Marca intenção de compra e avisa a equipe — **não cria venda** |

**Catálogo entra como contexto, não como tool.** São 25 produtos ativos: cabem no prompt,
custam quase nada e estão sempre disponíveis. Tool para isso só adiciona latência e uma
chance de falha.

**Não existe tool de saldo/dívida**, mesmo sendo trivial de fazer. São R$ 9.888 em aberto,
R$ 4.868 vencidos há mais de 30 dias — se ela puder consultar, um dia comenta a dívida de
alguém ou negocia prazo. É exatamente a área que decidimos escalar.

## 8. Fronteiras

A secretária **nunca**:

- fala sobre **fiado, dívida, prazo de pagamento ou desconto**;
- **promete data de entrega** (quem sabe a rota é o Gilmar e o Maurício);
- trata **reclamação** de produto ou entrega;
- **fecha venda**;
- responde se **um humano da equipe falou por último** naquela conversa;
- envia para número **fora da allowlist** enquanto `SECRETARIA_MODO=dev`;
- responde em **grupo** (o ingestor já ignora `@g.us`).

Nesses casos ela diz que vai verificar e retorna, e posta no canal interno o que aconteceu
e o que deixou de responder.

**Duas dessas travas moram no código, não no prompt:** a allowlist e a prioridade humana.
Prompt é instrução, e instrução o modelo pode contornar.

## 9. Gaiola de desenvolvimento

`SECRETARIA_MODO=dev` (default) → só envia para números na allowlist. Todo o resto roda
normal (lê, decide, registra), mas o envio é bloqueado e logado.

Mesmo mecanismo do modo sombra do ingestor, que já provou o valor: quando o WhatsApp
migrou para LID e o casamento de contato quebrou, foi ele que impediu milhares de
contatos-lixo na base.

**Allowlist inicial:** `5511934417085` (Luccas). O contato `Luccas teste`
(`b62db9b8-b1f2-4047-b692-af858064abb1`) já existe como `lead` / `origem: anuncio` — só
precisa trocar o telefone placeholder `11988888888` pelo real.

## 10. Canal de aviso interno

**Dependência que ainda não existe:** o número da Mont não foi adicionado ao grupo interno
da equipe. O `fetchAllGroups` mostra 3 grupos, e nenhum é ele — os outros dois são
workshops externos, **um com 281 participantes**.

⚠️ Por isso o id do grupo é **constante validada no repo**, nunca campo de texto livre: id
errado publicaria pedido de cliente, com nome e valor, para 281 estranhos.

**Enquanto a dependência não existe**, os avisos internos vão para o número do Luccas — o
mesmo da allowlist. Vantagem no desenvolvimento: ele vê as duas pontas na mesma tela, a
resposta que o cliente receberia e o aviso que a equipe receberia.

## 11. Tratamento de erro

| Falha | Comportamento |
|---|---|
| LLM cai ou devolve algo ilegível | Não responde nada. Silêncio é seguro; a conversa continua na fila |
| Envio falha na Evolution | Não marca em `wa_envios`; a próxima rodada tenta de novo |
| Tool falha | A agente responde sem aquele dado, ou escala |
| Número fora da allowlist | Bloqueia o envio, registra a decisão e segue |
| Contato não casado | Não responde (sem contato não há histórico nem contexto) |

Sobre a última linha: em modo `ativo` o ingestor **cria** o contato ao registrar a primeira
mensagem, então lead novo já chega casado. A trava existe para a corrida — secretária
rodando antes do ingestor terminar — e não para o caso comum.

Princípio: **falhar calado é melhor que falar errado.** Diferente do analista, aqui o erro
é visível para o cliente.

## 12. Testes

- **Unitários (Vitest, sem banco):** cálculo do tempo de digitação (limites e jitter),
  partição de resposta longa, decisão de prioridade humana dado um conjunto de mensagens.
- **Integração manual, pelo número do Luccas:** conversa normal; cliente mandando 5
  mensagens em rajada; humano assumindo no meio; pergunta sensível (fiado) forçando escalada.
- **Gaiola:** tentativa de envio para número fora da allowlist deve ser bloqueada e logada.
- **Regressão:** a suíte atual (214 testes) tem que continuar verde.

Validação visual e de tom é do diretor — o agente não gera screenshot.

## 13. Riscos assumidos

- **Ban do número.** A conta passa a enviar automaticamente. Volume baixo e só para a
  allowlist em dev reduzem, mas não zeram.
- **Limite de dispositivos vinculados.** O WhatsApp permite 4; são 4 pessoas na equipe mais
  a Evolution. Conferir se alguém foi desconectado no pareamento.
- **A secretária falando algo errado** para cliente real quando sair de `dev`. Mitigado
  pelas fronteiras no código, mas o prompt é o que segura o resto — e prompt se ajusta com
  o uso, não se prova de antemão.
- **Depende da máquina ligada.** n8n, Evolution e Redis são locais. Some com a VPS.
