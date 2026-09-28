# Pedido estruturado para a secretária de WhatsApp

**Data:** 28/09/2026
**Status:** desenho aprovado, pronto para virar plano

## O problema

A secretária monta o pedido do cliente como **texto livre**. A ferramenta
`registrar_pedido_intencao` recebe uma frase que o próprio modelo escreve e grava. Nada
verifica se aquilo corresponde a produto que existe, em embalagem que existe.

Três defeitos saíram disso em uma semana de validação, todos em produção:

| data | o que ela fez | por quê |
|---|---|---|
| 21/08 | cliente pediu 2 kg, ela anotou **4 kg + 1 kg de chipa** | somou com o pedido do dia anterior: o contexto dela são as 30 últimas mensagens, sem fronteira de tempo |
| 26/09 | perguntou "a chipa continua?" e **gravou a resposta que achou provável** | duas regras positivas fortes do prompt atropelaram um "NÃO registre" |
| 26/09 | anotou **500 g de chipa** | chipa só existe em 1 kg e 2 kg; nada impedia |

Quatro tentativas de conserto por prompt falharam, e cada uma abriu outro buraco: a regra
mecânica de reconhecer pedido criou excesso de zelo; consertar o zelo criou repetição da
pergunta; consertar a repetição atropelou o "não registre"; e tratar o pedido como fato no
prompt fez ela editar quantidade sem olhar produto.

**Não falta uma frase melhor. O desenho está errado.** Regra escrita em texto é regra que
o modelo pode contornar — e contornou, quatro vezes.

Existe ainda um defeito latente que ninguém reportou porque a equipe não chegou a sentir:
**"pão de queijo" é ambíguo entre quatro SKUs** de tamanhos diferentes. "1 kg de pão de
queijo" pode ser o de 25 g ou o de 100 g, e o pedido anotado hoje não diz qual. A equipe
teria que voltar no cliente — o trabalho que ela deveria poupar.

## A direção

Trocar texto livre por **estado estruturado com ferramentas de mutação**, que é o padrão
consolidado de *dialogue state tracking*: o agente para de re-derivar estado do transcript
e passa a modificar um estado explícito.

A garantia sai do prompt e vai para o banco. Item de pedido vira linha com **chave
estrangeira para `produtos`** — "500 g de chipa" não tem produto correspondente, logo não
entra, nem que o modelo queira.

## Decisões tomadas

| decisão | escolha |
|---|---|
| Tamanho ambíguo ("1 kg de pão de queijo") | **Sempre perguntar.** Sem adivinhar por histórico de compra |
| Fim do pedido | **O cliente confirma.** Não é janela de tempo nem humano assumindo |
| Cliente some sem confirmar | Avisa a equipe depois de **30 min** parado, com aviso de cara diferente |
| Cliente acrescenta depois de confirmar | **Reabre o mesmo pedido**; equipe recebe aviso marcado como ATUALIZADO |
| Pedido confirmado vira venda? | **Não agora.** Timeline do cliente + aviso no grupo. Vendas fica para depois |
| Estoque trava o pedido? | **Não.** Validação é contra *o que a Mont vende*, nunca contra *quanto tem* |

### Por que o pedido não vira venda agora

`criar_pedido` — a RPC que o catálogo do site usa — pede `endereco_entrega`,
`metodo_pagamento` e `frete`. A secretária não pergunta nenhum dos três, de propósito: ela
é proibida de falar de fiado, prazo e desconto. Fazer o pedido nascer em Vendas significa
ela passar a perguntar endereço e forma de pagamento, ou seja, virar fechadora de venda.

É decisão legítima, mas é outra feature. E a assimetria de custo manda esperar: errar um
aviso no grupo custa uma mensagem ignorada; errar uma venda custa recebível fantasma e a
ordem de deleção de FK, que já é documentadamente dolorosa.

`cat_pedidos` também não tem coluna de canal — pedido de WhatsApp ficaria indistinguível
de pedido do site nos relatórios, e atribuição é o projeto inteiro.

### Por que estoque não entra

`estoque_atual` está negativo em quase tudo (chipa −243, palito −426): é baseline nunca
contado, já documentado. Número inventado faria ela recusar venda que existe ou prometer o
que não tem. A contagem física acontece no tempo do diretor, sem prender o agente.

Se um dia ela precisar recusar por falta de estoque, é decisão separada e depois da
contagem real.

## Modelo de dados

```sql
CREATE TABLE public.wa_pedido (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id    uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  telefone_wa   text NOT NULL,
  status        text NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho','confirmado','abandonado')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  confirmado_em timestamptz,
  interacao_id  uuid REFERENCES public.interacoes(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX uniq_wa_pedido_aberto
  ON public.wa_pedido (contato_id) WHERE status = 'rascunho';

CREATE TABLE public.wa_pedido_item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES public.wa_pedido(id) ON DELETE CASCADE,
  produto_id      uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade      integer NOT NULL CHECK (quantidade > 0),
  preco_unitario  numeric NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_wa_pedido_item
  ON public.wa_pedido_item (pedido_id, produto_id);
```

Cada restrição paga por um defeito específico:

- **`produto_id NOT NULL` + FK** — mata o "500 g de chipa" no banco, não no prompt.
- **Único parcial em `rascunho`** — no máximo um pedido aberto por contato. Sem isso, duas
  execuções simultâneas (que o debounce já produziu em campo) criam rascunhos paralelos.
- **Único `(pedido_id, produto_id)`** — um produto aparece uma vez. "mais 1 kg de chipa" é
  alteração de quantidade, nunca segunda linha. Acaba a ambiguidade "somar ou substituir"
  que gerou o 4 kg: no banco só existe uma representação por coisa.
- **`quantidade > 0`** — remover é DELETE, não quantidade zero.
- **`preco_unitario` congelado** — o preço que ela *falou* para o cliente. Se a chipa subir
  hoje à noite, o pedido confirmado guarda o que foi prometido.
- **`ON DELETE RESTRICT`** — produto fora de linha se desativa, não se apaga; histórico não
  vira linha órfã.
- **`interacao_id`** — aponta para a linha da timeline criada na confirmação; é o que
  impede aviso duplicado na reabertura.

RLS no padrão de `wa_envios`: escrita só `service_role`, leitura para admin.

## As ferramentas do agente

Sai `registrar_pedido_intencao`. Entram quatro:

```
adicionar_item(termo, quantidade)
alterar_quantidade(termo, quantidade)
remover_item(termo)
confirmar_pedido()
```

`consultar_produto` e `consultar_frete` seguem como estão.

**Quem resolve ambiguidade é a ferramenta, não o modelo.** O `termo` é o que o cliente
escreveu ("pão de queijo", "baldinho", "1 kg de chipa"). A ferramenta resolve contra o
catálogo e devolve um de três resultados:

| resultado | quando | o que ela faz |
|---|---|---|
| **resolvido** | casa com exatamente 1 produto | item entra; ela lê o pedido de volta |
| **ambíguo** | casa com mais de um | pergunta, com as opções recebidas |
| **não encontrado** | não casa com nada vendável | diz o que existe daquela família |

Exemplos que vieram dos defeitos reais:

```
"500g de chipa"          → não encontrado, opções [Chipa 1kg R$40, Chipa 2kg R$80]
"1 kg de pão de queijo"  → ambíguo, opções [25g R$30, 100g R$30]
"2 kg de pão de queijo"  → resolvido (só existe o 50g)
"baldinho"               → resolvido (via apelido)
"chipa"                  → ambíguo [1kg, 2kg]
```

Nos casos ambíguo e não encontrado **nada é gravado**. A regra "sempre perguntar o tamanho"
deixa de ser texto de prompt e vira mecânica: a ferramenta não tem caminho de código que
escolha sozinha.

A resolução casa o termo contra **`nome`, `apelido`, e os tokens de peso (1kg, 2kg, 4kg) e
de tamanho de unidade (25g, 50g, 100g)**, sobre a lista de produtos vendáveis
(`ativo AND visivel_catalogo`). Quando o cliente pede um peso que a família não tem — os
500 g de chipa — o resultado é *não encontrado* com as opções daquela família, e não uma
lista genérica do catálogo. O algoritmo exato fica para o plano; o contrato é este.

Quando a resposta vem **ambígua**, as opções trazem o `id` do produto, e a ferramenta
aceita `produto_id` além de `termo` — assim a segunda chamada, depois de o cliente
escolher, não precisa resolver de novo por texto.

**Toda mutação bem-sucedida devolve o pedido inteiro renderizado.** Ela nunca soma, nunca
formata, nunca escreve o pedido — recebe pronto e repete. A leitura de volta para o cliente
passa a ser o retorno natural da ferramenta em vez de uma regra de prompt.

`confirmar_pedido()` é a única que fala com a equipe.

Duas ações de leitura mudam junto, e não são ferramentas do agente — são do n8n:

- **`contexto`** passa a devolver o rascunho **derivado das linhas** de `wa_pedido_item`,
  renderizado, em vez do `pedido_atual` em texto que o fix de 14/09 introduziu. É a mesma
  ideia — o pedido chega como fato, não como dedução da conversa — agora com o fato vindo
  de dados em vez de uma frase.
- **`rascunhos_abandonados`** é a ação nova que o W4 consulta: devolve os rascunhos com ao
  menos um item, parados há mais de 30 minutos, **em conversas onde nenhum humano falou**.

## Ciclo de vida

```
        cliente pede item                 cliente confirma
  (novo) ──────────────► rascunho ──────────────────────► confirmado
                          │    ▲                              │
     parado 30 min        │    └──────────────────────────────┘
     sem resposta         │         cliente muda de ideia
                          ▼            (reabre)
                     abandonado
```

**Na confirmação**, em ordem: `status` vira `confirmado`; uma linha entra em `interacoes`
— e é esse INSERT que **move o Kanban**, via `trg_contato_assistido_status`; o aviso vai
para o grupo.

**Na reabertura**, o pedido volta para `rascunho` guardando o `interacao_id`. Na
reconfirmação, **atualiza aquela mesma linha** da timeline em vez de criar outra: o perfil
do cliente mostra o pedido, não três versões dele se montando.

### Os avisos

```
🛒 PEDIDO CONFIRMADO — <nome> (<telefone>)
   1× Pão de Queijo 1kg - 100gr .... R$ 30,00
   1× Chipa 1kg .................... R$ 40,00
   Produtos: R$ 70,00 (sem frete)
   Alguém precisa fechar.

🛒 PEDIDO ATUALIZADO — <nome> (<telefone>)
   [mesmo formato]
   ⚠️ Já tinha sido avisado antes. Confira se não foi separado.

⏳ NÃO CONFIRMADO — <nome> (<telefone>)
   Montou isto e parou de responder há 30 min:
   [itens]
   Ninguém confirmou. Vale um empurrão?
```

O aviso de atualização carrega o alerta porque ela não sabe se já separaram — quem sabe é a
equipe. Ela informa; a decisão fica com quem tem a informação.

### O relógio do abandono

**W4 no n8n**, cron de 10 minutos, perguntando à Edge Function quais rascunhos estão
parados há mais de 30 minutos.

Cron no n8n e não `pg_cron` de propósito: há footgun documentado de Edge Function com
`verify_jwt` matando cron **em silêncio** — três dias de CAPI parada em agosto. No n8n, a
execução falha em vermelho na tela.

**Guarda obrigatória:** o aviso de abandono **não dispara se um humano falou naquela
conversa**. Sem isso, o robô avisaria o grupo sobre um cliente que o Gilmar já está
atendendo. Nesse caso o pedido fecha como `abandonado` em silêncio.

Os 30 minutos são estimativa inicial; só o uso calibra.

## Catálogo — pré-requisito

Validar contra lista errada é pior que não validar: dá confiança falsa. Três coisas antes
das ferramentas entrarem em uso:

**1. Nomes que o cliente reconhece, e `apelido` preenchido.** O Baldinho está cadastrado
como `Massa Pão de Queijo 1kg`. Se o cliente escreve "baldinho" e a ferramenta não acha,
ela responde que a Mont não vende baldinho — pior que o defeito atual. O `apelido` é o que
faz "baldinho", "massa" e "balde" chegarem no produto certo.

**2. As flags têm que dizer a verdade.** `visivel_catalogo=false` significa "não vendemos
mais" — confirmado pelo diretor, o que torna a flag sinal confiável. Mas os 6 kits da Copa
estão visíveis e provavelmente não são mais vendidos. Conserta-se o dado, não a consulta: a
secretária segue lendo `ativo AND visivel_catalogo`, e essa lista passa a ser verdade para
todos os consumidores — inclusive o catálogo público, que lê a mesma flag.

**3. A matriz peso × tamanho é incompleta de verdade.** Não existe 1 kg-50 g nem 2 kg-25 g.
Isso é o catálogo certo, não lacuna a preencher.

### Pergunta aberta

**Quais kits e combos ainda são vendidos?** Não bloqueia o desenho; bloqueia a tarefa de
limpeza. Precisa da lista do diretor antes de mexer nas flags.

## Testes

Lógica pura em `packages/shared`, junto com o resto da lógica da secretária:

- **Resolução do termo** — dada uma lista de produtos e o que o cliente escreveu, devolver
  resolvido / ambíguo / não encontrado. Os casos acima viram testes, incluindo os que
  doeram em produção.
- **Renderização do pedido** — itens para o texto do aviso.

As **garantias do banco** são provadas na migration: tentar inserir item com `produto_id`
inexistente e confirmar que a transação falha. É evidência de aceitação, não teste
permanente.

O resto é conversa real no WhatsApp, na gaiola de dev — tom e fluxo não têm como ser
testados de outro jeito.

## O que sai

| sai | por quê |
|---|---|
| `registrar_pedido_intencao` | substituída pelas quatro |
| `intencoes_a_avisar` | o aviso nasce do `confirmar_pedido` |
| `pedidoVigente` + `JANELA_PEDIDO_MS` | o status substitui a janela de tempo |
| 3 regras de prompt | "não registre antes da resposta", "pergunte antes de reduzir", "não repita a pergunta" |

As três regras falharam repetidamente. Existiam para compensar a ausência de estado — some
o buraco, some o remendo. O prompt volta a descrever **como ela fala**; **o que ela pode
fazer** passa a ser o banco quem decide.

## Fora de escopo

- Tela no Mont Interno para listar rascunhos
- Estoque como trava
- Pedido virar venda automaticamente
- Sugerir tamanho pelo histórico de compra do cliente

Cada um resolve um problema que ainda não existe. O de hoje é ela inventar produto e perder
o fio do pedido.

## Riscos

- **A limpeza do catálogo é trabalho de dados, não de código**, e depende do diretor
  responder quais kits ainda vendem. Se as flags ficarem erradas, a validação valida contra
  a lista errada.
- **A resolução por `apelido` depende de os apelidos existirem.** Apelido faltando vira
  "não encontrado", que do lado do cliente soa como "não vendemos isso".
- **Os 30 minutos do abandono e a cadência de 10 minutos do W4 são estimativas.**
- **O W4 é peça nova no ar.** Se ele morrer, ninguém é avisado de pedido abandonado e o
  sintoma é silêncio — o mesmo formato de falha que a CAPI teve em agosto. A execução
  vermelha no n8n é a mitigação.
