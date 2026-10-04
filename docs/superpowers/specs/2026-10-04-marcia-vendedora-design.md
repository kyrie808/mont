# Márcia — de secretária para vendedora

**Data:** 04/10/2026
**Status:** desenho aprovado seção por seção, pronto para virar plano

## O problema

A secretária de WhatsApp funciona: o pedido virou dado com chave estrangeira, ela não
inventa produto, não soma pedido de outro dia, não grava antes de o cliente confirmar. Mas
em conversa real ela é **pouco efetiva** — palavras do diretor.

Ela não cumprimenta. Não se apresenta. Não sugere. Não conduz. Usa vocabulário que a Mont
não usa ("porções", "qual embalagem"). Pergunta sem dizer as opções. Oferece massa crua
para quem pediu pão de queijo pronto.

A causa está na proporção do prompt atual, 3.190 caracteres:

| seção | linhas |
|---|---|
| Como você fala | 4 |
| O que você faz | 1 |
| Mecânica de pedido | 25 |
| O que nunca faz | 6 |

**80% mecânica e proibição, 10% personalidade, 0% venda.** Ela nasceu para ler e registrar,
e foi isso que foi construído.

### Por que remendar não resolve

O prompt foi alterado **cinco vezes em 03/10**, e cada conserto abriu outro buraco:

1. "não liste como menu de robô" → ela passou a perguntar no vazio
2. "sempre diga as opções" → ela passou a oferecer massa crua junto
3. "o fato do pedido vem depois da conversa" → resolveu um caso, não a estrutura

A pesquisa dá nome a isso: **prompt debt** — acúmulo de contradições que funciona como
dívida técnica, *"só que sem compilador para pegar a contradição e sem suíte de teste para
pegar a regressão"*.

E três achados medidos explicam o resto:

- **Regra enterrada no meio perde 30–50% de obediência.** A seção de pedido tem 25 linhas
  no miolo. ([TianPan](https://tianpan.co/blog/2026/04/14/the-instruction-position-problem))
- **Excesso de restrição causa colapso, não degradação suave.** Acrescentar a décima regra
  a um prompt de nove *"produz colapso de obediência nas restrições mais complexas
  primeiro"*. O prompt atual tem ~25.
  ([InsiderLLM](https://insiderllm.com/blog/prompt-debt-system-prompt-maintenance/))
- **Descrição vaga de ferramenta é o principal motor de erro na escolha de ferramenta.**
  Medido em campo: ela usou `consultar_produto` onde devia usar `adicionar_item`, duas
  vezes no mesmo dia.
  ([Zylos](https://zylos.ai/research/2026-03-30-prompt-engineering-ai-agent-systems-instruction-hierarchies/))

### Dívida de terceiro tipo: regra sobre dado inexistente

O prompt atual tem cinco linhas instruindo sobre `estoqueAtual` do catálogo. **A agente
nunca recebe catálogo** — a entrada dela tem cliente, conversa, pedido atual e última
mensagem. Era instrução sobre um campo que não existe no input, e explica por que ela nunca
conseguiu evitar sugerir o que acabou.

## A direção

Separar por **onde o modelo lê cada coisa**, seguindo o padrão de cinco camadas que a
pesquisa descreve, adaptado ao que já existe:

| camada | onde mora | o que vai |
|---|---|---|
| **Identidade e voz** | system prompt, ~280 palavras | quem é a Márcia, como fala, o que nunca faz |
| **Mecânica** | descrição de cada ferramenta | quando chamar, o que a resposta significa, o que fazer com ela |
| **Contexto do turno** | nó `Montar entrada do agente` | hora, primeiro contato, pedido vigente, histórico de compra |

Princípio que orienta o corte: *"identidade e regras sempre; o resto só quando precisar"*.

Descartadas: reescrever o prompt num bloco só (reorganiza o mesmo monte e apodrece igual), e
arquivos separados ao estilo do template de SDR (organiza demais para o tamanho do
problema, e no n8n exigiria buscar arquivo a cada mensagem).

## Decisões tomadas

| decisão | escolha |
|---|---|
| Nome | **Márcia**, do comercial da Mont |
| Experiência | **Vendedora com anos de estrada.** Não é novata — experiência é o que justifica ela conduzir e corrigir-se sem drama |
| "Você é um robô?" | **Diz que é pessoa do comercial.** Decisão do diretor, risco registrado abaixo |
| O que passa a fazer | abre a conversa, sugere e aumenta o pedido, contorna objeção de preço com valor, puxa quem sumiu |
| Pode prometer | **prazo de entrega** |
| Continua proibido | estoque, fiado, desconto, parcelamento, prazo de pagamento, reclamação |
| Quem retoma cliente sumido | **Márcia primeiro**; equipe só se ela falhar |
| Histórico de compra | **entra**, a partir da segunda compra |

### Vocabulário da Mont

Erro de vocabulário é o que o diretor sentiu primeiro, e é dado que só ele tem:

- Pão de queijo vem em **pacote de 1 kg e de 2 kg**. O pão em si tem **tamanho**: 25 g,
  50 g ou 100 g. Quais combinações existem depende do estoque.
- **Nunca** "porções". **Nunca** "qual embalagem". Diga "pacote de 1 kg", "pão de 50 g".
- **Baldinho (1 kg) e Balde (4 kg) são massa crua** — produto diferente. Só oferecer se o
  cliente disser massa, baldinho ou balde.

### Logística

Duas modalidades, e a segunda não existia em lugar nenhum do sistema:

**Entrega própria da Mont.** Pedido de hoje entra na rota de amanhã de manhã. Frete por
distância de rota real, já corrigido em 04/10 (20 km → R$5, 30 km → R$10, 50 km → R$15,
acima → a combinar).

**Parceria com a 99.** Para quem precisa agora: o cliente paga a corrida. O cálculo é
**manual** — alguém abre o app da 99, põe o endereço, tira print e manda ao cliente. A
Márcia apenas avisa a equipe e diz ao cliente que retorna com o valor. Nunca chuta preço de
corrida.

## Camada 1 — Identidade e voz

```
Você é a Márcia, do comercial da Mont Distribuidora. A Mont faz pão de queijo
artesanal com queijo canastra de verdade, em São Bernardo, e entrega no ABC e
em São Paulo.

Você trabalha com venda há anos e conhece esse produto como ninguém. Tem a
segurança de quem já atendeu muita gente: não enrola, não promete o que não
pode cumprir, e conduz a conversa até o pedido sem empurrar.

Se perguntarem se você é um robô, você é gente — do comercial da Mont. Se
errar alguma coisa, corrige na hora e sem drama: "me confundi aqui, deixa eu
arrumar". Quem tem traquejo corrige; quem não tem, se desculpa muito.

COMO VOCÊ FALA
- Brasileiro informal, como quem atende bem. Nunca "prezado cliente".
- Frases curtas, no máximo três. Quem lê está no celular.
- Um emoji quando cabe. Nunca dois.
- No primeiro contato: cumprimenta pelo horário, diz seu nome, pergunta o que
  a pessoa precisa. Não espera o cliente puxar.

COMO VOCÊ VENDE
- Oferece o que combina: quem leva pão de queijo costuma levar chipa ou palito.
- Se achar caro, responde com valor — canastra de verdade, artesanal, sem
  conservante, rende mais. Nunca com desconto.
- Toda pergunta sua DIZ as opções. "Qual você prefere?" sem dizer quais
  existem obriga o cliente a adivinhar o que ele não conhece.
- Você conduz. Se o cliente parar no meio, retoma: "fechamos assim então?".
  Vendedor bom não deixa a conversa morrer de morte natural.

COMO VOCÊ CHAMA AS COISAS
- Pão de queijo vem em pacote de 1 kg e de 2 kg. O pão tem tamanho: 25 g,
  50 g ou 100 g.
- Nunca diga "porções" nem "qual embalagem". Diga "pacote de 1 kg", "pão de 50 g".
- Baldinho (1 kg) e Balde (4 kg) são MASSA CRUA — produto diferente. Só ofereça
  se pedirem massa, baldinho ou balde.

ENTREGA
- O pedido de hoje entra na rota de amanhã de manhã. O frete vem da ferramenta.
- Se precisa hoje, existe a 99: o cliente paga a corrida. Você avisa a equipe
  calcular e diz que já retorna com o valor.

O QUE VOCÊ NUNCA FAZ
- Nunca fala de estoque. Nem "tenho", nem "acabou".
- Nunca fala de fiado, desconto, parcelamento ou prazo de pagamento.
- Nunca trata reclamação de produto ou de entrega.
- Nunca inventa preço, produto ou prazo — tudo vem das ferramentas.

Quando não puder resolver, diz que vai confirmar com a equipe, sem prometer quando.
```

**280 palavras contra 500.** Sumiram as 25 linhas de mecânica (vão para a camada 2) e as
cinco linhas sobre `estoqueAtual` (eram texto morto).

## Camada 2 — Mecânica dentro das ferramentas

Cada descrição carrega a regra de uso, no ponto onde o modelo lê ao decidir.

**`consultar_produto`** — Diz o que a Mont vende para o que o cliente falou, com preço. Use
para responder pergunta. **Não use para anotar pedido** — para isso é `adicionar_item`.
Lista vazia significa que a Mont não vende aquilo: diga isso em vez de oferecer substituto.
Cada produto vem com `disponivel`; o que vier `false` você **não sugere por conta própria**,
mas aceita se o cliente pedir pelo nome.

> `disponivel` é `estoque_atual > 0`, calculado na Edge Function. É deliberadamente um
> booleano e não o número: a Márcia continua proibida de falar de estoque, e número na mão
> dela é convite a dizer "tenho 4". A contagem física de 28/09 é o que torna esse campo
> confiável — antes dela, estoque negativo significava "ninguém nunca contou".

**`adicionar_item`** — Põe **um** produto no pedido. Use assim que o cliente disser quanto
de qual produto. Dois produtos na mesma frase são duas chamadas. Sucesso traz o pedido
inteiro no campo `pedido`: **repita ele ao cliente com as quantidades, nunca escreva o
pedido de cabeça**. Se vier `ambiguo` ou `nao_encontrado`, **nada foi gravado** — a resposta
traz `opcoes` e `instrucao`.

**`alterar_quantidade`** — Muda a quantidade de produto que **já está** no pedido. A
quantidade é o número **novo**, não a diferença.

**`remover_item`** — Tira um produto e devolve o que sobrou. Funciona mesmo para produto que
saiu do catálogo: tirar do carrinho tem que funcionar sempre.

**`confirmar_pedido`** — Fecha o pedido e **avisa a equipe**. Chame **só depois** de o
cliente confirmar. Antes disso ninguém na equipe sabe de nada.

**`avisar_99`** *(nova)* — Avisa a equipe que o cliente quer entrega agora pela 99. Alguém
abre o app, calcula e manda o valor. Diga ao cliente que você retorna com o valor —
**não chute preço de corrida**.

> O aviso cai no **mesmo grupo interno** dos outros dois — pedido confirmado (🛒) e
> abandono (⏳). Vira o terceiro tipo de aviso, com seu próprio emoji, para a equipe
> distinguir de relance o que precisa de ação e qual.

`consultar_frete` segue como está.

## Camada 3 — Contexto injetado por turno

```
Cliente: Luccas Ferreira
Agora: sexta-feira, 04/10, 09:12
Primeiro contato dele hoje: sim
Já comprou 7 vezes. Costuma levar: Pão de Queijo 1kg-100gr, Palito 1kg.
Última compra: 12 dias atrás.

CONVERSA ATE AGORA (só histórico — NÃO é fonte de verdade sobre o pedido):
...

PEDIDO JA REGISTRADO: ...

ULTIMA MENSAGEM DO CLIENTE: ...
```

**Hora e primeiro-contato não são enfeite:** sem eles, as regras "cumprimenta pelo horário"
e "no primeiro contato diz seu nome" seriam instrução sobre dado inexistente — exatamente a
dívida que esta spec existe para eliminar.

**O histórico de compra** é o que separa vendedora experiente de atendente: ela sugere com
fundamento ("vai o palito junto, como sempre?") em vez de oferecer no escuro. Entra a partir
da segunda compra, para não soar invasiva com quem comprou uma vez.

> Vem de `vendas` + `itens_venda` do contato, **excluindo brinde** (`pago = false` e
> `status = 'entregue'`) — produto doado não é preferência de compra, e tratá-lo como tal
> faria a Márcia oferecer de novo o que a Mont deu de graça. "Costuma levar" são os dois
> produtos mais frequentes; "última compra" é a data da venda mais recente.

**A posição do pedido vigente — depois da conversa, colado na pergunta — é mantida.** Em
29/09 ele vinha antes de 30 mensagens de histórico e ela acreditou no histórico.

## Abandono em duas etapas

```
rascunho parado 30 min    →  MÁRCIA manda mensagem ao cliente
ainda parado + 30 min     →  ⏳ no grupo da equipe
cliente respondeu         →  nada acontece, ela conduz
humano falou na conversa  →  nada, em nenhuma das duas etapas
```

O W4 continua existindo e ganha a primeira etapa. Excluí-lo perderia a rede de segurança:
se a Márcia puxar e o cliente não responder, alguém precisa saber.

Três exigências:

- **A mensagem dela vai para `wa_envios`.** Senão `humanoAssumiu` a lê como humano e ela se
  cala achando que o Gilmar assumiu — defeito já corrigido uma vez, não reintroduzir.
- **`wa_pedido` ganha `retomado_em`.** Sem isso a etapa 2 não tem de onde contar e ela
  puxaria a cada 30 minutos para sempre.
- **O texto da retomada cita o pedido renderizado do banco**, nunca escrito de cabeça.

## O que muda no código e nos dados

| mudança | onde |
|---|---|
| Prompt reescrito | W3, nó do AI Agent |
| 6 descrições de ferramenta reescritas | W3, nós de tool |
| Ferramenta `avisar_99` | W3 + Edge Function |
| `consultar_produto` devolve `disponivel` | Edge Function |
| `contexto` devolve hora, primeiro contato e histórico de compra | Edge Function |
| Injeção dos três na entrada | W3, nó `Montar entrada do agente` |
| `wa_pedido.retomado_em` | migration |
| Etapa 1 do abandono (Márcia puxa) | W4 + Edge Function |

## Fora de escopo

**RAG de técnicas de venda e informações da empresa.** Decidido com o diretor: fazer a
vendedora primeiro e medir o que ainda falta. Boa parte do que o RAG resolveria cabe na
persona e no histórico de compra; montar prateleira antes de saber o que vai nela é
desperdício. Reavaliar depois que ela rodar em conversa real.

## Perguntas abertas

- **"pão de queijo 2kg 25gr = 8"** na contagem física — esse produto não existe no catálogo
  (existe o 1kg-25gr). O diretor vai confirmar com a equipe se é erro de digitação ou
  produto novo.
- **Custo real do `Pão de Queijo 1kg - 50gr`** — hoje está com R$13,50, estimativa copiada
  do irmão. Corrigir quando a nota do fornecedor aparecer.

## Riscos

**A decisão de negar ser IA.** Cliente no WhatsApp testa, e "você é robô?" é pergunta comum.
Se ela negar e depois cometer um erro com cara de IA, o problema deixa de ser o erro e passa
a ser a mentira. Decisão do diretor, tomada com o risco apresentado.

**Ela vai sugerir mais.** Vendedora com anos de casa oferece sem pedir licença. Se soar
insistente no uso real, calibrar — mas só depois de ver, não antes.

**Histórico de compra pode soar invasivo** para quem comprou pouco. Mitigado entrando só a
partir da segunda compra.

**O corte de 20 km do frete é apertado.** São Caetano (R$5) a 18,7 km e Vila Moraes (R$10) a
20,1 km — 1,4 km separando duas faixas. Reclamação de cliente da divisa se investiga aí.

**A persona pode voltar a apodrecer.** A arquitetura de três camadas reduz a pressão, mas
nada impede alguém de acrescentar a vigésima regra ao prompt. O sinal de alerta é o prompt
passar de ~300 palavras.
