# Paridade: catálogo antigo → loja nova (`apps/loja`)

> 02/11/2026. Diagnóstico **só de leitura** (código dos dois apps + banco de produção).
> **APROVADO em 02/11**, com as decisões D1–D6 registradas em `decisoes-fase0.md` (seção "Decisões da paridade").
> Contexto: a loja nova é o catálogo/loja definitivo da Mont e substitui o `apps/catalogo`. O sistema interno é a única fonte.
> Legenda: ✅ faz · 🟡 faz em parte · ❌ não faz · ➕ a loja faz e o antigo não.

## 1. Diagnóstico de paridade

### 1.1 Produtos e vitrine (o que vem do cadastro)

| O catálogo antigo faz | Loja nova | Como está hoje na loja |
|---|---|---|
| Mostra todo produto com `visivel_catalogo = true` (view `vw_catalogo_produtos`). Produto novo visível aparece sozinho. | ❌ | Só mostra produto que tem linha em `loja_vitrine` (feita por SQL). Produto novo **não aparece**, e o pedido dele é **recusado** (`loja_criar_pedido` exige a linha da vitrine). |
| Usa `ativo` + `visivel_catalogo` (o interruptor "Visível no catálogo" da tela de Produtos). | 🟡 | Usa `produtos.ativo` + `loja_vitrine.visivel`. Ignora `visivel_catalogo`. |
| Abas = seções da tela **Catálogo** do sistema interno (`cat_secoes`: Congelados, Resfriados, Doces; Combos inativa), na ordem de lá. | ❌ | Seções fixas no código (`combos`, `massa`, `doces`, `zero`) e gravadas em `loja_vitrine.secao`. |
| Ordem dos produtos = arrastar na tela Catálogo (`ordem_vitrine`). | ❌ | `loja_vitrine.ordem` (SQL). |
| Todas as linhas: hoje 9 congelados + 1 "Pão de Queijo 2kg - 100gr" sem categoria + 2 combos fixos ("Balde 4kg + Palito 1kg", "Balde 4kg + Pão de Queijo 1kg"). | ❌ | Mostra 2 massas refrigeradas, doces, zero e os combos da Black. **Os 9 visíveis acima ficam de fora** (consulta: `visiveis_sem_vitrine = 9`). |
| Combos permanentes, com preço de `produtos.preco` e itens de `produto_componentes`. | ❌ | Combo só aparece **dentro de campanha** com preço em `loja_precos`. Os 2 combos permanentes não aparecem. |
| Fotos: capa e galeria de `cat_imagens_produto`, que o upload do sistema interno grava junto com `sis_imagens_produto` (36 = 36). | ✅ | Usa a mesma capa. Não mostra galeria (só capa). |
| Preço = `produtos.preco`; preço "de" = `preco_ancoragem`. | 🟡 | Preço = `produtos.preco` fora de campanha (ok). Preço "de" só vem da campanha; `preco_ancoragem` é ignorado. |
| Nome, subtítulo e descrição do cadastro. | ✅ | Usa nome (ou `nome_loja`), subtítulo e descrição. |
| Selo (`selo`), benefícios (`beneficios`) e modo de preparo (`instrucoes_preparo`). | ❌ | Não mostra. |
| Destaques (`destaque`) num carrossel no topo. | 🟡 | Tem `destaque_hero` em `loja_vitrine` (1 combo, SQL); ignora `destaque` do cadastro. |
| "Recomendados" na página do produto: comprados juntos de verdade (`produtos_comprados_juntos`) + mesma categoria. | 🟡 | Um "leva junto?" fixo (doce de leite 400 g, `loja_vitrine.leva_junto`). |
| Página própria por produto (`/produtos/[slug]`), com link compartilhável. | ❌ | O produto abre num painel por cima da home; não tem endereço próprio. Só combo tem rota (`/combo/[slug]`). |

### 1.2 Esgotado / disponibilidade

| O catálogo antigo faz | Loja nova | Observação |
|---|---|---|
| **Nada.** Não mostra esgotado; vende tudo o que está visível (a view calcula `status_estoque`, mas a tela não usa). | ➕ | A loja tem chave manual "Esgotado" (`loja_vitrine.disponivel`) e, opcionalmente, estoque (`usa_estoque`; hoje desligado nos doces). **Mas a chave só muda por SQL**: não existe no sistema interno. |

### 1.3 Frete e área de entrega

| O catálogo antigo faz | Loja nova | Observação |
|---|---|---|
| Calcula o frete pelo CEP, por **distância de rota** (`configuracoes.frete_config`: até 20 km R$ 5, até 30 km R$ 10, até 50 km R$ 15, origem Montanhão/SBC). O valor é recalculado no servidor. Fora do alcance ou sem rota: "a combinar" no WhatsApp, sem bloquear o pedido. | ❌ | Não calcula. A sacola diz "combinamos no WhatsApp" e o frete entra quando o Gilmar confirma em "Pedidos da loja". `loja_frete_bairros` existe e está vazia (P7: taxa por cidade, tabela pendente). |
| Opção **retirada** (frete zero). | ❌ | Só entrega. |
| Aceita qualquer CEP (não bloqueia fora da área). | ✅ | Igual: aceita qualquer CEP; o CEP preenche a rua e a cidade. |

### 1.4 Pedido → sistema interno

| O catálogo antigo faz | Loja nova | Observação |
|---|---|---|
| `criar_pedido` (service role) grava `cat_pedidos` + itens **e cria a venda na hora** (`origem = 'catalogo'`, status `pendente`), que aparece em Vendas com o selo do catálogo. Falha de vínculo vai para "Catálogo pendentes". | ➕ | `loja_criar_pedido` grava o pedido (`canal = 'loja'`, sabores dos combos, endereço do pedido, aceite de ofertas, idempotente). Ele aparece em **"Pedidos da loja"**; a venda nasce quando o Gilmar **confirma** (frete, dia, forma de pagamento). Preço sempre calculado no banco. |
| Pergunta a forma de pagamento (Pix ou dinheiro). | 🟡 | Não pergunta; o Gilmar escolhe na confirmação. |
| Campos "Indicado por" e "Observações". | ❌ | Não tem. |
| Aviso no grupo **#ENTREGAS** (W5): sai para venda com data de entrega prevista. | ✅ | A venda confirmada já sai com a data de entrega; o W5 avisa normalmente. |
| Aviso de pedido novo para a Mont: a própria mensagem no WhatsApp. | ✅ | Igual. "Pedidos da loja" está no menu, sem contador de pendentes. |
| Selo "Catálogo" nas vendas (`VendaCard`). | ❌ | Venda da loja não tem selo próprio. |
| Relatórios: venda de `origem = 'catalogo'` é tratada à parte (A receber, marketing). | 🟡 | **Achado:** `rpt_marketing_pedidos_periodo` conta o pedido da loja pago **duas vezes**: como "online" (`cat_pedidos` pago) e como "direta" (a venda com `origem = 'loja'` não é excluída). O antigo não tem esse problema. |

### 1.5 WhatsApp e contato/CRM

| O catálogo antigo faz | Loja nova | Observação |
|---|---|---|
| Abre o wa.me com a mensagem: cliente, telefone, entrega ou retirada, itens, subtotal, frete (ou "a combinar"), total, pagamento, indicado por, observação. | 🟡 | Mensagem com nº do pedido, itens com sabores, total e endereço (aprovada em 02/11). Sem frete, pagamento, retirada, indicado por e observação (porque a loja não pergunta). Tela 07 repete o link. |
| Botões "Fale no WhatsApp" no topo, rodapé e CTA final. | 🟡 | Link no fim da home, no erro e no checkout. |
| Vincula ou cria o contato pelo telefone (`origem = 'catalogo'`) e **sobrescreve** endereço do contato existente. | ➕ | Vincula ou cria pelo telefone (`origem = 'loja'`), guarda o aceite de ofertas e **não** sobrescreve o cadastro (endereço fica no pedido). |

### 1.6 Meta, anúncios e UTMs

| O catálogo antigo faz | Loja nova | Observação |
|---|---|---|
| **GTM** `GTM-W6CXZC3R` em todas as páginas (pixel da Meta e as outras tags vivem lá). | ❌ | Nenhum script de medição. |
| `dataLayer`: `view_item_list`, `view_item`, `add_to_cart`, `remove_from_cart`, `begin_checkout`, `pedido_enviado`, `whatsapp_click`, `whatsapp_support_click`. | ❌ | Nenhum. |
| **CAPI** pelo servidor (`/api/meta-capi`, `action_source: website`, telefone e nome com hash, `fbp`/`fbc` dos cookies): `InitiateCheckout` ao enviar o pedido (`event_id` = `checkout_<pedido>`) e `Lead` no clique do WhatsApp. | ❌ | Nenhum. |
| `Purchase` sai do banco na **entrega** (gatilho em `vendas` → `meta_eventos` → worker), para qualquer origem. | ✅ | Vale igual para a venda da loja confirmada e entregue. |
| Meta tag `facebook-domain-verification` (verificação do domínio na Meta). | ❌ | Não tem. Precisa ir junto na troca de domínio. |
| UTMs / `fbclid`: não grava (só o `_fbc` do cookie vai no CAPI). | ❌ | Igual: não grava. |

### 1.7 Administração

| O catálogo antigo faz | Loja nova | Observação |
|---|---|---|
| `/admin`: painel (`vw_admin_dashboard`), pedidos (mudar status, excluir pedido com a venda) e produtos (só leitura; edição já foi para o sistema interno). | ✅ | Tudo isso já existe no sistema interno (Vendas, Pedidos da loja, Produtos, Catálogo). Nada a portar. |
| — | ❌ | **Sem SQL hoje é impossível:** esgotado, nome/frase/destaque/"leva junto?" da loja, sabores dos combos (`combo_grupos`), campanha (ativar, pausar, datas) e preços da campanha (`loja_precos`). As policies de escrita para admin **já existem** nessas tabelas; falta tela. |

### 1.8 SEO, compartilhamento e domínio

| O catálogo antigo faz | Loja nova | Observação |
|---|---|---|
| Título e descrição por página; por produto, título com o nome e descrição do cadastro. | 🟡 | Um título geral ("Loja Mont") e uma descrição. |
| Open Graph com título e descrição (**sem imagem**). | ❌ | Sem Open Graph: a prévia no WhatsApp sai pobre nos dois. |
| `sitemap.xml` / `robots.txt`. | ❌ / ❌ | Nenhum dos dois tem. |
| Domínio `www.montdistribuidora.com.br` (o sem `www` redireciona para ele), no projeto Vercel `mont-catalogo`. | ❌ | `loja.montdistribuidora.com.br` no projeto `mont-loja`. |

### 1.9 Outras coisas do catálogo antigo

- **Home institucional**: hero animado do pão de queijo (GSAP), "Como funciona", história da marca, ingredientes, benefícios, faixa de confiança, página **/sobre**. A loja não tem nada disso (é uma loja de página única).
- **Preloader** de 2,5 s com a logo na home.
- **Carrinho** em `/carrinho`; na loja é `/sacola`.
- Ajuda do CEP: link "Estou com dificuldade no endereço" para o WhatsApp (a loja tem preenchimento manual quando o CEP falha).
- **Tema da Copa** ainda ligado no `<html>` do catálogo (`tema-copa`).
- ➕ A loja tem e o antigo não: combos com escolha de sabor, campanha com período e preço Pix/cartão, pedido idempotente, aceite de ofertas, página de privacidade, Lighthouse 96–97.

## 2. Proposta: o que falta para a loja fazer tudo isso

### Parte A — Vitrine pelo cadastro (o centro de tudo)
- A loja passa a ler **`produtos`** (`ativo` + `visivel_catalogo`) como fonte. Produto novo marcado como visível aparece sozinho.
- **Abas = seções da tela Catálogo** do sistema interno (`cat_secoes`, na ordem de lá); **ordem** = `ordem_vitrine`. "Zero açúcar" vira uma seção criada pelo Gilmar na tela Catálogo (sem SQL). Produto visível sem seção cai numa aba final ("Mais produtos"), para nada sumir calado.
- Foto, preço, preço "de" (`preco_ancoragem`), descrição, selo, benefícios e modo de preparo vêm do cadastro.
- **Combos permanentes** aparecem com `produtos.preco`. Combo de campanha continua só dentro da campanha.
- `loja_vitrine` vira **complemento opcional**: sem linha, vale o cadastro. Com linha, ela pode trocar seção e ordem e dar nome na loja, frase do card, resumo do combo, destaque no topo, "leva junto?" e esgotado.
- Banco: `loja_criar_pedido` passa a aceitar produto **sem** linha da vitrine (fonte = `ativo` + `visivel_catalogo`; esgotado só se houver linha marcada). Migração + suíte SQL de transação descartada.

### Parte B — Aba "Loja" na tela de produto do sistema interno (celular e desktop)
- Campos: nome na loja, frase do card, resumo (combos), seção e ordem só para a loja (opcional), destaque no topo, "leva junto?", **Esgotado agora** e "controlar pelo estoque".
- Grava em `loja_vitrine` pela policy de admin que já existe.

### Parte C — Combos e campanha sem SQL
- **Sabores do combo** na edição do combo: grupos (título, quantos escolher, pode repetir) e opções. Hoje só por SQL.
- Tela **Campanhas**: criar, ativar/pausar, início e fim, e preço por produto (Pix, crédito 1x, âncora "separado"). Hoje só por SQL.

### Parte D — Página de produto e SEO
- Página própria **`/produto/[slug]`** (o painel continua na home; o link compartilhado abre a página). Galeria de fotos, selo, benefícios, modo de preparo, "comprados juntos" com a mesma RPC do antigo.
- Título e descrição por página, **Open Graph com imagem** (foto do produto; na home, uma imagem da marca), `sitemap.xml`, `robots.txt` e a meta tag de verificação da Meta.

### Parte E — Meta e medição
- GTM `GTM-W6CXZC3R` na loja e os mesmos eventos de `dataLayer` do antigo, com os mesmos nomes (as tags do GTM continuam valendo).
- Rota CAPI no servidor da loja (mesma normalização de `@mont/shared`): `InitiateCheckout` ao gravar o pedido (`event_id` = `checkout_<pedido>`) e `Lead` nos botões de WhatsApp.
- **Proposta extra (não é paridade):** gravar no pedido `fbp`, `fbc` e UTMs, para o `Purchase` da entrega sair atribuído ao anúncio do site. Exige mexer no worker (hoje só conhece `business_messaging` e `physical_store`). Fica opcional.

### Parte F — Checkout com o que o antigo tinha
- **Retirada** (frete zero) além de entrega.
- **Frete** (decisão D1, abaixo).
- "Indicado por" e "Observações" opcionais, na mensagem e no pedido.
- Forma de pagamento preferida (Pix ou dinheiro), só como informação; quem decide continua sendo a confirmação no sistema interno.

### Parte G — Sistema interno e relatórios
- Corrigir a **contagem dupla** do pedido da loja em `rpt_marketing_pedidos_periodo` (migração + suíte).
- Selo "Loja" nas vendas, como o do catálogo.
- Contador de pedidos aguardando confirmação no item "Pedidos da loja" do menu.

## 3. Plano de troca

**Etapa 1 — paridade no subdomínio.** Partes A–G vão ao ar em `loja.montdistribuidora.com.br`, cada uma com OK e merge. O catálogo antigo segue no ar, intocado.

**Etapa 2 — conferência antes de trocar** (lista de verificação, tudo com evidência):
1. Todo produto visível no catálogo antigo aparece na loja com o mesmo preço, foto e seção (comparação por consulta, produto a produto).
2. O Gilmar cadastra um produto de teste no sistema interno → aparece na loja; marca esgotado → some do pedido; esconde → some. Sem SQL.
3. Pedido real de ponta a ponta: entrega e retirada → "Pedidos da loja" → venda → aviso no #ENTREGAS → entrega → `Purchase` em `meta_eventos`.
4. Meta: GTM e pixel recebendo `PageView`/`InitiateCheckout` no Gerenciador de Eventos; CAPI com `event_id` deduplicado.
5. Prévia do link no WhatsApp (home e um produto) com foto.
6. Links de fora conferidos: bio do Instagram, Google Meu Negócio, catálogo da Meta, anúncios ativos com URL do site e o QR code impresso (`qrcode-mont.png`). Cada um apontando para um endereço que continua funcionando depois dos redirecionamentos.
7. Variáveis do Meta (`META_PIXEL_ID`, `META_CAPI_TOKEN`) e do frete copiadas para o `mont-loja` sem exibir valores.

**Etapa 3 — a troca** (uma manhã de dia útil, sem anúncio apontando para o site naquele dia):
- Na Vercel, mover `www.montdistribuidora.com.br` e `montdistribuidora.com.br` (que redireciona para o `www`) do projeto `mont-catalogo` para o `mont-loja`. O DNS não muda (os dois projetos estão na Vercel), então não há janela fora do ar.
- `loja.montdistribuidora.com.br` passa a redirecionar para `www.montdistribuidora.com.br` (links da Black continuam funcionando).
- Redirecionamentos permanentes na loja:

| Endereço antigo | Vai para |
|---|---|
| `/produtos` | `/` |
| `/produtos/[slug]` | `/produto/[slug]` (mesmo slug do cadastro) |
| `/carrinho` | `/sacola` |
| `/sobre` | `/` (ou uma seção "Quem somos", decisão D2) |
| `/admin` e `/admin/*` | `https://sistema.montdistribuidora.com.br` |
| qualquer outro | página 404 da loja, com "Ver a loja" |

- O carrinho antigo do cliente (guardado no navegador) não migra; quem tinha carrinho aberto começa de novo. Nenhum pedido é afetado.

**Etapa 4 — desligar o antigo** (depois de 2 semanas sem problema):
- Durante as 2 semanas o `mont-catalogo` segue publicado só no endereço da Vercel. **Voltar atrás = mover os domínios de volta (minutos).**
- Depois: apagar o projeto `mont-catalogo` na Vercel, arquivar o `apps/catalogo` (decisão D5) e atualizar `CLAUDE.md`/`AGENTS.md`.
- No banco, nada é apagado: `criar_pedido`, `cat_pedidos` antigos e a tela "Catálogo pendentes" continuam para o histórico. `criar_pedido` pode ter o EXECUTE revogado depois (tarefa separada, com OK).

## 4. Estimativa por parte

Em dias de trabalho meu (implementação + testes + merge), sem contar a sua conferência:

| Parte | Estimativa |
|---|---|
| A — Vitrine pelo cadastro (inclui migração do `loja_criar_pedido` e suíte) | 1 a 1,5 dia |
| B — Aba "Loja" no sistema interno | 0,5 dia |
| C — Sabores do combo + tela Campanhas | 1,5 a 2 dias |
| D — Página de produto + SEO + prévia no WhatsApp | 1 dia |
| E — GTM, eventos e CAPI (paridade) | 0,5 a 1 dia (+0,5 dia se a atribuição extra entrar) |
| F — Checkout: retirada, indicado por, observação, pagamento | 0,5 dia; **frete**: +0,5 dia (distância) ou +0,5 dia (tabela, depois que o Gilmar mandar os valores) |
| G — Relatório sem contagem dupla, selo, contador | 0,5 dia |
| Troca de domínio + redirecionamentos + conferência | 0,5 dia, mais as 2 semanas de convivência |
| **Total** | **cerca de 6,5 a 8,5 dias** |

Ordem sugerida: A → B → G → F → E → D → C → troca. A e B tiram a dependência de SQL no dia a dia. C pode ir antes se a Black for reativada logo.

## 5. Decisões (respondidas em 02/11 — ver `decisoes-fase0.md`)

- **D1 — Frete:** (a) distância de rota, como o catálogo antigo (já configurado; mostra o valor na sacola, "a combinar" fora do alcance); ou (b) tabela por cidade (P7), que depende dos valores do Gilmar. Recomendo (a) agora, porque é paridade pronta, e (b) se o Gilmar quiser trocar depois.
- **D2 — Conteúdo institucional:** o hero animado do pão de queijo e o "/sobre" vêm para a loja ou se aposentam com o catálogo? A memória diz que o hero é intocável, mas isso foi pensado com o catálogo vivo. Recomendo uma seção curta "Quem somos" na loja e aposentar o hero.
- **D3 — Seções:** abas da loja = seções da tela Catálogo do sistema interno (o Gilmar cria "Zero açúcar" lá). Ok?
- **D4 — Combos permanentes:** "Balde 4kg + Palito 1kg" e "Balde 4kg + Pão de Queijo 1kg" entram na loja com o preço do cadastro?
- **D5 — Destino do `apps/catalogo`:** arquivar em `_parked/` (código intacto) ou apagar do monorepo?
- **D6 — Pasta de docs:** renomear `docs/loja-black/` para `docs/loja/`?
