# Diagnóstico — Fase 0 · Loja Mont (Black 2026)

> 29/10/2026 · somente leitura. Nenhum arquivo de código alterado, nenhum SQL de escrita.
> Fontes: banco de produção (`herlvujykltxnwqmwmyx`, só `SELECT`/catálogo do Postgres), código do monorepo, wireframe em `docs/loja-black/wireframe/`, documentação pública da InfinitePay (https://www.infinitepay.io/checkout-documentacao).

---

## 0. Correções ao diagnóstico prévio do briefing (seção 5)

| Premissa do briefing | O que o banco mostra hoje |
|---|---|
| "`vendas.status` só tem `entregue` e `cancelada`" | O `CHECK` aceita **`pendente`, `entregue`, `cancelada`**. `criar_pedido` cria a venda como `pendente`. O que é verdade: hoje **não há nenhuma** venda `pendente` em `vendas` (todas viraram `entregue`/`cancelada`). |
| Massa 1 kg com estoque −34 | Agora **−35**. Massa 4 kg −7, Palito 1 kg −5, Pão de queijo 1 kg 25 g −109. Os **doces estão todos ≥ 0** (houve contagem física em 29/09, migration `estoque_contagem_fisica`). |
| "Combos da Black cadastrados como um produto por sabor" | Vale para o **Kit Top** (3 produtos: goiaba, morango, frutas vermelhas, R$ 100 cada). A **Dupla Zero** existe como combo fixo (1 DL zero + 1 brigadeiro zero), não como escolha. **Combo Família, Balde + doce e 3 doces não existem** no banco. |
| `contatos` tem `telefone_norm` e `telefone_wa` | Confirmado. As duas são **colunas geradas**, ambas com índice único. `telefone_wa = fn_telefone_wa(telefone)` (formato `55DD9XXXXXXXX`). 11 contatos têm `telefone_wa` nulo (telefone fora do padrão). Zero duplicados. |
| `produtos.categoria` ∈ refrigerado/doces/congelado/combo | Há também `cervejas`, `refrigerantes` e `''` (vazio), todos inativos, mais "Pão de Queijo 2kg - 100gr", ativo e com categoria vazia. |
| Fuso | O banco roda em **UTC** (`TimeZone = UTC`). `criar_pedido` usa `current_date` → depois das 21h de SP grava a data do dia seguinte. Tudo que for da loja precisa usar `America/Sao_Paulo` explicitamente. |

---

## 1. Como as coisas funcionam hoje

### 1.1 `criar_pedido` (RPC, `SECURITY DEFINER`, `search_path=public`)

Executável por **`anon`**, `authenticated` e `service_role`. O catálogo chama a função pelo route handler `apps/catalogo/src/app/api/pedidos/route.ts`, com service role.

Passo a passo:

1. Insere `cat_pedidos` com `status='pendente'` e `status_pagamento='pendente'`. O nome é capitalizado (`fn_capitalize_name`). **Subtotal, frete e total vêm do chamador.**
2. Para cada item de `p_itens`, insere `cat_itens_pedido`. **`unit_price` e `total` também vêm do chamador.**
3. Dentro de um bloco `BEGIN … EXCEPTION WHEN OTHERS`:
   - acha o contato por `regexp_replace(telefone,'[^0-9]','')`. Não usa `telefone_norm` nem `telefone_wa`, e o predicado não aproveita o índice;
   - **contato novo:** cria com `origem='catalogo'`, `origem_cadastro='catalogo'`, `tipo='B2C'`, `status='cliente'` e endereço completo;
   - **contato existente:** **sobrescreve o endereço** (`COALESCE(p_x, x)`) e, se o nome digitado tiver mais palavras, **sobrescreve o nome**;
   - grava o `contato_id` no pedido;
   - insere `vendas` com `status='pendente'`, `pago=false`, `origem='catalogo'`, `cat_pedido_id`, `taxa_entrega=p_frete`, `data=current_date` (UTC);
   - insere `itens_venda` com `custo_unitario` lido de `produtos.custo` e atualiza `vendas.custo_total`.
4. **Se qualquer coisa do passo 3 falhar, o erro é engolido**: grava uma linha em `cat_pedidos_pendentes_vinculacao` e a função retorna sucesso. O pedido existe, mas a venda não. Hoje essa fila está vazia, e o Jarvis tem a tela `#/catalogo-pendentes` para vincular à mão.
5. Retorna `{id, numero_pedido, status, total}`.

O route handler do catálogo **recalcula os preços** a partir de `produtos.preco` e o frete pelo servidor (distância de rota via ORS + `configuracoes.frete_config`). A RPC em si **não recalcula nada**.

### 1.2 Triggers envolvidos

| Tabela | Trigger | Quando | O que faz |
|---|---|---|---|
| `cat_pedidos` | `tr_cat_pedidos_link_contato` → `fn_cat_pedidos_link_contato` | BEFORE INSERT | `contato_id` por **igualdade exata** de `telefone = telefone_cliente`. Depende do formato; na prática, o `criar_pedido` sobrescreve depois. |
| `cat_pedidos` | `tr_sync_cat_pedido_to_venda` → `fn_sync_cat_pedido_to_venda` | AFTER UPDATE | Só age quando o pedido vira `entregue` **e não existe venda**: cria contato e venda **já `entregue` e `pago=true`**, e copia os itens. É uma rede de segurança legada: como `criar_pedido` já cria a venda, hoje vira no-op. |
| `vendas` | `tr_sync_venda_to_cat_pedido` → `sync_venda_to_cat_pedido` | AFTER UPDATE, se `status` ou `pago` mudou | Reescreve `cat_pedidos.status` (`cancelada→cancelado`, senão copia) e `status_pagamento` (`pago`/`pendente`). **Ele sobrescreve qualquer status mais rico do pedido**: um pedido em `preparando` volta a `pendente` no momento em que o pagamento é registrado. |
| `vendas` | `trigger_stock_on_status_change` → `handle_stock_on_status_change` | AFTER UPDATE OF status | Entrou em `entregue`: baixa estoque (`fn_estoque_aplica_venda(-1)`). Saiu de `entregue`: devolve. Brinde lança despesa. |
| `vendas` | `trigger_stock_on_venda_delete` → `fn_estoque_on_venda_delete` | BEFORE DELETE | Se a venda era `entregue`, devolve o estoque. |
| `itens_venda` | `trigger_estoque_item_venda_entregue` → `fn_estoque_item_venda_entregue` | AFTER INSERT/DELETE | Só age se a venda já estiver `entregue` (caso de venda que nasce entregue). |
| `vendas` | `trg_enfileirar_purchase_meta` | AFTER INSERT/UPDATE OF status, forma_pagamento | Ao virar `entregue` (não brinde), enfileira `Purchase` na Meta CAPI. |
| `vendas` | `trg_venda_resolve_relacionamento`, `trg_venda_fecha_lembretes`, `trg_venda_remarcada_reabre_aviso`, `trigger_brinde_*`, `tr_vendas_audit` | vários | Kanban de relacionamento, agenda, brinde e auditoria. Não mexem no fluxo da loja, mas disparam junto. |
| `pagamentos_venda` | `trigger_update_venda_pagamento` → `update_venda_pagamento_summary` | AFTER I/U/D | Recalcula `valor_pago` e `pago = SUM(valor) >= total`. |
| `pagamentos_venda` | `trg_bloquear_pagamento_em_brinde` | BEFORE I/U | Invariante do brinde. |

**Estoque:** `fn_ajusta_estoque_item` **explode combos** (`eh_combo=true`) pelos componentes de `produto_componentes` (quantidade fixa). **Não existe reserva**: o estoque só se mexe na entrega. "Liberar o que estava reservado" aos 30 min ainda não tem onde se apoiar.

**Pagamento no Jarvis:** `registrar_pagamento_venda(venda, valor, metodo, data, conta_id, obs)` exige `is_admin()` **ou** `service_role`. Ela chama `_pagamento_venda_core`, que insere `pagamentos_venda` e dois `lancamentos`, separando produto e frete na proporção `taxa_entrega/total`. A conta da InfinitePay já existe em `contas`: "InfinityPay - Mont" (`codigo='PIX'`).

### 1.3 Como `eh_combo` é tratado hoje

- **Banco:** `produtos.eh_combo` + `produto_componentes(combo_id, componente_id, quantidade)` (único por par, sem autorreferência). A composição se edita pela RPC `replace_combo_componentes` (só admin). O estoque explode pelos componentes. A view `rpt_giro_estoque` exclui combos (migration `giro_estoque_sem_combos`).
- **Jarvis:** formulário de produto com toggle "combo" e editor de componentes; custo exibido = soma dos componentes; ícone "combo" na grade e na curadoria de seções.
- **Catálogo:** trata combo como produto comum (um SKU com preço próprio).
- **Limite estrutural:** o modelo só descreve composição **fixa**. Não existe "grupo de escolha" nem registro do sabor escolhido. Por isso o Kit Top virou 3 SKUs. Há também combos antigos com `eh_combo=false` e sem componentes ("Combo Balde 4kg + Palito 1kg", "Combo Balde 4kg + Pão de Queijo 1kg", "kit BALDÃO", "Kit Mãezona"). Esses não baixam estoque de nada.

### 1.4 RLS das tabelas `cat_*` (e vizinhas)

| Tabela | Policies |
|---|---|
| `cat_pedidos` | `Admin manage orders` (authenticated, ALL, `is_admin()`) · **`Public insert orders` (public, INSERT, `true`)** |
| `cat_itens_pedido` | `Admin manage items` · **`Public insert items` (public, INSERT, `true`)** |
| `cat_pedidos_pendentes_vinculacao` | só admin |
| `cat_imagens_produto` | admin ALL · leitura pública |
| `cat_secoes` | admin ALL · anon lê as ativas (`Combos` está `ativa=false`) |
| `produtos`, `produto_componentes` | admin ALL · **leitura pública total** (inclui `custo`) |
| `contatos` | admin ALL + admin UPDATE (duplicada) · **`Public insert access` (INSERT, `true`)** |
| `vendas`, `itens_venda` | só admin |

Ninguém de fora lê `cat_pedidos`. Pela RLS atual, uma página pública de status precisa passar pelo servidor da loja ou por uma RPC dedicada que devolva só campos seguros. Os INSERTs públicos estão marcados como intencionais (checkout do catálogo) na skill `supabase-mont`. **Não mexer** sem aprovação; os riscos estão na seção 6.

### 1.5 Como o catálogo monta a sacola e envia o WhatsApp

- **Sacola:** Zustand + `persist` (`localStorage`, chave `mont-cart-storage`), sem validação na leitura. Guarda o **objeto `ProdutoCatalogo` inteiro**, com preço. O total exibido é calculado no cliente. Cada SKU vira uma linha (sem variações). Dispara `add_to_cart`/`remove_from_cart` no dataLayer.
- **Checkout (`/carrinho`):** manda só `product_id` e `quantity` para `POST /api/pedidos`. O servidor valida com Zod, recalcula preço e frete e chama `criar_pedido` com service role. Em seguida o cliente dispara `pedido_enviado` (GTM) e `InitiateCheckout` server-side (Meta), **monta o texto no navegador** (`lib/whatsapp/checkout.ts`), abre `wa.me/<número>?text=…` e limpa a sacola.
- **O pagamento combinado no WhatsApp é humano.** A venda é marcada como paga ou entregue no Jarvis. O `Purchase` só vai para a Meta na entrega (decisão de 13/10, migration `catalogo_purchase_na_entrega`).

### 1.6 Onde o monorepo fala com a Evolution API

- **A Evolution roda local**, em Docker na máquina do dev (`infra/crm/docker-compose.yml`, `evoapicloud/evolution-api:v2.3.7`, instância `mont`, escutando só `127.0.0.1`). O número é o **principal do Gilmar**, como aparelho vinculado.
- **Quem envia é sempre o n8n local** (`http://evolution:8080/message/sendText/mont`, credencial "Evolution API (apikey)"): W3 secretária, W4 abandono, W5 avisos de entrega, W6 agenda.
- **Supabase e Vercel não alcançam a Evolution.** O padrão já usado (`supabase/functions/avisos-entrega`) é **pull**: a Edge Function diz o que enviar (ação `devidos`, protegida por `x-ingestor-secret`), o n8n consulta a cada 5 min, envia e chama `marcar_enviado`. Flags por variável de ambiente (`AVISOS_*`) já existem nesse padrão.
- `wa_envios(message_id, telefone_wa, contato_id, texto)` registra o que a máquina enviou. A secretária usa essa tabela para distinguir humano de máquina (prioridade humana). **Toda mensagem da loja precisa entrar aí**, senão o sistema lê a mensagem como resposta humana e cala a secretária naquela conversa.
- `pg_cron` e `pg_net` estão instalados. Há 4 jobs ativos: meta-capi diário, meta-ads diário, purga mensal do WhatsApp e analista a cada 15 min.

### 1.7 Outros pontos que tocam a loja

- **Fluxo de entrega:** `avisos-entrega` (W5) publica no grupo #ENTREGAS **toda venda `pendente` com `data_entrega_prevista`**, lendo **o endereço do contato** (não do pedido). O app `apps/entregador` lista, reordena (`entregador_reordenar_rota` → `vendas.ordem_rota`) e marca entregue.
- **Telas do Jarvis que leem `vendas` pendentes ou não pagas:** `view_home_operacional`, `crm_view_operational_snapshot`, `rpt_distribuicao_forma_pagamento`, `aceitou_sem_venda`, a lista de Vendas com pendentes e os relatórios de "a receber".
- **Jarvis e `cat_pedidos`:** o Jarvis só mostra `cat_pedidos` no perfil do contato (`catalogService.getPedidosByContato`) e na fila de pendentes de vinculação. **O pedido "aparece no Jarvis" porque existe a venda.**
- **Frete atual do catálogo:** distância de rota (ORS) + `frete_config.faixas` (até 20 km R$ 5, até 30 km R$ 10, até 50 km R$ 15). Não existe tabela por bairro nem dias de rota.

---

## 2. O caminho do pedido: hoje e proposto

### Hoje (catálogo)
```
navegador ─POST /api/pedidos─▶ route handler (service role, recalcula preço/frete)
   └▶ criar_pedido ─▶ cat_pedidos + cat_itens_pedido ─▶ contatos (cria OU sobrescreve)
                  └▶ vendas(pendente, pago=false) + itens_venda   [falha → pendentes_vinculacao]
navegador ─▶ wa.me com texto ─▶ humano combina pagamento ─▶ Jarvis marca pago/entregue
   └▶ triggers: estoque na entrega · Purchase Meta na entrega · sync venda→cat_pedidos
```

### Proposto (loja)
```
1. /sacola, /checkout/dados ─▶ server action (Zod) ─▶ RPC nova `loja_criar_pedido` (service role)
     · recalcula TUDO no banco: preço de campanha vigente (SP), combos, frete por bairro
     · valida grupos de escolha (ex.: 6/6) e disponibilidade; reserva (lock nas linhas de doce)
     · liga ao contato por telefone_wa, SEM sobrescrever dados de contato existente
     · cria cat_pedidos (canal=loja, status=aguardando_pagamento, token, expira_em=+30min)
       + cat_itens_pedido (um item por componente/sabor, agrupados pela instância do combo)
     · grava autorização de ofertas (se marcada) · transação única, sem engolir erro
2. /checkout/pagamento ─▶ escolha do método ─▶ server action cria link InfinitePay
     (order_nsu = id público da tentativa; guarda slug/url em loja_pagamentos) ─▶ redirect
3. InfinitePay ─▶ redirect_url (/pedido/[token]/confirmado?…) e webhook (route handler, 200 rápido)
     ambos ─▶ payment_check (handle + order_nsu + transaction_nsu + slug)
     paid=true ─▶ RPC `loja_confirmar_pagamento` (idempotente por transaction_nsu):
        · cria vendas + itens_venda (cada sabor = uma linha)  ← o pedido entra no Jarvis aqui
        · registra o pagamento pelo caminho de sempre (_pagamento_venda_core, conta InfinitePay)
        · status=pago + histórico
4. pg_cron (1 min): aguardando_pagamento com expira_em vencido → cancelado (reserva some sozinha)
   n8n (pull, flag desligada): lembrete aos 15 min, resumo, mudanças de status
5. Separado / Saiu para entrega: ação humana (Jarvis ou apps/entregador) → histórico → WhatsApp
   Entregue: o fluxo atual (venda entregue → estoque baixa → Purchase Meta)
```

### O que precisa mudar no caminho

1. **Não reaproveitar `criar_pedido` como está.** Ela confia no preço do chamador, sobrescreve contato, engole erro e usa data UTC. A proposta é uma **RPC nova da loja**, sem tocar a do catálogo, que continua no ar. Ela escreve nas **mesmas tabelas** (`cat_pedidos`, `cat_itens_pedido`, `vendas`, `itens_venda`, `pagamentos_venda`), então não existe caminho paralelo que o Jarvis não veja.
2. **Quando nasce a venda — decisão do Luccas (pergunta P1).** Recomendo **criar a venda só com o pagamento confirmado**:
   - Venda `pendente` não paga **vazaria para o #ENTREGAS** (W5 publica toda venda pendente com data prevista) e para as listas e KPIs de pendentes e "a receber".
   - Com tráfego de anúncio, os abandonos de checkout virariam **dezenas de vendas canceladas** no Jarvis.
   - A regra 8 ("separação só com pagamento aprovado") fica garantida pela própria estrutura.
   - Custo: antes do pagamento, o pedido só aparece no perfil do contato (via `cat_pedidos`). O aceite da Fase 2 ("pedido de teste aparece no Jarvis com cada sabor") precisaria ser verificado **após um pagamento**, ou por uma confirmação manual de teste.
   - A alternativa seria criar a venda no ato e excluir os pedidos da loja aguardando pagamento de W5, das views e das listas. São ~6 views e 1 Edge Function, todas fora de `apps/loja`.
3. **`sync_venda_to_cat_pedido` precisa parar de rebaixar status** dos pedidos da loja (hoje registrar o pagamento joga o pedido de volta para `pendente`). Também o `vendaService` do interno sincroniza `cat_pedidos` pelo cliente. Os dois precisam respeitar o canal `loja`.
4. **Endereço por pedido.** A loja não pode sobrescrever o contato (regra 9), mas o W5 e o entregador leem o endereço **do contato**. Precisa decidir onde vive o endereço da entrega da loja (pergunta P6).
5. **Reserva de estoque** passa a existir, calculada a partir de pedidos abertos. Ver 3.4.
6. **Fuso:** campanha, `data` da venda, expiração e "próxima rota" sempre em `America/Sao_Paulo`.

---

## 3. Proposta de modelo de dados (descrição, sem SQL)

Princípio: **não mudar o significado de colunas que o catálogo e o Jarvis já usam.** Coisas novas da loja ficam em tabelas novas. As tabelas compartilhadas ganham só colunas novas, todas anuláveis.

### 3.1 Combo com itens fixos + grupos de escolha
- **Itens fixos:** reaproveitar `produto_componentes`, que já existe, já tem UI no Jarvis e já tem a RPC `replace_combo_componentes`. Combo Família = balde 4 kg ×1 + baldinho 1 kg ×2.
- **`combo_grupos`** (nova): `combo_id` → produtos, `titulo` ("Escolha 6 doces de 680 g"), `quantidade` (6), `permite_repetir` (sim), `ordem`.
- **`combo_grupo_opcoes`** (nova): `grupo_id`, `produto_id`, `ordem`. Os sabores reais (ex.: "Doce de Leite com Geleia de Ameixa 680g").
- **Kit Top:** fixos 2 baldinhos + DL tradicional 400 g (o brinde) e grupo "1 geleia 680 g" com 3 opções. Os 3 SKUs "Kit Top — X (Black)" seriam inativados (mudança de dado, com backup).
- **Dupla Zero:** sem fixos, grupo "2 zero 400 g" com 2 opções e repetição permitida (hoje é 1+1 fixo).
- **Como o pedido registra o combo:** cada componente e cada sabor vira **uma linha** em `cat_itens_pedido` e, depois, em `itens_venda`, apontando para o produto real (balde, baldinho, cada doce). As linhas do mesmo combo levam um identificador comum da instância do combo, o `combo_id` (o produto combo) e, se for o caso, o `grupo_id`.
  - O estoque baixa com os triggers que já existem, sem tocar em `fn_ajusta_estoque_item`, porque a linha nunca é o SKU combo, então não há explosão dupla.
  - O Jarvis lista cada sabor sem mudar nada.
  - O custo fica certo por SKU.
  - Exige **colunas novas anuláveis** em `cat_itens_pedido` e em `itens_venda` (tabela compartilhada). O Jarvis pode, depois, agrupar visualmente por combo.
- **Rateio do preço do combo entre as linhas:** proporcional ao preço avulso de cada componente, com o resíduo de centavos na última linha, para que a soma bata com o preço do combo. Sem rateio, a margem por SKU e o ranking ficam errados. O brinde do Kit Top entra no rateio com valor 0 ou proporcional (pergunta P9).

### 3.2 Preço de campanha com período
- **`loja_campanhas`**: `nome` ("Black da Mont 2026"), `inicio`/`fim` em `timestamptz` gravados com −03:00 (03/11 00:00 → 30/11 23:59:59 SP), `ativa`.
- **`loja_precos`**: `campanha_id`, `produto_id` (avulso **ou** combo), `preco_pix` (o "por"). O "de" exibido é o `produtos.preco`, que fica intocado. Atenção: `preco_ancoragem` hoje tem outros números (balde 99, doces 40), e o wireframe usa o preço normal (75, 35).
- Fora do período, ou sem linha de campanha, vale `produtos.preco`. Combos só existem dentro da campanha.
- O fiado no Jarvis continua com `produtos.preco`, porque nada do Jarvis lê essas tabelas.

### 3.3 Preço no cartão
- A regra é reproduzir a **tabela aprovada centavo por centavo**. Em vez de fórmula, **guardar os valores da tabela**: em `loja_precos`, colunas `preco_debito`, `preco_credito_1x`, `preco_credito_2x` por produto e combo.
  - Tentei derivar uma taxa única dos dois exemplos do wireframe e **ela não fecha**: balde 65 → 66/68/69; par 226 → 230/234/240. A razão do crédito 1x dá 4,6% num e 3,5% no outro. Logo há arredondamento por item, ou taxa sobre o total com arredondamento próprio.
- **Pergunta P3:** o total no cartão é a **soma dos preços de cartão de cada item** ou a **taxa aplicada sobre o total**? E o **frete** leva taxa? A tela 06 diz "Frete à parte". Sem a tabela completa não dá para confirmar o exemplo de R$ 226.

### 3.4 Disponibilidade de sabor (proposta de regra)
- **`loja_vitrine`** (nova, por produto): `visivel` (aparece na loja), `disponivel` (chave manual "Esgotado"), `secao` (combos/massa/doces/zero), `ordem`, `destaque_hero`, `leva_junto`. Fica separada de `visivel_catalogo` para o catálogo não mudar.
- **Regra proposta:**
  - **Massa:** só a chave manual. O estoque é negativo e não confiável, e massa é produzida sob demanda.
  - **Doces (680 g, 400 g, zero, geleias):** chave manual **e** `estoque_atual − reservado ≥ quantidade pedida`. Os doces foram contados em 29/09 e estão todos ≥ 0.
  - **Reservado** = soma dos sabores em pedidos da loja `aguardando_pagamento` (não expirados) + pagos ainda não entregues. É calculado, nunca subtraído do estoque. Por isso o cancelamento aos 30 min "libera" sozinho.
  - Na criação do pedido, travar as linhas dos doces envolvidos (`FOR UPDATE`) para dois clientes não levarem o último pote.
- **Pergunta P5:** confirmar a regra. E o Gilmar precisa operar a chave "Esgotado" pelo Jarvis (tela fora de `apps/loja`).

### 3.5 Campos de pagamento da InfinitePay
- **`loja_pagamentos`** (nova, **N por pedido**: o cliente pode trocar de método e cada link é novo):
  - `cat_pedido_id`, `metodo_escolhido` (pix | debito | credito_1x | credito_2x), `valor_cobrado` (reais);
  - `order_nsu` (identificador público da tentativa), `slug` (invoice slug), `checkout_url`;
  - `transaction_nsu` (único), `capture_method`, `installments`, `amount`/`paid_amount` (convertidos para reais na fronteira), `receipt_url`;
  - `status` (criado | pago | divergente | expirado | pago_apos_cancelamento), `conferido_em` (payment_check), `criado_em`.
- **`loja_webhook_eventos`** (nova): payload bruto, recebido_em, processado_em e resultado. Serve para auditoria e idempotência, porque a InfinitePay **não assina** o webhook.
- Centavos **só no adaptador da InfinitePay** (a API trabalha em centavos). O banco continua em reais.

### 3.6 Status e histórico do pedido
- **Status de `cat_pedidos`** para o canal loja: `aguardando_pagamento` → `pago` → `separado` → `saiu_para_entrega` → `entregue` · `cancelado`.
  - O `CHECK` atual tem `pendente, confirmado, preparando, enviado, entregue, cancelado`. Há duas opções: **ampliar** o `CHECK` com os nomes novos, ou **mapear** (confirmado = pago, preparando = separado, enviado = saiu). Recomendo ampliar, porque os nomes do wireframe evitam tradução mental.
  - `vendas.status` **não muda** (`pendente/entregue/cancelada`). O Jarvis segue igual.
- **`cat_pedidos_status_historico`** (nova): `pedido_id`, `status`, `em` (timestamptz), `por` (sistema | admin | entregador + id), `observacao`. A tela 08 mostra o "quando" de cada passo a partir daqui.
- `sync_venda_to_cat_pedido` precisa ser ajustado para pedidos da loja: venda `entregue` → `entregue`, venda `cancelada` → `cancelado`, e **nunca rebaixar**.

### 3.7 Token público
- `cat_pedidos.token_publico`: texto aleatório de 128 bits (pgcrypto já instalado), único, gerado no banco. A URL usa o token. O `#numero_pedido` sequencial só aparece **dentro** da página (o wireframe mostra "Pedido #[NÚMERO]").
- A leitura pública passa pelo servidor da loja, ou por uma RPC `SECURITY DEFINER` que recebe o token e devolve **só** status, histórico, itens, data prevista e ordem na rota. Nunca telefone ou endereço completo.

### 3.8 Expiração
- Em `cat_pedidos`: `expira_em` (criado + 30 min), `lembrete_enviado_em`, `cancelado_em`, `cancelado_motivo` (expirado | cliente | admin).
- **Job:** `pg_cron` a cada minuto chama uma função que cancela os vencidos e grava o histórico.
  - O `pg_cron` já está em uso no projeto e não depende do plano da Vercel. No plano Hobby, o Vercel Cron só roda uma vez por dia; vale conferir o plano.
  - O **lembrete de 15 min** precisa da Evolution, então vai por **pull do n8n** (ação "lembretes devidos", como o W5).
- Nos links: `options.valid_until` (próximo do vencimento) e `single_payment: true`, para reduzir pagamento após o cancelamento (ver 4 e riscos).

### 3.9 Tabela de frete por bairro
- **`loja_frete_bairros`** (nova): `bairro`, `cidade`, `uf`, `nome_normalizado` (sem acento, minúsculo), `apelidos`, `valor`, `dias_rota` (dias da semana), `ativo`.
- Fluxo: o CEP passa pelo ViaCEP, que devolve bairro e cidade. O sistema compara pelo nome normalizado. Sem correspondência, aparece a mensagem de WhatsApp e o pedido **não fecha**.
- "Próxima rota: [DIA]" = próximo dia de `dias_rota` a partir de hoje em SP. Falta a regra de corte: pedido das 22h de segunda entra na rota de terça? (pergunta P7).
- O frete da loja **não usa** o cálculo por distância do catálogo.

### 3.10 Autorização de ofertas (LGPD)
- **`contato_consentimentos`** (nova, só inserção): `contato_id`, `telefone_wa`, `tipo` ('ofertas_whatsapp'), `concedido` (bool), `em` (timestamptz), `origem` ('loja'), `cat_pedido_id`, `texto_exibido` (o texto exato do checkbox). Uma revogação futura é uma nova linha com `concedido=false`.

### 3.11 Contador de cliques "pagar na entrega"
- **`loja_eventos`** (nova, genérica): `tipo` ('clique_pagar_na_entrega'), `cat_pedido_id`, `sessao` (id anônimo), `em`. A gravação passa por server action com limite simples. Contagem = `count(*)` por tipo e período. A mesma tabela serve a métricas futuras sem nova migration.

### 3.12 Outros campos necessários
- `cat_pedidos`: `canal` ('catalogo' | 'loja', com padrão 'catalogo'); endereço estruturado (`cep, logradouro, numero, complemento, bairro, cidade, uf`); `frete_bairro_id`; `data_entrega_prevista`; `campanha_id`; `aceitou_ofertas`.
- Origem do contato e da venda da loja: `'loja'` ou `'catalogo'` (pergunta P8). `'loja'` exige linha nova em `origens` e ampliar `contatos_origem_cadastro_check`.

---

## 4. InfinitePay — verificação

Fonte: documentação pública (lida em 29/10/2026). Os pontos marcados "não documentado" precisam de teste real com o item de R$ 1.

**O link aceita restringir a forma de pagamento?** **Só em parte.**
- `options.payment_methods_enabled` (exige API Key `inchk_…` no header `X-Api-Key`) aceita `credit_card` e `pix`. A doc diz: *"O cartão fica sempre ligado."* e *"Só o Pix pode ser ligado ou desligado."*
- **Link só no cartão: possível** (Pix desligado). **Link só no Pix: impossível**, porque o cartão sempre aparece.
- **Débito não aparece em lugar nenhum da documentação.** Não há garantia de que o checkout por link aceite débito.
- Não há parâmetro para limitar parcelas. O checkout mostra até 12x. `assured_installments` (0–12) define **até quantas parcelas a taxa é absorvida pelo vendedor**; acima disso, a InfinitePay repassa a taxa dela ao comprador. `0` = repassa em todas (a doc não diz se isso inclui o 1x).
- `options.discounts` existe, mas é **percentual** (`pix`, `credit_card`), então não reproduz uma tabela em reais centavo por centavo.
- Outros fatos que pesam:
  - preço em **centavos**, mínimo R$ 1;
  - **links não expiram** sem `valid_until` e **não podem ser cancelados**;
  - por padrão aceitam vários pagamentos (`single_payment` muda isso);
  - mesmo `order_nsu` com conteúdo diferente gera link novo;
  - **não existe consulta de link por `order_nsu`**;
  - o `payment_check` exige `order_nsu` + `transaction_nsu` + `slug`. Sem o `transaction_nsu`, que só chega por webhook ou redirect, **não dá para descobrir um pagamento por conta própria**;
  - o webhook **não tem assinatura**, re-tenta em caso de falha e quer `200` em menos de 1 s;
  - a doc diz para **não exigir** `paid_amount == amount`.

**O problema descrito no briefing se confirma.** Num link com preço do Pix, o cliente pode pagar no cartão sem a nossa taxa. Num link com preço do cartão, quem paga no Pix paga a mais.

### Opções (para o Luccas decidir)

**Opção A (recomendada): link criado depois da escolha na tela 06, um por método.**
- *Pix:* link no valor Pix com `assured_installments: 0`. Se o cliente trocar para cartão na página da InfinitePay, **a taxa da própria InfinitePay é repassada a ele**, então a Mont recebe aproximadamente o valor Pix. O valor não bate com a nossa tabela, mas a Mont não perde. O `payment_check` devolve `capture_method` e marcamos o pagamento como `divergente` para auditoria. *A confirmar no teste:* se o 1x também tem a taxa repassada com `0`.
- *Cartão:* link **só cartão** (Pix desligado) no valor exato da tabela para o método escolhido, com `assured_installments` igual às parcelas escolhidas (a Mont absorve a taxa da InfinitePay até ali, porque o preço já a inclui). Se o cliente escolher mais parcelas lá, paga a taxa da InfinitePay por cima, como em qualquer loja.
  - Ressalva: num link de "2x", o cliente pode escolher 1x e pagar o preço de 2x (paga um pouco a mais). Para evitar, a tela 06 poderia oferecer só "Cartão" e mandar o preço de 1x com `assured_installments: 1`. Isso diverge do wireframe, então só com autorização.
- *Débito:* **se o link não aceitar débito**, a opção "Cartão de débito" da tela 06 precisa sair. É divergência do wireframe e depende da sua decisão (P2).

**Opção B: um link só, no preço do cartão 1x, com `discounts.pix` em %.**
- O % é calculado por pedido (1 − pix/cartão).
- É mais simples, mas o arredondamento da InfinitePay pode não bater os centavos do Pix, e o débito e o 2x somem. **Viola a regra 3.**

**Opção C: abandonar a tabela própria do cartão.**
- Um link no preço Pix, com `assured_installments: 0`, e a InfinitePay calcula a taxa.
- A tela 06 mostraria só "Pix" e "Cartão (taxa calculada pela InfinitePay)". **Viola a regra 3 e o wireframe.**

➡️ **Parado aqui, aguardando a sua decisão.** Antes de decidir, vale um teste de 5 minutos no painel da InfinitePay com um link de R$ 1, para ver se aparece débito e o que `assured_installments: 0` faz no 1x.

---

## 5. Lista de migrations previstas (ordem sugerida, todas com backup antes)

| # | Migration | Tipo | Toca tabela usada pelo Jarvis/catálogo? |
|---|---|---|---|
| 1 | `loja_vitrine` (visível/disponível/seção/ordem/hero/leva junto) | schema | não |
| 2 | `combo_grupos` + `combo_grupo_opcoes` | schema | não (usa `produto_componentes` como está) |
| 3 | `loja_campanhas` + `loja_precos` (Pix, débito, 1x, 2x) | schema | não |
| 4 | `loja_frete_bairros` | schema | não |
| 5 | `cat_pedidos`: canal, token, endereço estruturado, frete_bairro, data prevista, expiração, campanha, ofertas + `CHECK` de status ampliado | schema | **sim** (colunas novas anuláveis; o catálogo não muda) |
| 6 | `cat_itens_pedido` e `itens_venda`: agrupamento de combo (instância, combo_id, grupo_id) | schema | **sim** (`itens_venda`, anuláveis) → regenerar `database.ts` |
| 7 | `cat_pedidos_status_historico` | schema | não |
| 8 | `loja_pagamentos` + `loja_webhook_eventos` | schema | não |
| 9 | `contato_consentimentos` + `loja_eventos` | schema | não |
| 10 | Origem `loja` (em `origens` + `contatos_origem_cadastro_check`), se P8 = sim | schema + dado | **sim** |
| 11 | Ajuste de `sync_venda_to_cat_pedido` (não rebaixar status no canal loja) | função | **sim** (o trigger é compartilhado) |
| 12 | RPCs: `loja_criar_pedido`, `loja_confirmar_pagamento`, `loja_cancelar_expirados`, `loja_pedido_publico`, `loja_lembretes_devidos`, `loja_marcar_status` (todas com `search_path=''`, `REVOKE` de anon/authenticated, execução só por service_role, exceto `loja_pedido_publico`) | função | não |
| 13 | `pg_cron`: job de expiração (1 min) | cron | não |
| 14 | **Dados:** criar Combo Família, Balde + doce e 3 doces; refazer Kit Top e Dupla Zero; inativar os 3 "Kit Top — X (Black)"; preencher vitrine, preços Black, tabela de cartão e bairros | dado | **sim** (`produtos`) |

Depois de cada DDL: `get_advisors` + `NOTIFY pgrst, 'reload schema'` + regenerar `packages/shared/src/database.ts` (protocolo da skill `supabase-mont`).

---

## 6. Riscos

1. **Evolution local.** Lembrete de 15 min, resumo e status dependem do PC do dev ligado com Docker no ar durante a Black inteira (03–30/11). O cancelamento aos 30 min fica no `pg_cron` e não depende disso, mas o lembrete atrasa ou some se a máquina cair. O README registra que o `connectionState` "mente".
2. **Pagamento sem descoberta ativa.** Sem `transaction_nsu` não há `payment_check`. Se o webhook falhar e o cliente não voltar pelo redirect, o pedido pago é **cancelado aos 30 min**. Mitigação: webhook com retry, log bruto e um estado `pago_apos_cancelamento` que alerta a equipe. Mesmo assim, pode exigir conciliação manual pelo painel da InfinitePay.
3. **Pagamento depois do cancelamento.** Links não podem ser cancelados. Se `valid_until` só aceitar data (não hora), um link ainda vale até o fim do dia. É preciso tratar: reabrir o pedido se houver estoque, senão alertar para estorno.
4. **Débito pode não existir** no checkout por link (não documentado), e a tela 06 o oferece.
5. **Tabela de cartão × taxas reais.** A tabela é da maquininha; o link tem taxas próprias. Se as taxas do link forem maiores, a Mont recebe menos que o esperado no cartão. Também há a contabilidade: `vendas.total` no cartão inclui a taxa, então o faturamento fica inflado pela taxa, que hoje não vira despesa (pergunta P10).
6. **`criar_pedido` aberta para `anon` e confiando em preço.** Com a chave pública, dá para criar pedido e venda com qualquer preço, e **sobrescrever endereço e nome de um cliente real** digitando o telefone dele. É pré-existente, do catálogo, e marcado como intencional na skill. **Não mexo sem autorização**, mas é o mesmo vazamento que a regra 9 quer evitar na loja.
7. **INSERT público em `cat_pedidos`, `cat_itens_pedido` e `contatos`.** Qualquer um insere linhas direto. A loja não usa esse caminho, mas um pedido "da loja" forjado poderia aparecer se a confirmação não verificar o canal e a origem. As RPCs da loja precisam validar tudo.
8. **`produtos` e `produto_componentes` com leitura pública total**, incluindo `custo`. A loja deve ler por uma view ou consulta sem custo. Mudar a policy é fora de escopo.
9. **Endereço do contato × endereço do pedido.** Se a loja não atualiza o contato e o W5/entregador leem o endereço do contato, a entrega pode ir para o endereço antigo (P6).
10. **`sync_venda_to_cat_pedido`** rebaixa o status ao registrar pagamento. Se não for ajustado, a tela 08 mostra o passo errado.
11. **Fuso UTC no banco.** Qualquer `current_date` ou `now()::date` erra a janela da Black e a data da venda depois das 21h.
12. **Âncoras dos combos inconsistentes no wireframe.** "A partir de R$ 269" (Família) e "R$ 90" (Balde + doce) só fecham com **geleia de goiaba (R$ 25)** no grupo; "R$ 87" (3 doces) só fecha **sem geleias** (3 × 29). A regra de âncora e os sabores de cada grupo precisam ser definidos juntos (P4).
13. **Volume de carrinhos abandonados.** Com tráfego pago, se a venda nascer no ato (alternativa da P1), o Jarvis enche de vendas canceladas e o #ENTREGAS pode receber pedido não pago.
14. **Concorrência no último pote.** Sem lock na criação, dois pedidos podem reservar o mesmo doce.
15. **`wa_envios`.** Mensagem da loja não registrada ali faz a secretária entender que um humano respondeu e calar naquela conversa.

---

## 7. Perguntas abertas

- **P1 — Quando nasce a venda no Jarvis?** (a) só com pagamento confirmado *(recomendado)* ou (b) no ato do pedido, ajustando W5, views e listas. Se (a): o aceite da Fase 2 passa a ser verificado com um pagamento de teste (ou uma confirmação manual)?
- **P2 — InfinitePay:** Opção A, B ou C (seção 4)? E, se o link não aceitar **débito**, autoriza tirar "Cartão de débito" da tela 06?
- **P3 — Cartão:** preço por item (soma da tabela) ou taxa sobre o total? O frete leva taxa? Preciso da **tabela completa** por produto e combo (débito, 1x, 2x).
- **P4 — Grupos dos combos:** quais sabores entram em cada grupo (geleias entram no Combo Família e no Balde + doce? no 3 doces?), doces 400 g entram em algum? E a regra da âncora "separado: a partir de" (soma dos avulsos no preço Black com o sabor mais barato do grupo?).
- **P5 — Disponibilidade:** confirma a regra da 3.4 (massa só chave manual; doces chave + estoque − reservado)? Onde o Gilmar liga e desliga "Esgotado" (tela no Jarvis = mudança fora de `apps/loja`)?
- **P6 — Endereço:** o endereço da entrega fica no pedido. Para cliente **existente**, como o W5 e o entregador recebem o endereço novo: na observação da venda, em colunas de endereço na venda, ou atualizando o contato só quando ele estiver vazio?
- **P7 — Rota:** tabela de bairros (valor + dias) e horário de corte para "próxima rota". "Escolher outro dia" (tela 05) é livre ou restrito aos dias de rota do bairro?
- **P8 — Origem:** contato e venda da loja com origem `'loja'` (nova, aparece separada nos relatórios) ou `'catalogo'`?
- **P9 — Kit Top:** R$ 100 ou R$ 89? O DL 400 g de brinde entra no rateio com R$ 0?
- **P10 — Contabilidade do cartão:** `vendas.total` no cartão = valor com taxa (faturamento inclui a taxa) ou valor Pix + taxa como despesa? Qual `conta_id` recebe Pix e cartão (hoje existe só "InfinityPay - Mont")?
- **P11 — Preço "Pote 400 g R$ 25 → 21":** vale para todos os 400 g tradicionais (DL tradicional, DL com coco, ambrosia)? Abóbora com coco 400 g está fora do catálogo hoje.
- **P12 — Doces fora do wireframe:** Cocada com Maracujá 680 g e DL com Geleia de Café 680 g existem no banco e não aparecem no wireframe. Entram na loja?
- **P13 — "Leva junto?":** é sempre o DL 400 g, ou uma regra (item mais barato que não está na sacola)?
- **P14 — Separado / Saiu para entrega (Fase 5):** minha sugestão é "Separado" no Jarvis (em lote, pedidos do dia) e "Saiu para entrega" no `apps/entregador` (botão "Iniciar rota", que marca todos da rota do dia). Ok?
- **P15 — Meta:** o `Purchase` da loja sai na **entrega** (como o catálogo, automático) ou no **pagamento aprovado**? Hoje sairia na entrega sem nenhuma mudança.
- Já pendentes no briefing: domínio da loja; congelados durante a Black.
