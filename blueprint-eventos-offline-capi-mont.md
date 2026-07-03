# Blueprint — Eventos Offline (CAPI) do sistema Mont → Meta
**Diagnóstico + spec de implementação · 01/07/2026 · para execução no Claude Code**

Contexto: ~98,6% do faturamento da Mont (1.336 vendas / R$69k) não passa pelo catálogo, logo é **invisível ao Pixel de navegador**. Este documento especifica como mandar esses eventos do servidor (Conversions API), amarrando anúncio → conversa no WhatsApp → venda offline.

Projeto Supabase: `herlvujykltxnwqmwmyx` · Pixel/Dataset: `1689731802148035` · Moeda: BRL.

---

## 1. Diagnóstico do schema atual (levantado via MCP, read-only)

**`contatos` (726 linhas) — chaves de match:**
- `telefone` text NOT NULL — **100% preenchido**. Âncora do match (Brasil/WhatsApp).
- `nome` NOT NULL; `cidade`/`uf` (66% preenchidos); `cep`; `latitude`/`longitude`.
- `id` uuid — serve de `external_id`.
- `origem` text NOT NULL, `fonte` text, `campanha_id` uuid — **andaime de atribuição já existe** (taxonomia em `origens`/`fontes`), mas só 1 contato tem `fonte=meta_ads` e 1 tem `campanha_id`. **Não é carimbado na entrada.**
- **SEM** `email` (ok, telefone cobre). **SEM** campo para `ctwa_clid` (furo).

**`vendas` (1.355 linhas) — fonte do Purchase:**
- `contato_id` uuid NOT NULL → liga à identidade para match.
- `total` numeric NOT NULL (valor); `taxa_entrega`; `data`; `criado_em`.
- `status`: entregue **1350**, pendente 3, cancelada 2.
- `forma_pagamento`: fiado **682**, pix 526, pre_venda 92, dinheiro 35, **brinde 11**, venda 7, cartao 2.
- `pago` boolean; `valor_pago`; `cat_pedido_id` (só 19 vêm do catálogo).
- **SEM** controle de envio/idempotência para Meta (furo).

**Taxonomia (lookups):** `origens` = anuncio, ifood, facebook, instagram, catalogo, indicacao, direto · `fontes` = meta_ads, google_ads, tiktok_ads.

---

## 2. Regras de negócio (invioláveis)

- **Purchase só para venda real:** `status = 'entregue' AND forma_pagamento <> 'brinde'`.
- **Brinde nunca vira conversão** (é despesa; mandar ensinaria a Meta a otimizar para caçador de brinde).
- **[DECISÃO DO LUCCAS — confirmar] fiado:** recomendação = disparar Purchase na entrega (`status='entregue'`), independente de `pago`. Alternativa = só quando `pago=true`. Default deste blueprint: **na entrega**.
- **Valor do evento:** usar `total`. (Opcional: `total - coalesce(taxa_entrega,0)` se quiser valor só de produto — diferença trivial de ~R$5; manter `total` por padrão.)
- **Voz/identidade não se aplica aqui** (evento técnico, sem copy).

---

## 3. Schema — adições (via MIGRAÇÃO VERSIONADA, nunca MCP direto)

### 3.1 Captura do clique de anúncio em `contatos`
```sql
ALTER TABLE public.contatos
  ADD COLUMN ctwa_clid       text,        -- click id do Click-to-WhatsApp (referral)
  ADD COLUMN ad_referral     jsonb,       -- objeto referral cru (source_id/ad id, source_url, headline)
  ADD COLUMN ctwa_clid_em    timestamptz; -- quando o clique foi capturado
```
> `ctwa_clid` é enviado **cru** (não hasheado) para a Meta. Guardar o `ad_referral` cru dá rastro de auditoria e o ad id.

### 3.2 Outbox de eventos — `meta_eventos`
```sql
CREATE TABLE public.meta_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento        text NOT NULL CHECK (evento IN ('Lead','Purchase')),
  event_id      text NOT NULL UNIQUE,      -- dedup: 'venda_<uuid>' | 'lead_<uuid>'
  contato_id    uuid NOT NULL REFERENCES public.contatos(id),
  venda_id      uuid REFERENCES public.vendas(id),
  event_time    timestamptz NOT NULL,
  valor         numeric,
  moeda         text NOT NULL DEFAULT 'BRL',
  ctwa_clid     text,                       -- snapshot no momento do enfileiramento
  action_source text NOT NULL,              -- 'business_messaging' se veio de anúncio; senão 'physical_store'
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','erro')),
  tentativas    int  NOT NULL DEFAULT 0,
  resposta_meta jsonb,                       -- fbtrace_id, events_received, erros
  criado_em     timestamptz NOT NULL DEFAULT now(),
  enviado_em    timestamptz
);
CREATE INDEX idx_meta_eventos_pendentes ON public.meta_eventos (status) WHERE status = 'pendente';
```
> A UNIQUE em `event_id` é a idempotência forçada no banco — impossível duplicar. RLS: habilitar, acesso só service_role (o worker).

### 3.3 Enfileiramento (trigger que só INSERE na outbox, não envia)
- **Purchase:** trigger `AFTER INSERT OR UPDATE` em `vendas` → quando `status='entregue' AND forma_pagamento<>'brinde'` e ainda não existe `event_id='venda_<id>'`, insere linha `pendente`. `action_source` = `business_messaging` se o contato tem `ctwa_clid`, senão `physical_store`.
- **Lead:** trigger `AFTER INSERT` em `contatos` → quando `origem='anuncio' OR fonte='meta_ads' OR ctwa_clid IS NOT NULL`, insere `Lead` pendente.
> Alternativa a triggers: enfileirar na camada de aplicação (único ponto de escrita). Escolher uma; TDD nos dois casos. Migração versionada para a função/trigger.

---

## 4. Worker de envio (Edge Function ou backend whatsapp-k) — batch diário

Loop sobre `meta_eventos WHERE status='pendente'`:

1. **Monta `user_data`** a partir do contato (normalizar → SHA-256 hex minúsculo, exceto onde indicado):
   - `ph`: só dígitos, com DDI 55 (ex.: `5511999998888`) → hash.
   - `fn` / `ln`: nome partido, minúsculo, sem acento/pontuação → hash.
   - `ct`: cidade minúscula sem espaços → hash · `st`: uf minúscula (2 letras) → hash · `zip`: cep só dígitos → hash.
   - `external_id`: `contato.id` (pode ir hasheado; manter consistente se o Pixel também mandar).
   - `ctwa_clid`: **cru** (sem hash), quando existir.
2. **Monta `custom_data`** (só Purchase): `{ value: <total>, currency: "BRL", content_type:"product" }`. Opcional `content_ids` via `itens_venda`.
3. **Monta o evento:** `event_name` (Lead/Purchase), `event_time` (epoch), `event_id` (dedup), `action_source`.
4. **POST** `https://graph.facebook.com/v21.0/1689731802148035/events` com `access_token` (segredo server-side).
5. **Resultado:** sucesso → `status='enviado'`, `enviado_em=now()`, guarda `fbtrace_id`. Erro → `status='erro'`, `tentativas++`, reprocessa com backoff.
6. **Dedup com Pixel:** para os 19 pedidos de catálogo, se o Pixel de navegador disparar Purchase, usar o **mesmo `event_id`** (`venda_<id>`) nos dois → Meta deduplica.

> **Por que batch diário basta:** a Meta aceita eventos offline com atraso (janela de dias). Tempo real não é requisito — um cron 1x/dia flushando a outbox é suficiente e menos frágil. Migrar para tempo real depois, se necessário.

---

## 5. Carimbo na entrada (whatsapp-k / Evolution) — pré-requisito de atribuição

Na primeira mensagem inbound de um lead vindo de anúncio Click-to-WhatsApp:
- Ler o objeto **referral** da mensagem → extrair `ctwa_clid`, `source_id` (id do anúncio), `source_url`, `headline`.
- Carimbar/atualizar o contato: `origem='anuncio'`, `fonte='meta_ads'`, `ctwa_clid`, `ad_referral`, `ctwa_clid_em=now()`, e mapear/`campanha_id`.

### ⚠️ RISCO #1 — verificar ANTES de tudo
Confirmar se a **Evolution API expõe o `referral`/`ctwa_clid`** no webhook da mensagem. Testar com um clique real num anúncio CTWA de teste.
- **Se expõe:** atribuição nível-clique (padrão-ouro).
- **Se não expõe:** cair para match por telefone/hash (funciona, atribuição mais fraca) e avaliar migração para a **Cloud API oficial** (expõe referral de forma confiável) quando escalar.

---

## 6. Segredos e segurança
- `META_CAPI_ACCESS_TOKEN` e o dataset id **só server-side** (secret da Edge Function / env do worker). Nunca no cliente, nunca no banco em texto.
- `meta_eventos` com RLS: leitura/escrita só `service_role`.

---

## 7. Plano de teste (TDD + validação real)
1. Testes de normalização/hash de cada chave (vetores conhecidos).
2. Testes do gatilho de enfileiramento: entregue↔pendente↔cancelada, brinde excluído, fiado conforme a decisão, idempotência (mesma venda não duplica `event_id`).
3. Envio em **modo teste** (`test_event_code`) → conferir no **Events Manager → Test Events** que Lead/Purchase chegam com match quality e valor certos.
4. Só então remover o test code e ligar o cron.
5. **Validação de navegador/painel > build verde:** confirmar no Events Manager, não só no log.

---

## 8. Ordem de execução sugerida (Claude Code)
1. **Verificar o referral na Evolution** (risco #1) — decide o teto de atribuição.
2. Migração: colunas em `contatos` + tabela `meta_eventos` + índice + RLS.
3. Migração: função/trigger de enfileiramento (ou hook de aplicação) + testes.
4. Worker de envio + testes + modo teste no Events Manager.
5. Carimbo na entrada (whatsapp-k) + testes.
6. Ligar cron diário. Observar match quality e volume por alguns dias.

> Depois disto rodando e acumulando Purchase por ~2–3 semanas, aí sim faz sentido testar a campanha de objetivo "vendas" — porque ela terá evento real para otimizar.

---

## 9. Adendos — decisões e escopo (01/07/2026)

### 9.1 Decisão confirmada: fiado
Purchase dispara na **ENTREGA** (`status='entregue' AND forma_pagamento<>'brinde'`), independente de `pago`. Vale para fiado. (Escolha do Luccas: mais volume de sinal para a Meta aprender, o que importa na verba enxuta; fiado entregue a cliente recorrente é venda real e repetível.)

### 9.2 Atribuição no perfil do contato (não por compra) — está OK
O sistema registra `origem`/`fonte`/`campanha_id` no CONTATO (perfil), não por venda. Para CAPI é o grão certo: chaves de match (telefone, nome, cidade/UF) são por pessoa, e `ctwa_clid` é por entrada. A venda herda a atribuição via `vendas.contato_id → contatos`.
- Ressalva: é atribuição de perfil (primeiro/último toque). Se um contato entrou orgânico e depois comprou por anúncio, o perfil não troca sozinho — irrelevante na escala da Mont, e a Meta só credita conversão dentro da janela de atribuição do clique de qualquer forma.
- Melhoria opcional: atualizar `ctwa_clid` a cada nova entrada por anúncio (clique mais recente), guardando rastro em `ad_referral`/`interacoes`.

### 9.3 Gateway do WhatsApp: decisão de arquitetura
**Recomendado: migrar o whatsapp-k para Cloud API via WhatsApp Coexistence** (BSP com suporte a coex, ou embedded signup da Meta). Disponível no Brasil desde mai/2025.
- Mesmo número no **app** (conversa no celular, histórico preservado) **e** na **Cloud API** simultaneamente, via espelhamento de mensagens.
- Habilita **CTWA oficial → `ctwa_clid` confiável no webhook** = o elo de atribuição nível-clique que este blueprint exige.
- **Evolution API** (atual, não-oficial): risco de ban e NÃO garante `ctwa_clid`. Se permanecer, tratar match por telefone/hash como primário e `ctwa_clid` como best-effort.
- Custos/limites: mensagem via app = grátis; conversa via API = cobrada por conversa (barato no volume Mont). Desativa alguns recursos 1:1 (temporária, ver-uma-vez, localização ao vivo); sem selo azul (OBA); requer app v2.24.17+, conta Meta Business verificada, BSP com coex, 1 número por coex.
- **Impacto no plano:** a qualidade da atribuição (nível-clique vs só telefone) depende desta decisão. Decidir ANTES de investir na campanha de vendas.

### 9.4 Segmentação de clientes ("tags" Todos/Clientes/Leads/VIPs/Inativos) — ligar lógica real + alinhar à Meta
Estado atual (print CRM): Clientes 702, Leads 23 (=725≈726), **VIPs 0, Inativos 0** → VIP/Inativo sem lógica computada (hardcoded/desligados).
**Derivar de dados reais de `vendas`** (filtro canônico `entregue` & `<>brinde`), nunca hardcode. Definições propostas (thresholds a confirmar):
- **Lead:** contato com 0 vendas reais.
- **Cliente:** ≥1 venda real.
- **VIP:** topo por valor/frequência — sugestão: ≥N compras em 90d, OU total acumulado ≥ R$X, OU top decil. **[decidir N / X]**
- **Inativo:** sem compra há > D dias — sugestão alinhar ao corte de reativação do CRM (linha de 40d Recompra vs Reativação; Inativo pode ser >40d ou 60–90d). **[decidir D]**
Implementação: VIEW/materialized view ou job agendado recalcula o segmento; a UI lê disso, não de valores fixos.
**Ligação com a Meta (ganho estratégico):** cada segmento vira semente de **Custom Audience** (upload via API com telefone/hash):
- Compradores/VIP → **Lookalike** para prospecção (topo de funil qualificado — resolve o "público certo" ausente na 1ª campanha).
- Inativos → público de **reativação** (recompra, alinhado ao calendário editorial).

### 9.5 Checklist de auditoria de código (Claude Code no monorepo — ANTES de implementar)
1. **Entrada de contato:** onde contatos são criados (whatsapp-k? sistema? catálogo?) e se `origem`/`fonte`/`campanha_id` são carimbados. Há captura de `referral`/`ctwa_clid`?
2. **Gateway atual:** Evolution em produção? onde o webhook de mensagem é tratado? o objeto referral chega à aplicação?
3. **Escrita de venda:** todos os caminhos que criam/atualizam `vendas` (onde engatar o enfileiramento de Purchase — trigger vs app).
4. **Segmentos:** de onde a UI "Gestão de Clientes" lê Clientes/Leads/VIPs/Inativos hoje (`tipo`? `status`? hardcode?). Por que VIP/Inativo = 0.
5. **Config/segredos:** existe lugar server-side (env/edge secrets) para `META_CAPI_ACCESS_TOKEN`? o que `configuracoes` guarda?
6. **Tipos compartilhados:** regenerar `packages/shared/src/database.ts` após a migração.
7. **Dedup Pixel×CAPI:** o Pixel do catálogo emite Purchase? com qual `eventID`? (alinhar ao `event_id` da CAPI).
