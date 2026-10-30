# Briefing — Loja Mont (Black 2026) · `apps/loja`

> Para o Claude Code. Escrito em 29/10/2026. Diretor: Luccas.
> Leia este arquivo inteiro, o `CLAUDE.md` da raiz e `docs/loja-black/wireframe/LEIA-ME.md` antes de qualquer ação.
> Trabalhe **uma fase por vez**. Ao fim de cada fase: pare, reporte ponto a ponto (regra do `CLAUDE.md`) e espere autorização.

## 1. O que é e por quê

A Mont vai rodar a **Black da Mont de 03/11 a 30/11/2026**, com anúncios no Meta levando para uma loja.
O catálogo atual (`apps/catalogo`) não converte: mistura institucional com loja, não é pensado para celular e não deixa o cliente escolher sabores dentro de um combo.

Vamos criar uma **loja nova**, mobile-first, em um app novo do monorepo: `apps/loja`.
**Não mexa em `apps/catalogo`** — ele continua no ar como está. Nada de reaproveitar componentes dele; padrões podem ser lidos como referência.

Objetivo da loja: o cliente que vem do anúncio escolhe produto e sabor, paga na hora (Pix ou cartão via InfinitePay), e o pedido entra **certo** no sistema interno (Jarvis), com cada sabor registrado.

Essa versão é a base definitiva: depois da Black virão área do cliente, login por código no WhatsApp, cashback/Saldo Mont e acompanhamento de pedido completo. Construa pensando nisso, mas **só o escopo deste briefing**.

## 2. A fonte da verdade visual: o wireframe

O wireframe aprovado está em `docs/loja-black/wireframe/` (9 telas, uma por arquivo `.dc.html`). **Siga 100%**: layout, ordem dos blocos, textos de interface, hierarquia, tamanhos, cores, estados (esgotado, 0/6, botão desabilitado), navegação entre telas.

Como ler os arquivos: veja `docs/loja-black/wireframe/LEIA-ME.md`. Resumo: estilos inline = especificação; `renderVals()` = dados de exemplo e lógica de estado; `<sc-for>` = lista; `<sc-if>` = condicional; `href="X.dc.html"` = navegação para a tela X.

O que **não** é literal no wireframe:
- **Dados de produto** (nomes, preços, sabores, estoque) são exemplos. Na loja vêm do banco (seção 5). Os nomes reais dos sabores no banco são diferentes do wireframe (ex.: "Doce de Leite com Geleia de Ameixa 680g", não "Ameixa").
- **Placeholders** entre colchetes (`[FRETE]`, `[DIA]`, `[NÚMERO]`, `[ENDEREÇO]`, `[SALDO]`) = dado do sistema ou decisão pendente (seção 9).
- **Retângulos tracejados "foto: …"** = fotos reais do storage do Supabase (bucket `products`).
- **Tela 09 (Área do cliente)** é fase 2: **não construir agora**.
- As **notas amarelas** do canvas viraram regras de negócio — estão na seção 6.

Qualquer divergência que você ache necessária em relação ao wireframe: **pare e pergunte**. Não "melhore" o layout por conta própria.

## 3. Stack (alinhada ao monorepo)

- `apps/loja`: Next.js 15 (App Router) + React 19 + TypeScript strict (estende `@mont/config`).
- Tailwind CSS v4.
- Zustand 5 para a sacola (persistida no `localStorage`, com leitura protegida).
- Zod 4 em todas as fronteiras (formulários, server actions, webhook).
- `@supabase/ssr` (clientes server/browser) + tipos de `@mont/shared`.
- `formatCurrency`, `formatPhone` e validadores de `@mont/shared`.
- Fontes via `next/font/google`: Anton (títulos, provisória da "Fonte A"), DM Sans (corpo), Instrument Serif itálico (provisória da "Fonte B").
- Imagens com `next/image` apontando para o storage público do Supabase.
- Deploy: novo projeto Vercel `mont-loja`, mesmo padrão de build dos outros apps (`turbo.json`, `globalEnv`).

**Nenhuma dependência fora dessa lista sem pedir.**
**Nada de service role no cliente.** Toda escrita passa por server action/route handler chamando RPC.

## 4. Fluxo (9 telas → rotas)

| Tela | Arquivo | Rota / componente | Fase |
|---|---|---|---|
| 01 Loja, página única | `Main.dc.html` | `/` | 1 |
| 02 Produto | `Produto.dc.html` | painel por cima de `/` (não troca de página) | 1 |
| 03 Combo — escolher sabores | `Combo.dc.html` | `/combo/[slug]` | 1 |
| 04 Sacola + frete | `Sacola.dc.html` | `/sacola` | 1 |
| 05 Seus dados | `Dados.dc.html` | `/checkout/dados` | 2 |
| 06 Pagamento | `Pagamento.dc.html` | `/checkout/pagamento` | 3 |
| 07 Pedido confirmado | `Confirmado.dc.html` | `/pedido/[token]/confirmado` | 3 |
| 08 Acompanhar pedido | `Status.dc.html` | `/pedido/[token]` | 5 |
| 09 Área do cliente | `Conta.dc.html` | **não construir** | — |

`[token]` = identificador público e não adivinhável do pedido. Nunca o UUID interno ou um número sequencial.

## 5. Dados — o que já existe (diagnóstico prévio, 29/10)

Use isto como ponto de partida e **confirme tudo na Fase 0**:

- **`produtos`** já tem `preco`, `preco_ancoragem`, `categoria` (`refrigerado`, `doces`, `congelado`, `combo`), `eh_combo`, `visivel_catalogo`, `estoque_atual`, `slug`, `ordem_vitrine`, `secao_id`.
- **Combos da Black já cadastrados como um produto por sabor** (ex.: "Kit Top — Geleia de Goiaba (Black)"). É exatamente o que **não** queremos. O modelo certo é **um combo com itens fixos + grupos de escolha** (ex.: Combo Família = 1 balde 4 kg + 2 baldinhos 1 kg fixos + "escolha 6 doces 680 g", podendo repetir). O pedido precisa registrar cada sabor escolhido como item, para o estoque e o Jarvis enxergarem.
- **`estoque_atual` não é confiável hoje** (há negativos, ex.: Massa 1 kg −34, Massa 4 kg −7). A disponibilidade de um sabor na loja **não pode** depender só desse número. Proponha uma regra na Fase 0, por exemplo uma flag de "disponível na loja" ou estoque > 0 só para doces depois da contagem física.
- **Pipeline de pedido do catálogo:**
  - `criar_pedido(...)` cria `cat_pedidos` + `cat_itens_pedido` + `vendas` + `itens_venda`.
  - Os triggers `fn_sync_cat_pedido_to_venda` e `fn_sync_venda_to_cat_pedido` mantêm os dois lados em sincronia.
  - `fn_cat_pedidos_link_contato` liga o pedido ao contato.
  - Os triggers de estoque (`fn_estoque_*`) mexem no estoque.
  - A loja nova deve **entrar por esse pipeline** (ou por uma evolução dele), para que o pedido apareça no Jarvis. Não pode haver um caminho paralelo que o Jarvis não veja.
- **`vendas.status`** hoje só tem `entregue` e `cancelada`. Já existem `ordem_rota`, `entregador_id` e `data_entrega_prevista`. Os estados do acompanhamento (recebido, pago, separado, saiu para entrega, entregue) **não existem como dado**.
- **`contatos`** tem `telefone_norm` e `telefone_wa`. Use-os para ligar pedido a cliente.
- **Preço da Black:** `produtos.preco` é o preço normal. A Black vale só à vista e só de 03 a 30/11, e o fiado continua com preço normal no Jarvis. **Não sobrescreva `produtos.preco`.** Proponha uma camada de preço de campanha com início e fim.
- **Valores em reais** (numeric). Horário de São Paulo em tudo.

## 6. Regras de negócio (inegociáveis)

1. **Preço calculado no servidor.** O cliente nunca envia preço; o servidor recalcula tudo a partir do banco.
2. **Preços da Black (Pix)**, de 03/11 00:00 a 30/11 23:59 (horário de SP):
   - **Avulsos (de → por):**
     - Balde 4 kg: R$ 75 → R$ 65
     - Baldinho 1 kg: R$ 30 → R$ 27
     - Doce 680 g: R$ 35 → R$ 29
     - Geleia de morango: R$ 39 → R$ 33
     - Geleia de frutas vermelhas: R$ 41 → R$ 35
     - Geleia de goiaba: R$ 29 → R$ 25
     - Pote 400 g: R$ 25 → R$ 21
     - Zero 400 g: R$ 45 → R$ 39
   - **Combos:**
     - Combo Família (balde 4 kg + 2 baldinhos 1 kg + 6 doces 680 g à escolha): R$ 199
     - Balde + doce (balde 4 kg + 1 doce 680 g à escolha): R$ 85
     - Kit Top (2 baldinhos 1 kg + 1 geleia 680 g + doce de leite 400 g de brinde): R$ 100 — **preço pendente**
     - 3 doces (3 doces 680 g à escolha): R$ 79
     - Dupla Zero (2 zero 400 g à escolha): R$ 75
3. **Cartão = preço com a taxa da maquininha somada.** A tabela aprovada é a fonte; o sistema tem que reproduzi-la exatamente, centavo por centavo.
   - O par "Combo Família + Baldinho" da tela 06 dá Pix R$ 226 · débito R$ 230 · crédito 1x R$ 234 · 2x R$ 240.
   - A tabela completa por produto está no plano da Black; peça ao Luccas.
4. **Congelados não aparecem na loja da Black**, como no wireframe (a promoção é só em massa e doces). Confirmação pendente na seção 9.
5. **Só "pagar agora"** (Pix ou cartão pela InfinitePay). Sem "pagar na entrega" e sem fiado na loja.
   - A tela 06 tem um link discreto "Prefere pagar na entrega? Fale com a gente no WhatsApp".
   - **Conte os cliques** nesse link, para o Luccas decidir se a opção volta.
6. **Pedido só vira "pago" depois que o servidor confere na InfinitePay** (`payment_check`). Nunca confie só no webhook.
7. **Pedido não pago:** lembrete no WhatsApp aos **15 min**; cancelamento automático aos **30 min**, liberando o que estava reservado.
8. **Separação só com pagamento aprovado.**
9. **Privacidade — sem código de verificação na Black:**
   - A tela 05 **nunca** mostra nome ou endereço salvos para um número digitado.
   - O pedido é ligado ao contato existente **só no servidor**, pelo telefone normalizado.
   - A rua é preenchida pelo CEP.
10. **Autorização de ofertas no WhatsApp:** checkbox separada, desmarcada por padrão. Grave a autorização com data e hora (LGPD).
11. **Combo:** o botão só libera quando o grupo de escolha está completo (ex.: 6/6). Pode repetir sabor. Sabor indisponível aparece desabilitado com "Esgotado".
12. **Frete:** calculado pela tabela de bairros (seção 9). Bairro fora da tabela → mensagem para falar no WhatsApp, sem fechar pedido.
13. **Mensagens ao cliente** (resumo, lembrete, status):
    - Cada texto precisa do **OK do Luccas** antes de ligar. Fica tudo atrás de uma flag **desligada** por padrão.
    - Nunca imprimir ou commitar a chave da Evolution API.
    - Falar como equipe ("Separamos", "Seu pedido"), nunca em primeira pessoa do singular.
14. **Voz da marca:** sem "premium", "gourmet" ou "feito com amor". Os textos de interface do wireframe já seguem isso.

## 7. Fases e critérios de aceite

### Fase 0 — Diagnóstico (somente leitura)
Leia e explique:
- `criar_pedido` e os triggers de sincronia, estoque e vínculo de contato;
- como `eh_combo` é tratado hoje;
- as RLS das tabelas `cat_*`;
- como o catálogo atual monta a sacola e envia o WhatsApp;
- onde o monorepo já fala com a Evolution API (se fala).

Entregue um documento `docs/loja-black/diagnostico-fase0.md` com:
- O caminho que o pedido vai fazer, da loja até o Jarvis, e o que precisa mudar nele.
- **Proposta de modelo de dados**, só em descrição, sem SQL ainda. Precisa cobrir:
  - combo com itens fixos e grupos de escolha;
  - preço de campanha com período;
  - preço no cartão;
  - disponibilidade de sabor;
  - campos de pagamento da InfinitePay (`order_nsu`, `transaction_nsu`, `slug`, `capture_method`, `receipt_url`);
  - status e histórico do pedido;
  - token público;
  - expiração;
  - tabela de frete por bairro;
  - autorização de ofertas;
  - contador de cliques do "pagar na entrega".
- **InfinitePay — verificar e responder:**
  - O link de checkout aceita restringir a forma de pagamento (só Pix ou só cartão)?
  - Se não aceita, o cliente escolhe Pix ou cartão já na página da InfinitePay. Aí um link criado com o preço do Pix deixa o cartão sem a taxa, e um link com o preço do cartão faz quem paga no Pix pagar a mais. Proponha a solução e **pare para o Luccas decidir**.
  - Docs: https://www.infinitepay.io/checkout-documentacao
- Riscos e lista de migrations previstas.

**Aceite:**
- Nenhum arquivo de código alterado e nenhum SQL de escrita.
- Documento entregue.
- Perguntas abertas listadas.

### Fase 1 — App e vitrine (sem escrita no banco)
`apps/loja` criado e rodando (`pnpm --filter loja dev`), com as telas 01, 02, 03 e 04 fiéis ao wireframe:
- produtos e combos lidos do banco;
- sacola funcionando e persistida;
- barra "Ver sacola" fixa no rodapé;
- painel de produto por cima da loja;
- combo com contador e bloqueio;
- "Leva junto?" na sacola.

**Aceite:**
- `tsc` e build verdes.
- Zero `as any`.
- As 4 telas conferidas pelo Luccas no navegador do celular (ele valida; você não tira screenshot).

### Fase 2 — Pedido no sistema
- Migrations aprovadas, seguindo o protocolo do `CLAUDE.md`: backup → migration versionada → `SELECT` confirmando o efeito.
- Tela 05.
- Criação atômica do pedido: preço recalculado no servidor, sabores do combo como itens, vínculo com o contato pelo telefone, status "aguardando pagamento".

**Aceite:**
- Um pedido de teste aparece no Jarvis com cada sabor listado e o total certo.
- Com `SELECT`, mostrar `cat_pedidos`, os itens e `vendas` desse pedido.
- Pedido de teste limpo depois, com backup em CSV antes do `DELETE`.

### Fase 3 — Pagamento InfinitePay
- Telas 06 e 07.
- Criação do link com `order_nsu`.
- `redirect_url` e webhook (route handler, resposta rápida).
- Conferência com `payment_check` antes de marcar como pago.
- Pagamento registrado no Jarvis como venda paga, pelo caminho que ele já usa (`registrar_pagamento_venda` ou equivalente).
- Job de 15 e 30 min: Vercel Cron ou `pg_cron` (proponha qual).

**Aceite:**
- Teste real de ponta a ponta com um item de R$ 1, Pix e cartão.
- Pedido não pago cancelado sozinho aos 30 min.
- Evidências por `SELECT`.

### Fase 4 — Mensagens no WhatsApp (flag desligada)
- Resumo do pedido, lembrete de 15 min e mudanças de status, pelo canal que o diagnóstico apontar.
- Textos em um arquivo único para o Luccas aprovar.

**Aceite:**
- Com a flag ligada, um envio de teste para o número do Luccas.
- Com a flag desligada, nenhum envio.

### Fase 5 — Acompanhar pedido (tela 08)
- A página mostra os 5 passos do wireframe.
- "Recebido" e "Pago" são automáticos.
- "Separado" e "Saiu para entrega" precisam de uma ação de quem opera (Jarvis ou `apps/entregador`). Proponha onde, sem implementar fora de `apps/loja` antes de aprovar.
- "Você é a Nª parada" usa `vendas.ordem_rota`, quando existir.

## 8. Fora de escopo agora
- Tela 09 / área do cliente.
- Login com código.
- Cashback, Saldo Mont e depósito.
- Pagar na entrega.
- Lojas de app.
- PWA.
- Congelados.
- Qualquer mudança em `apps/catalogo`, `apps/interno` ou `apps/entregador` sem aprovação explícita.

## 9. Decisões pendentes (com o Luccas)
- Tabela de frete por bairro e dias de rota por bairro.
- Quais sabores entram em cada combo (as geleias entram?).
- Preço do Kit Top: R$ 100 ou R$ 89.
- Domínio da loja (sugestão: `loja.montdistribuidora.com.br`, com os anúncios apontando para ele).
- Solução para o preço do cartão no checkout da InfinitePay (sai da Fase 0).
- Regra de disponibilidade de sabor (sai da Fase 0).
- Congelados (preço normal) entram ou não na loja durante a Black.

## 10. Referências
- Wireframe (canvas, só leitura): https://claude.ai/artifact/E2KTqtUQ6NXazo9N6GxsY8 — cópia local em `docs/loja-black/wireframe/`.
- Análise da loja de referência (Adega Anita's): https://claude.ai/artifact/TfoZ9GCBCi1mMyt4ULVbXk
- Guia de marca: skills `mont-brand-voice` e `mont-design-guide`.
