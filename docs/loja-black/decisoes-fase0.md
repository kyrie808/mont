# Decisões sobre o diagnóstico da Fase 0 — Loja Mont (Black 2026)

> Respostas do Luccas às perguntas P1–P15 de `diagnostico-fase0.md`. 30/10/2026.
> Este documento **prevalece sobre o `BRIEFING.md`** onde os dois divergirem.
> Situação de cada item:
> - **DECIDIDO:** pode implementar.
> - **PENDENTE GILMAR:** não implemente o dado. Deixe o esquema pronto e o valor em aberto.

## Lançamento
- **DECIDIDO:** os anúncios da Black começam em 03/11 apontando para o WhatsApp, como hoje. Eles só passam a apontar para a loja quando ela passar no teste real de R$ 1 de ponta a ponta (Pix e cartão).
- **DECIDIDO:** domínio `loja.montdistribuidora.com.br`.
- **DECIDIDO:** congelados ficam fora da loja na Black.

## P1 — Quando nasce a venda
- **DECIDIDO:** opção (a). A venda nasce no Jarvis só depois do pagamento confirmado.
- Aceite da Fase 2: pedido gravado em `cat_pedidos`/`cat_itens_pedido` com os sabores. A venda aparecendo no Jarvis passa a ser conferida no teste de R$ 1 da Fase 3.

## P2 — InfinitePay
- **DECIDIDO:** opção A simplificada. A tela 06 oferece só **Pix** e **Cartão de crédito**. Saem "Cartão de débito" e "Crédito 2x" (divergência autorizada do wireframe; vou atualizar o wireframe).
- **Pix:** link no valor Pix, `assured_installments: 0`. Se o cliente trocar para cartão lá, paga a taxa da InfinitePay. O pagamento é marcado como `divergente` para auditoria.
- **Cartão de crédito:** link só cartão (Pix desligado), no valor de crédito 1x da tabela, `assured_installments: 1`. Parcelar em mais vezes: a taxa da InfinitePay é somada pela própria InfinitePay.
- **`valid_until` = `expira_em`** (aceita data e hora com fuso, ex. `2026-12-31T23:59:59-03:00`) + `single_payment: true`.
- **Antes da Fase 3:** teste manual no painel com um link de R$ 1, para confirmar o comportamento de `assured_installments: 0` no 1x e a taxa real do cartão no link.

## P3 — Preço no cartão
- **DECIDIDO:** total no cartão = **soma do preço de crédito 1x de cada item** (tabela aprovada, guardada, nunca calculada por fórmula). O frete vai **sem taxa**.
- **Crédito 1x (Pix → 1x):**
  - **Avulsos:**
    - Balde 4 kg: 65 → 68
    - Baldinho 1 kg: 27 → 28
    - Doce 680 g: 29 → 30
    - Geleia de morango: 33 → 35
    - Geleia de frutas vermelhas: 35 → 37
    - Geleia de goiaba: 25 → 26
    - Doce 400 g: 21 → 22
    - Zero 400 g: 39 → 41
  - **Combos:**
    - Combo Família: 199 → 206
    - Balde + doce: 85 → 88
    - 3 doces: 79 → 82
    - Dupla Zero: 75 → 78
    - Kit Top: 89 → 92, ou 100 → 104 (**PENDENTE GILMAR**)
- Guarde também débito e 2x na tabela de preços (serve ao Jarvis depois), mas a loja só usa Pix e crédito 1x.

## P4 — Grupos dos combos e âncoras
- **PENDENTE GILMAR:** geleias fora dos grupos de "doce 680 g".
- Recomendação a implementar quando confirmada:
  - **Grupos de doce 680 g** (Combo Família, Balde + doce, 3 doces):
    - Doce de leite tradicional, com coco, com geleia de ameixa e com geleia de café
    - Cocada cremosa e cocada com maracujá
    - Doce de milho
  - **Geleias:** só no Kit Top.
- **DECIDIDO (30/10):** a **Dupla Zero é FIXA**: 1 doce de leite zero 400 g + 1 brigadeiro de colher zero 400 g, **sem grupo de escolha** (vale a composição atual em `produto_componentes`). Substitui o "2 zero 400 g à escolha" do BRIEFING.
- **DECIDIDO (30/10):** a **composição** dos combos com escolha é fixa; só os **sabores** estão pendentes. Os grupos foram criados sem opções (migration `20261030053815_loja_combos_composicao`):
  - Combo Família: balde 4 kg ×1 + baldinho 1 kg ×2 + "Escolha 6 doces de 680 g" (9 itens);
  - Balde + doce: balde 4 kg ×1 + "Escolha 1 doce de 680 g";
  - 3 doces: "Escolha 3 doces de 680 g".
- **Âncora "separado: a partir de"** = soma dos avulsos no preço Black com o sabor mais barato do grupo:
  - Combo Família: R$ 293
  - Balde + doce: R$ 94
  - 3 doces: R$ 87
  - Kit Top: R$ 108 (morango)
  - Dupla Zero: R$ 78

## P5 — Disponibilidade
- **DECIDIDO:** regra da seção 3.4.
  - Massa: só a chave manual.
  - Doces: chave + estoque − reservado.
- Na Black **não há tela no Jarvis**. A chave "Esgotado" é operada pelo Luccas (SQL/MCP). Uma tela fica para depois.

## P6 — Endereço
- **DECIDIDO:** o endereço de entrega é do **pedido**.
  - Colunas novas e anuláveis de endereço de entrega em `vendas`.
  - O W5 (`avisos-entrega`) e o `apps/entregador` passam a usar o endereço da venda quando existir; senão, o do contato. **Mudança autorizada fora de `apps/loja`, só isso.**
- Contato existente: a loja **nunca sobrescreve**, só preenche campos vazios. Contato novo: criado com o endereço do pedido.
- Quando isso existir, `criar_pedido` (catálogo) também passa a só preencher campos vazios. Tarefa separada, com OK.

## P7 — Frete e prazo
- **DECIDIDO:** frete por **taxa fixa por bairro/cidade** (como a Mont cobra hoje), na tabela `loja_frete_bairros`. O cálculo por distância do catálogo **não** entra na loja.
- **PENDENTE GILMAR:** a lista de bairros/cidades com os valores e a regra de prazo ("pagou até que horas, entrega quando"; se algum bairro só tem entrega em dia fixo).
- **DECIDIDO:** sai "Escolher outro dia" da tela 05. Mostrar só a data prevista calculada pela regra.

## P8 — Origem
- **DECIDIDO:** `'loja'` (nova), separada nos relatórios.

## P9 — Kit Top
- **PENDENTE GILMAR:** R$ 100 ou R$ 89 (recomendado R$ 89, geleia só morango ou frutas vermelhas).
- **DECIDIDO:** o doce de leite 400 g de brinde entra no rateio proporcional como os demais componentes. Isso não é "brinde" no sentido de `forma_pagamento='brinde'`.
- Os 3 SKUs "Kit Top — X (Black)" serão inativados (mudança de dado, com backup).

## P10 — Contabilidade do cartão
- **DECIDIDO:** `vendas.total` = valor efetivamente cobrado do cliente.
- A taxa real cobrada pela InfinitePay é lançada como despesa (proponha onde, sem implementar fora de `apps/loja` antes do OK).
- Pix e cartão caem na conta "InfinityPay - Mont".

## P11 — Pote 400 g
- **DECIDIDO:** R$ 25 → R$ 21 para doce de leite tradicional 400 g, doce de leite com coco 400 g e ambrosia 400 g.
- Abóbora com coco 400 g fica fora.

## P12 — Doces fora do wireframe
- **DECIDIDO:** cocada com maracujá 680 g e doce de leite com geleia de café 680 g entram na loja e nos grupos de doce 680 g.

## P13 — "Leva junto?"
- **DECIDIDO:** sempre o doce de leite tradicional 400 g; some se já estiver na sacola.

## P14 — Separado / Saiu para entrega
- **DECIDIDO:** como sugerido.
  - "Separado": no Jarvis, em lote.
  - "Saiu para entrega": botão "Iniciar rota" no `apps/entregador`.
- Fica para depois do lançamento (Fase 5).

## P15 — Meta
- **DECIDIDO:** para o canal `loja`, o `Purchase` sai no **pagamento aprovado** (CAPI no servidor + pixel na tela 07, com o mesmo `event_id`).
- Para pedidos do canal `loja`, **não** disparar `Purchase` de novo na entrega.
- O catálogo continua como está.

## Riscos aceitos e ações
- **Evolution no PC local:** o lembrete de 15 min depende do PC ligado. O cancelamento aos 30 min é no `pg_cron` e não depende dele. Luccas avalia levar Evolution e n8n para a VPS da Hostinger.
- **Pagamento sem descoberta ativa:** implementar o estado `pago_apos_cancelamento` com alerta, como proposto.
- **INSERT e EXECUTE públicos:** remediados em 30/10 (migrations `catalogo_fecha_escrita_publica` e `estoque_revoke_ajusta_item`).
