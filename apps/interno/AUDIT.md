# AUDIT — apps/interno

> **Data**: 2026-05-08
> **Commit base**: e286072 (branch `main`)
> **Escopo**: `apps/interno` (Vite SPA + Supabase) + migrations consumidas (`supabase/migrations/`)
> **Diário bruto**: [`brownfield.md`](./brownfield.md) — 96 raw findings (Fases 1 + 2)
> **Lint atual**: 63 errors + 9 warnings

Este documento é o entregável formal da auditoria. Material bruto, descobertas in-context, e decisões de exaustividade vivem em `brownfield.md`.

---

## 1. Sumário executivo

| Severidade | Total |
|---|---|
| 🔴 Crítico | 2 |
| 🟠 Alto | 15 |
| 🟡 Médio | 27 |
| 🟢 Baixo | 31 |
| **Total** | **75** |

96 achados brutos → 75 catalogados + 12 mesclados + 8 rejeitados. Todos rastreados em `brownfield.md` (seção Fase 3).

**Maior surpresa da auditoria**: o briefing assumia "12 erros `Unexpected any` + 2 warnings react-hooks". O lint real reporta **63 errors + 9 warnings**, e o achado mais grave é completamente novo — bucket `products` do Storage com policies `INSERT/UPDATE/DELETE` para `to public` (anon). Qualquer um com a URL pública pode apagar todas as imagens de produto.

---

## 2. Matriz de priorização (impacto × esforço)

|  | Esforço baixo (trivial / pequeno) | Esforço alto (médio / grande) |
|---|---|---|
| **Impacto alto (🔴 / 🟠)** | **QUICK WINS** — H1, H5, H7, H8, H9, H10, H11, H12, H13 | **PROJETOS** — C1, C2, H2, H3, H4, H6, H14, H15 |
| **Impacto baixo (🟡 / 🟢)** | **FILL-INS** — M2, M3, M4, M5, M8, M11, M13, M14, M16, M20, M27, L1, L2, L3, L5, L6, L7, L9, L10, L12, L15, L16, L17, L25, L27, L29, L30, L31 | **DESCARTÁVEIS** — M1, M6, M7, M9, M10, M12, M15, M17, M18, M19, M21, M22, M23, M24, M25, M26, L4, L8, L11, L13, L14, L18, L19, L20, L21, L22, L23, L24, L26, L28 |

**Quick Wins**: alto impacto operacional/segurança e <2h cada. Atacar em sequência produz o maior delta de qualidade no menor tempo.

**Projetos**: alto impacto mas exigem desenho/teste/migration cuidadosos.

**Fill-ins**: baixo impacto mas tão baratos que vale fazer junto de qualquer mexida na vizinhança.

**Descartáveis**: deixe ficar até virar dor real.

---

## 3. Top 5 críticos

1. [**C1**](#c1-bucket-products-do-storage-permite-insertupdatedelete-para-anon) — Bucket `products` permite anon INSERT/UPDATE/DELETE em `storage.objects`.
2. [**C2**](#c2-21-rpcs-security-definer-executáveis-por-anon) — 21 RPCs `SECURITY DEFINER` chamáveis por `anon` via PostgREST (incluindo `registrar_pagamento_venda` e `fn_backfill_contatos_nome`).
3. [**H3**](#h3-policy-authenticated-update-access-em-contatos-usa-using-true) — Policy `Authenticated update access` em `contatos` é `USING (true) WITH CHECK (true)`.
4. [**H1**](#h1-tabelas-_backup_contatos_nome-e-backfill_contatos_nome_log-sem-rls) — Tabelas `_backup_contatos_nome_*` e `backfill_contatos_nome_log` sem RLS, expostas via PostgREST.
5. [**H4**](#h4-11-views-security-definer-bypassam-rls-do-consumidor) — 11 views `SECURITY DEFINER` bypassam RLS do consumidor.

## 4. Top 5 quick wins (alto impacto × esforço baixo)

1. [**H1**](#h1-tabelas-_backup_contatos_nome-e-backfill_contatos_nome_log-sem-rls) — `DROP TABLE` nas tabelas órfãs de backup (trivial).
2. [**H8**](#h8-recompraservice-não-exclui-brindes-do-cálculo-de-última-compra) — Filtrar `forma_pagamento <> 'brinde'` em `recompraService` (trivial).
3. [**H9**](#h9-confirmquitar-em-contasreceber-registra-formapagamento-da-venda-em-vez-do-recebimento) — Modal de quitação deve perguntar o método real de recebimento (pequeno).
4. [**H11**](#h11-criar_pedido-rpc-não-normaliza-prefixo-55-do-telefone-mas-trigger-de-sync-normaliza) — Alinhar regex de telefone entre `criar_pedido` e `fn_sync_cat_pedido_to_venda` (pequeno).
5. [**H12**](#h12-trigger-fn_sync_cat_pedido_to_venda-fixa-pagotrue-mesmo-para-forma_pagamentofiado) — Condicionar `pago=true` à `metodo_pagamento != 'fiado'` no trigger (pequeno).

---

## 5. Achados detalhados

### 5.1 — Segurança, autenticação e autorização

#### C1 — Bucket `products` do Storage permite INSERT/UPDATE/DELETE para anon

**Severidade**: 🔴 crítico
**Esforço**: médio (meio-dia)
**Local**: `supabase/migrations/20260405045304_remote_schema.sql:4117-4150`

```sql
create policy "Allow all deletes on products bucket" on "storage"."objects"
  as permissive for delete to public using ((bucket_id = 'products'::text));
create policy "Allow all inserts on products bucket" on "storage"."objects"
  as permissive for insert to public with check ((bucket_id = 'products'::text));
create policy "Allow all updates on products bucket" on "storage"."objects"
  as permissive for update to public ...
```

**Risco**: qualquer pessoa com a URL pública do Supabase (presente no JS bundle do catálogo) pode apagar todas as imagens de produto, sobrescrever com qualquer conteúdo (defacement) ou inflar o storage com lixo. Não há rate limit, não há auditoria. Restauro requer backup manual.

**Sugestão**: substituir as 3 policies destrutivas por equivalentes restritas a `to authenticated using (is_admin())`. Manter apenas SELECT público. Adicionar RLS test para validar que anon não consegue mais escrever. Verificar via `mcp__supabase get_advisors` que o lint `public_bucket_allows_listing` é o único restante.

---

#### C2 — 21 RPCs `SECURITY DEFINER` executáveis por `anon`

**Severidade**: 🔴 crítico
**Esforço**: médio (meio-dia)
**Local**: 21 funções em `public`, advisor lint `anon_security_definer_function_executable`. Lista em `brownfield.md` Fase 2.1-G.

```
add_image_reference, criar_obrigacao_parcelada, criar_pedido, delete_image_reference,
fn_backfill_contatos_nome, fn_sync_cat_pedido_to_venda, handle_audit_fields,
handle_brinde_before_insert, handle_stock_on_status_change, is_admin,
registrar_despesa_manual, registrar_entrada_manual, registrar_pagamento_conta_a_pagar,
registrar_pagamento_venda, rpc_total_a_receber_dashboard, rpc_total_a_receber_simples,
rpt_churn, rpt_vendas_por_periodo, sync_venda_to_cat_pedido,
update_purchase_order_with_items, update_venda_pagamento_summary
```

**Risco**: anon, com a anon key e o nome da função, pode invocar via `/rest/v1/rpc/...`. Casos críticos: `registrar_pagamento_venda` (fabrica pagamento + lançamento), `registrar_despesa_manual` (movimenta caixa), `fn_backfill_contatos_nome` (cria tabela snapshot e UPDATE em massa em contatos), `update_purchase_order_with_items` (sobrescreve pedido inteiro). Apenas `criar_pedido` e os triggers internos são legítimos pra anon — o resto é privilege escalation pronta.

**Sugestão**: separar as 3 funções legitimamente públicas (`criar_pedido`, `is_admin`, e talvez `add_image_reference` se chamada do admin do catálogo) e fazer `REVOKE EXECUTE ON FUNCTION X(...) FROM anon` para todas as outras 18. Para as funções financeiras, considerar também `REVOKE FROM authenticated` e adicionar `GRANT EXECUTE TO authenticated` somente após verificar `is_admin()` no corpo. Triggers (`fn_sync_cat_pedido_to_venda`, `handle_*`, `update_*`) não precisam de EXECUTE pra anon — são chamados pelo postgres role via trigger.

---

#### H1 — Tabelas `_backup_contatos_nome_*` e `backfill_contatos_nome_log` sem RLS

**Severidade**: 🟠 alto
**Esforço**: trivial (<30min)
**Local**: `supabase/migrations/20260423224225_backfill_contatos_nome.sql:7-13,27-32`

```sql
CREATE TABLE IF NOT EXISTS public.backfill_contatos_nome_log (...);
EXECUTE format('CREATE TABLE %I AS SELECT id, nome AS nome_antes, telefone, ... FROM contatos', snapshot_name);
```

Advisor lint: `rls_disabled_in_public` — ERROR.

**Risco**: snapshot contém `id`, `nome`, `telefone` de TODOS os contatos. Sem RLS, qualquer authenticated lê. PII vazada. As tabelas já cumpriram o papel (backfill é único e foi executado).

**Sugestão**: `DROP TABLE IF EXISTS public._backup_contatos_nome_20260424_121318; DROP TABLE IF EXISTS public.backfill_contatos_nome_log; DROP FUNCTION IF EXISTS public.fn_backfill_contatos_nome();`. Remover via nova migration. Como bônus, isso resolve o lint do advisor `anon_security_definer_function_executable` para `fn_backfill_contatos_nome` (parte de C2).

---

#### H2 — Migração de backfill (`20260423224225`) é não-idempotente, gera tabelas órfãs a cada apply

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `supabase/migrations/20260423224225_backfill_contatos_nome.sql:23,69`

```sql
snapshot_name text := '_backup_contatos_nome_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
...
SELECT public.fn_backfill_contatos_nome();  -- L69 executa no apply
```

**Risco**: cada `supabase db reset` cria nova tabela `_backup_contatos_nome_<TIMESTAMP>`. Em prod já existe uma; após N resets em dev/CI, acumulam. Em prod o problema é menor (apply único), mas devs locais ficam com lixo. Cada snapshot tem PII.

**Sugestão**: dado que H1 deleta o que existe, a melhor solução é tornar a migration retroativamente "no-op" em re-apply. Reescrever para NÃO executar no apply (remover L69) e/ou para usar `IF NOT EXISTS` na lógica de snapshot. Como os artefatos serão dropados em H1, o caminho mais limpo é uma nova migration que `DROP`a tudo e remove a função, e marcar a migration original como "já foi" no histórico. Operação manual via `supabase db push` em prod.

---

#### H3 — Policy `Authenticated update access` em `contatos` usa `USING (true)`

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `supabase/migrations/20260405045304_remote_schema.sql:3185`

```sql
CREATE POLICY "Authenticated update access" ON "public"."contatos"
  FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
```

Advisor: `rls_policy_always_true`.

**Risco**: qualquer login (mesmo um vendedor sem privilégios admin) pode UPDATE em qualquer contato — incluindo `telefone`, `endereco`, `observacoes`, `status_relacionamento`. Não há RBAC client-side em `AuthGuard.tsx:24`, então a UI já expõe edição. Quem clica salva.

**Sugestão**: trocar para `USING (is_admin()) WITH CHECK (is_admin())`. Se houver vendedores legítimos que precisam atualizar o próprio cadastro, adicionar segunda policy `FOR UPDATE TO authenticated USING (criado_por = auth.uid())` (assumindo coluna `criado_por`, que provavelmente não existe — caso em que vale criar e backfillar).

---

#### H4 — 11 views `SECURITY DEFINER` bypassam RLS do consumidor

**Severidade**: 🟠 alto
**Esforço**: médio (meio-dia)
**Local**: views detectadas pelo advisor (`security_definer_view`):

```
public.ranking_compras, public.view_contas_a_pagar_dashboard, public.view_extrato_mensal,
public.crm_view_operational_snapshot, public.ranking_indicacoes, public.vw_catalogo_produtos,
public.view_relacionamento_kanban, public.view_fluxo_resumo, public.vw_admin_dashboard,
public.rpt_projecao_pagamentos, public.vw_marketing_pedidos
```

**Risco**: views rodam com privilégios do criador (postgres role), ignorando RLS de quem consulta. Se uma view juntar `contatos` + `vendas`, anon ou authenticated lê dados que a RLS das tabelas-base bloqueariam. `view_relacionamento_kanban` em particular já é usada pelo CRM (`relacionamentoService.ts:17`).

**Sugestão**: para Postgres 15+, recriar cada view com `WITH (security_invoker = true)`. Antes de aplicar, validar caso-a-caso se algum consumidor depende do bypass (provavelmente nenhum, mas vale grep no `apps/catalogo` também). Roteiro: criar nova migration `20260508_*_security_invoker_views.sql` que faz `ALTER VIEW ... SET (security_invoker = on)` para as 11.

---

#### M1 — Policies `Public insert` em `contatos`/`cat_pedidos`/`cat_itens_pedido` sem rate limit

**Severidade**: 🟡 médio
**Esforço**: médio (meio-dia)
**Local**: `supabase/migrations/20260405045304_remote_schema.sql:3202-3210`

```sql
CREATE POLICY "Public insert access" ON "public"."contatos" FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert items"   ON "public"."cat_itens_pedido" FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert orders"  ON "public"."cat_pedidos"     FOR INSERT WITH CHECK (true);
```

**Risco**: necessário para o fluxo do catálogo público (anon faz pedido), mas anon pode injetar lixo em alta velocidade. Esgota recursos via triggers que disparam `fn_sync_cat_pedido_to_venda` em cascata.

**Sugestão**: deixar policies (negócio depende), MAS adicionar Edge Function como proxy de rate limit antes da chamada do `criar_pedido`, ou usar Cloudflare em frente do Supabase. Como mitigação imediata, adicionar `WITH CHECK (...validações de campos...)` que bloqueie payloads visualmente inválidos.

---

#### M2 — 3 funções com `search_path` mutável

**Severidade**: 🟡 médio
**Esforço**: trivial (<30min)
**Local**: `public.prevent_delete_automatic_plan`, `public.fn_count_words`, `public.fn_capitalize_name`. Advisor: `function_search_path_mutable`.

**Risco**: vetor de schema-hijack. Probabilidade baixa em ambiente bem isolado.

**Sugestão**: nova migration que `CREATE OR REPLACE FUNCTION ... SET search_path TO 'public'` em cada uma.

---

#### M3 — `auth.leaked_password_protection` desabilitado

**Severidade**: 🟡 médio
**Esforço**: trivial (<30min)
**Local**: configuração do projeto Supabase (`herlvujykltxnwqmwmyx`).

**Risco**: usuários podem cadastrar senhas presentes no HaveIBeenPwned.

**Sugestão**: ligar via dashboard Supabase > Authentication > Settings > Password protection.

---

#### M4 — Sem RBAC client-side; `AuthGuard` só verifica `user != null`

**Severidade**: 🟡 médio
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/components/auth/AuthGuard.tsx:24`, `apps/interno/src/hooks/useAuth.ts:5-38`.

**Risco**: rotas administrativas (`/produtos`, `/configuracoes`, `/plano-de-contas`) ficam acessíveis a qualquer usuário autenticado pela UI. RLS no DB barra o write em alguns casos, mas H3 mostra que `contatos` deixa passar. UI mostrar interfaces administrativas é confuso e perigoso.

**Sugestão**: estender `useAuth` para fazer query a `is_admin(auth.uid())` e expor `isAdmin: boolean`. Criar `AdminGuard` que redireciona não-admins. Aplicar nas rotas sensíveis.

---

#### M5 — Possível PostgREST filter injection via `or()` em `contatoService.func`

**Severidade**: 🟡 médio
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/services/contatoService.ts:24-26`

```ts
const term = query.replace(/[%_]/g, '')
builder = builder.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,apelido.ilike.%${term}%`)
```

**Risco**: `replace(/[%_]/g, '')` filtra wildcards SQL mas não meta-caracteres do PostgREST (`,`, `(`, `)`). Authenticated mal-intencionado pode injetar cláusulas adicionais via query. Limitado ao SELECT em `contatos` (que já é authenticated read), mas é pattern ruim.

**Sugestão**: usar `.or()` com URL-encoding via builder (ou substituir por chamada parametrizada `.ilike('nome', `%${term}%`)` etc., e fazer `or()` de filtros já tipados). Alternativa: validar `term` com regex `^[a-zA-Z0-9 ]+$`.

---

#### M6 — Validação Zod presente apenas em 2 schemas centralizados; outros formulários inline ou ausentes

**Severidade**: 🟡 médio
**Esforço**: pequeno por modal
**Local**: `apps/interno/src/schemas/` tem só `contato.ts` e `venda.ts`. Modais com Zod inline: `ContaAPagarModal.tsx:11-20`, `PagamentoContaAPagarModal.tsx:23-29`. Sem Zod: `ContaModal.tsx:23-28` (financeiro), modais de `Configuracoes.tsx`, formulários de `LancamentoModal`, `TransferenciaModal`, `PlanoContaModal`, `PurchaseOrderForm`.

**Risco**: validação ad-hoc por componente é fácil de regredir. Operador insere texto onde devia haver número, formulário aceita, RPC explode no DB.

**Sugestão**: extrair schemas inline para `apps/interno/src/schemas/` com nomes consistentes. Criar schemas faltantes (`conta.ts`, `lancamento.ts`, `purchaseOrder.ts`).

---

#### L3 — `useAuth.ts` sem refresh-on-focus / PKCE customizado

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/hooks/useAuth.ts:5-38`.

**Risco**: token expira durante operação longa, erro silencioso.

**Sugestão**: `supabase.auth.refreshSession()` em `visibilitychange` listener.

---

### 5.2 — Tipagem e qualidade de tipo

#### H5 — `DomainProduto.preco_ancoragem` (snake) e `precoAncoragem` (camel) coexistem

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/types/domain.ts:52-53`; mapper `apps/interno/src/services/mappers.ts:128`; service `apps/interno/src/services/produtoService.ts:94`.

```ts
// types/domain.ts
preco_ancoragem?: number | null   // snake
precoAncoragem?: number | null    // camel

// mappers.ts (read path)
precoAncoragem: dbProduto.preco_ancoragem ? Number(dbProduto.preco_ancoragem) : null

// produtoService.ts (write path)
if (data.preco_ancoragem !== undefined) dbUpdate.preco_ancoragem = data.preco_ancoragem
```

**Risco**: read populates `precoAncoragem`; write expects `preco_ancoragem`. Form que salva via snake_case relê em camelCase e exibe vazio. Confusão de operador e potencial perda de dado de display.

**Sugestão**: padronizar em `precoAncoragem` (camelCase, consistente com o resto do domain). Atualizar `UpdateProduto` em `domain.ts:107` para usar `precoAncoragem?` em vez de `preco_ancoragem?`. Atualizar `produtoService.update:94` para mapear `precoAncoragem → dbUpdate.preco_ancoragem`.

---

#### M7 — 28 ocorrências de `Unexpected any` no lint (lista exata em brownfield.md F2.2-A)

**Severidade**: 🟡 médio
**Esforço**: médio (meio-dia para todos)
**Local**: distribuído em 18 arquivos. Os mais densos: `services/mappers.ts:28-32,215,257` (7 errors), `services/vendaService.ts:87,115,267,268` (4), `services/dashboardService.ts:3,4,5` (3), `services/recompraService.ts:34,43` (2), `services/catalogService.ts:26,29` (2), `pages/RelatorioFabrica.tsx:51,60` (2). Lista completa classificada em `brownfield.md` Fase 2.2-A.

**Risco**: type aliases `any` exportados por services públicos (ex.: `cashFlowService.ts:28 export type VendaAlerta = any`) propagam ausência de tipos a todo consumidor. Refatorações ficam invisíveis ao compilador.

**Sugestão**: priorizar os 8 `type X = any` em `services/dashboardService.ts:3-5`, `cashFlowService.ts:28`, `mappers.ts:28-32` — todos têm equivalente em `Database['public']['Tables'/'Views']`. Eliminar esses 8 destrava ~10 dos `(x: any) =>` em chamadas downstream. Manter os 3 `as any` legítimos do CLAUDE.md (zodResolver) e o de `ContatoFormModal.tsx:92`.

---

#### M8 — `DomainContato.tipo` aceita `'catalogo'` mas Zod só `B2C/B2B/FORNECEDOR`

**Severidade**: 🟡 médio
**Esforço**: trivial
**Local**: `apps/interno/src/types/domain.ts:22` vs `apps/interno/src/schemas/contato.ts:16`.

**Risco**: contato com `tipo='catalogo'` rejeitado pelo form Zod. Provável valor histórico/morto (não encontrado writers de `'catalogo'`).

**Sugestão**: confirmar via `SELECT DISTINCT tipo FROM contatos` se algum registro tem o valor. Se não tiver, remover de `DomainContato.tipo`. Se tiver, adicionar ao Zod e investigar quem escreve.

---

#### M9 — `vendaSchema` coleta `parcelas`, `data_entrega`, `observacoes` que `CreateVenda` ignora

**Severidade**: 🟡 médio
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/schemas/venda.ts:17-22` declara campos. `apps/interno/src/types/domain.ts:112-124` `CreateVenda` não tem. `apps/interno/src/pages/NovaVenda.tsx:142-156` (`handleConfirmSale`) descarta-os ao montar payload.

**Risco**: operador digita observações no checkout, marca parcelas em cartão, escolhe data de entrega — nada é persistido. A venda no DB sai sem essas informações. UX bug silencioso.

**Sugestão**: estender `CreateVenda` com `parcelas?`, `dataEntrega?`, `observacoes?`. Estender `vendaService.createVenda:123-133` para mapear pra colunas (a tabela `vendas` já tem `observacoes`; `parcelas` provavelmente vai pra futura coluna ou pra `pagamentos_venda`).

---

#### M10 — `ContatoFormData` (Zod) não tem `email`, `lat`, `lng`

**Severidade**: 🟡 médio
**Esforço**: pequeno
**Local**: `apps/interno/src/schemas/contato.ts` vs `apps/interno/src/types/domain.ts:16-45` (DomainContato).

**Risco**: form não captura email mesmo que DB tenha coluna. `lat`/`lng` derivados via geocoding (`contatoService.ts:89-99`), aceitável. Email é o gap real.

**Sugestão**: adicionar `email: z.string().email().optional().nullable()` em `contatoSchema`. Adicionar campo no `FormIdentidade.tsx`.

---

#### M11 — `_error/_err/_event` capturados e nunca usados (9 errors lint)

**Severidade**: 🟡 médio
**Esforço**: pequeno (sweep)
**Local**: `pages/Configuracoes.tsx:119,136,165`, `pages/ContasReceber.tsx:45,57,119`, `pages/NovaVenda.tsx:166`, `pages/Relacionamento.tsx:219`, `pages/VendaDetalhe.tsx:125`, `components/features/financeiro/ContaModal.tsx:38`. Padrão: `try {} catch (_error) { /* nada ou toast genérico */ }`.

**Risco**: erros propagados pelo backend (RLS, validação, network) são suprimidos. Operador vê toast genérico ou nada. Debug em prod impossível.

**Sugestão**: substituir `(_error)` por `(error)` e logar via wrapper que inclua contexto. Quando observability for adicionada (H15), todos esses pontos ganham telemetria. Alguns dos catches são também `no-empty` (L7).

---

#### L4 — `cashFlowService.getContasReceber` retorna sem `Promise<X[]>` explícito

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/services/cashFlowService.ts:186-198`.

**Risco**: tipo inferido da query Supabase com join aninhado leak para callers.

**Sugestão**: declarar `Promise<VendaContaReceber[]>` com tipo explícito.

---

#### L5 — `vite-env.d.ts` 3 errors `no-empty-object-type`

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/vite-env.d.ts:7,13,20`.

**Risco**: nenhum funcional. Boilerplate Vite que o lint atual reclama.

**Sugestão**: substituir `interface X {}` por `type X = unknown` ou adicionar `// eslint-disable-next-line @typescript-eslint/no-empty-object-type`.

---

### 5.3 — Lógica de negócio

#### H6 — `vendaService.createVenda`: insert sem transação (orphan venda risk)

**Severidade**: 🟠 alto
**Esforço**: médio (meio-dia)
**Local**: `apps/interno/src/services/vendaService.ts:106-152`.

```ts
const { data: vendaData } = await supabase.from('vendas').insert(vInsert).select().single()
if (vendaError) throw vendaError
if (data.itens.length > 0) {
    const { error: itensError } = await supabase.from('itens_venda').insert(iInserts)
    if (itensError) throw itensError
}
```

**Risco**: se `itens_venda.insert` falha (RLS, FK, network) após `vendas.insert` ter ido, fica venda órfã com `total != soma(itens)` (zero itens). Cálculos de KPI ficam errados; relatório fábrica perde produto. `criar_pedido` (RPC do catálogo) é atômico via PL/pgSQL, mas o operador interno que cria via UI usa esse path não-transacional.

**Sugestão**: criar RPC `criar_venda_interna(p_contato_id, p_data, p_forma_pagamento, p_taxa_entrega, p_data_prevista_pagamento, p_itens jsonb)` análogo a `criar_pedido`, executando os 2 INSERTs em uma única transação. Atualizar `vendaService.createVenda` para chamar a RPC.

---

#### H7 — `_syncCatPedido` swallow de erros via `console.error`

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/services/vendaService.ts:13-47`.

```ts
} catch (err) {
    console.error('[sync cat_pedidos] Erro inesperado:', err)
}
```

**Risco**: operador atualiza venda → trigger DB nem sempre sincroniza (depende de trigger DB direção contrária); o sync do client (`_syncCatPedido`) também silenciosamente falha em RLS/race. Resultado: `cat_pedidos.status` diverge de `vendas.status` sem alerta.

**Sugestão**: propagar o erro para o caller (que já tem try/catch e mostra toast), ou pelo menos enviar para Sentry quando H15 estiver no lugar. Como first-pass: substituir `console.error` por `throw new Error(...)` e deixar o caller decidir.

---

#### H8 — `recompraService` não exclui brindes do cálculo de "última compra"

**Severidade**: 🟠 alto
**Esforço**: trivial (<30min)
**Local**: `apps/interno/src/services/recompraService.ts:25-29`.

```ts
const { data: vendasData } = await supabase
    .from('vendas')
    .select('contato_id, data')
    .eq('status', 'entregue')
    .order('data', { ascending: false })
```

**Risco**: cliente que recebeu APENAS brindes (`forma_pagamento='brinde'`, `pago=false`, `status='entregue'`) seria considerado "comprou recentemente" no cálculo de recompra. Deixa de aparecer no painel de recompra/reativação no momento certo. Regra de negócio (CLAUDE.md): "Brindes: exclude from revenue calculations".

**Sugestão**: adicionar `.neq('forma_pagamento', 'brinde')` no L29.

---

#### H9 — `confirmQuitar` em `ContasReceber` registra `forma_pagamento` da venda em vez do recebimento

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/pages/ContasReceber.tsx:115` + `apps/interno/src/services/vendaService.ts:346-357`.

```ts
// ContasReceber.tsx:115 - chama com formaPagamento da venda original
await vendaService.quitarVenda(selectedVenda.id, selectedVenda.formaPagamento, selectedContaId)
```

**Risco**: cliente fechou venda como `fiado` há 30 dias. Hoje paga via PIX. Operador clica "Quitar" — modal só pede a conta de destino. O service usa a forma de pagamento ORIGINAL ('fiado'). Em `pagamentos_venda` e `lancamentos`, o `metodo` registrado é 'fiado' em vez de 'pix'. Conciliação contábil errada.

**Sugestão**: estender modal de quitação (`Modal` em `ContasReceber.tsx:300-357`) com `Select` para método de pagamento (pix/dinheiro/cartao/transferencia). Passar para `quitarVenda(id, metodo_real, contaId)`.

---

#### H10 — `useCatalogoPendentes.vincularManualmente` cria venda SEM itens

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/hooks/useCatalogoPendentes.ts:55-72`.

```ts
const vendaInsert: any = {
    contato_id: contatoId,
    data: ...,
    total: pedido.total || 0,
    forma_pagamento: pedido.metodo_pagamento || 'pix',
    ...
    taxa_entrega: pedido.frete || 0
}
const { error: errVenda } = await supabase.from('vendas').insert(vendaInsert)
// Sem inserção de itens_venda!
```

**Risco**: feature de "vincular manualmente" cria a venda mas não copia `cat_itens_pedido` → `itens_venda`. Venda fica com `total` mas sem itens, sem `custo_total`. Dashboard de fábrica perde o produto. Cálculo de KPI fica errado para esta venda.

**Sugestão**: após inserir vendas, copiar itens em loop (similar ao trigger `fn_sync_cat_pedido_to_venda` em `fix_trigger_origem_catalogo.sql:64-85`). Calcular `custo_total` a partir de `produtos.custo`. Persistir como `UPDATE vendas SET custo_total = ... WHERE id = ...`. Idealmente, encapsular em uma RPC `vincular_pedido_catalogo_a_venda` reutilizando a lógica do trigger.

---

#### H11 — `criar_pedido` RPC não normaliza prefixo "55" do telefone, mas trigger de sync normaliza

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `supabase/migrations/20260423223939_add_name_helpers_and_update_criar_pedido.sql:131-136` vs `supabase/migrations/20260405215115_fix_trigger_origem_catalogo.sql:30-33`.

```sql
-- criar_pedido (RPC do catálogo)
v_telefone_norm := regexp_replace(p_telefone_cliente, '[^0-9]', '', 'g');
SELECT id, nome INTO v_contato_id, ... FROM contatos
WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = v_telefone_norm;

-- fn_sync_cat_pedido_to_venda (trigger pós-entrega)
v_telefone_normalizado := regexp_replace(NEW.telefone_cliente, '\D', '', 'g');
IF LENGTH(v_telefone_normalizado) >= 12 AND LEFT(v_telefone_normalizado, 2) = '55' THEN
    v_telefone_normalizado := SUBSTRING(v_telefone_normalizado FROM 3);
END IF;
```

**Risco**: cliente cadastra no catálogo como "+55 11 99999-9999". `criar_pedido` busca por `5511999999999` e cria contato novo (não acha existente). Mais tarde, quando o pedido vira venda via trigger, este busca por `11999999999` (sem 55) e pode achar OUTRO contato (do operador). **Resultado: 2 contatos para a mesma pessoa, vendas espalhadas em ambos**.

**Sugestão**: extrair lógica de normalização para função `fn_normalizar_telefone(text) RETURNS text` e usar nas duas. Backfill: `UPDATE contatos SET telefone = fn_normalizar_telefone(telefone)` (cuidado com duplicatas; pode precisar dedupe primeiro).

---

#### H12 — Trigger `fn_sync_cat_pedido_to_venda` fixa `pago=true` mesmo para `forma_pagamento='fiado'`

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `supabase/migrations/20260405215115_fix_trigger_origem_catalogo.sql:54-56`.

```sql
INSERT INTO public.vendas (
    contato_id, data, total, forma_pagamento, status, pago, ...
) VALUES (
    v_contato_id, ..., NEW.total,
    COALESCE(NEW.metodo_pagamento, 'pix'),
    'entregue',
    true,                      -- <-- pago hardcoded TRUE
    ...
);
```

**Risco**: catálogo permite `metodo_pagamento='fiado'` (cliente B2B?). Quando o pedido vai pra status `entregue`, o trigger cria venda com `pago=true && forma_pagamento='fiado'`. Estado incoerente. `aReceber` filtra `!pago`, então essa venda fiado nunca aparece em ContasReceber. Dinheiro a receber sumindo do dashboard.

**Sugestão**: condicionar `pago` no trigger:

```sql
CASE WHEN COALESCE(NEW.metodo_pagamento, 'pix') = 'fiado' THEN false ELSE true END
```

Considerar também `data_prevista_pagamento` quando fiado (default 30 dias?).

---

#### H13 — `CheckoutSidebar` reseta form a cada re-render do parent

**Severidade**: 🟠 alto
**Esforço**: pequeno (1-2h)
**Local**: `apps/interno/src/components/features/vendas/NovaVenda/CheckoutSidebar.tsx:65-76` + `apps/interno/src/pages/NovaVenda.tsx:269-274`.

```tsx
// CheckoutSidebar.tsx:65-76
useEffect(() => {
    reset({ contato_id: contatoId, ..., itens: items, observacoes: '', ... })
}, [contatoId, items, reset])

// NovaVenda.tsx:269 (parent)
items={cart.map(item => ({ produto_id: item.produto_id, ... }))}  // nova ref a cada render
```

**Risco**: parent recria array `items` a cada render. Effect dispara, `reset()` zera observação/taxa de entrega/parcelas digitadas. Cenário: usuário digita "Deixar na portaria"; toast aparece (parent re-render); observação some. Bug reproduzível.

**Sugestão**: estabilizar `items` no parent com `useMemo`. Ou no child, comparar profundamente antes de chamar `reset`. Solução mais simples: remover `items` das deps do effect e fazer reset apenas em `[contatoId, reset]` — o `defaultValues.itens` continua correto na primeira mount; mudanças de carrinho não devem zerar observação.

---

#### H14 — Dois caminhos de sync (trigger DB + service client) para `vendas` ↔ `cat_pedidos`

**Severidade**: 🟠 alto
**Esforço**: médio (meio-dia)
**Local**:
- Trigger DB: `fn_sync_cat_pedido_to_venda` em `supabase/migrations/20260405215115_fix_trigger_origem_catalogo.sql` e `sync_venda_to_cat_pedido` em `remote_schema.sql:1007`.
- Client: `apps/interno/src/services/vendaService.ts:13-47` (`_syncCatPedido`).

**Risco**: operador atualiza venda → service chama `_syncCatPedido` que faz UPDATE em `cat_pedidos`. O UPDATE em `cat_pedidos` PODE disparar `fn_sync_cat_pedido_to_venda` que faz UPDATE de volta em `vendas`. Loop ou double-write. Em paralelo, `sync_venda_to_cat_pedido` em `vendas` UPDATE também atualiza `cat_pedidos`. Triplo sync.

**Sugestão**: escolher uma autoridade. Recomendado: deletar `_syncCatPedido` do client (deixar triggers fazerem o trabalho). Validar via testes de integração `sync.integration.test.ts` que tudo continua. Adicionar `IF NEW.* IS DISTINCT FROM OLD.*` nos triggers para evitar self-firing.

---

#### M12 — `deleteUltimoPagamento` casa lançamento por `valor + venda_id` (ambiguidade em pagamentos iguais)

**Severidade**: 🟡 médio
**Esforço**: médio
**Local**: `apps/interno/src/services/vendaService.ts:303-313`.

**Risco**: 2 pagamentos parciais de R$50 cada na mesma venda. `deleteUltimoPagamento` casa pelo `criado_em DESC` mas lookup do lançamento é por `valor + venda_id` ordenado por `criado_em DESC` → casa o lançamento mais recente. Funciona se ordem de criação foi consistente. Falha se lançamento foi criado manualmente fora de ordem.

**Sugestão**: persistir `pagamento_id` em `lancamentos` (FK direta). Ou trocar por RPC atômica que faça delete em ambos por ID conhecido.

---

#### M13 — `calculateKPIs.produtosVendidos`: matching de pote por substring no nome

**Severidade**: 🟡 médio
**Esforço**: trivial
**Local**: `apps/interno/src/services/vendaService.ts:267-274`.

```ts
if (item.produto?.nome.includes('1kg')) acc.pote1kg += item.quantidade
if (item.produto?.nome.includes('4kg')) acc.pote4kg += item.quantidade
```

**Risco**: produto novo "Recheio 1kg" ou "Embalagem 4kg" entra na contagem indevidamente.

**Sugestão**: usar `produto.codigo` ou `produto.categoria` ou flag explícita. Se a tabela `produtos` tem `peso_kg`, casar por `peso_kg=1` e `peso_kg=4`.

---

#### M14 — `Relacionamento.tsx:185-187`: setState dentro de useEffect (cascading renders)

**Severidade**: 🟡 médio
**Esforço**: trivial
**Local**: `apps/interno/src/pages/Relacionamento.tsx:185-187`.

```tsx
useEffect(() => {
    if (abaInicial !== abaAtiva) setAbaAtiva(abaInicial)
}, [abaAtiva, abaInicial])
```

Lint: `react-hooks/set-state-in-effect`.

**Risco**: anti-pattern. Deriva `abaAtiva` quando deveria ser computado de `abaInicial` direto.

**Sugestão**: mover `abaAtiva` para `useMemo(() => abaInicial, [abaInicial])` ou tornar `abaInicial` o source-of-truth direto via `useSearchParams`.

---

#### M15 — `gerarPreviewParcelas` no client e `criar_obrigacao_parcelada` no server podem divergir em arredondamento

**Severidade**: 🟡 médio
**Esforço**: pequeno
**Local**: `apps/interno/src/components/features/contas-a-pagar/ContaAPagarModal.tsx:36-58` vs RPC `criar_obrigacao_parcelada` (corpo em `remote_schema.sql:97`, não inspecionado linha-a-linha).

**Risco**: usuário vê preview de R$ 333.33 x3 + 333.34. Server pode calcular diferente, persistindo R$ 333.33 x2 + R$ 333.34 + R$ 333.33. Confusão de operador.

**Sugestão**: ler o source do RPC e alinhar a regra. Idealmente, RPC retorna o preview de parcelas; client renderiza o que recebeu.

---

#### M16 — Sem proteção a duplo-submit em `createVenda` e modais

**Severidade**: 🟡 médio
**Esforço**: pequeno
**Local**: `apps/interno/src/pages/NovaVenda.tsx:142-169`, `apps/interno/src/components/features/vendas/NovaVenda/CheckoutSidebar.tsx:107`.

**Risco**: usuário tecla Enter 2x ou clica rapidamente em "CONFIRMAR VENDA". Sem dedup, 2 mutations vão pra rede e 2 vendas são criadas.

**Sugestão**: usar `mutation.isPending` no botão `disabled` e em early-return no handler. React Query já tracka isso por mutação; basta usar.

---

#### M17 — `Configuracoes.tsx`: múltiplos UPSERTs serializados sem rollback

**Severidade**: 🟡 médio
**Esforço**: pequeno
**Local**: `apps/interno/src/pages/Configuracoes.tsx:74,111,131,145-157`.

**Risco**: salvar "Configurações da Empresa" pode parcialmente persistir se conexão cair no meio. Operador acha que salvou tudo.

**Sugestão**: encapsular em RPC única que aceite jsonb com todas as chaves e faça `UPSERT` em `configuracoes` em uma transação. Ou usar `Promise.all` de upserts e mostrar parciais ao usuário.

---

#### M18 — `cashFlowService.createTransferencia` não atualiza saldos explicitamente

**Severidade**: 🟡 médio
**Esforço**: pequeno (verificação)
**Local**: `apps/interno/src/services/cashFlowService.ts:96-118`. Trigger esperado: `update_conta_saldo_lancamento` em `remote_schema.sql:1089` (corpo não inspecionado).

**Risco**: se o trigger só ajusta `conta_id`, o destino (`conta_destino_id`) não é creditado. Saldo descasa.

**Sugestão**: verificar trigger source em `remote_schema.sql:1091-1156`. Adicionar teste de integração que valida saldo após transferência.

---

#### L6 — `updateVenda` chama `_syncCatPedido` 2x quando há status + pago

**Severidade**: 🟢 baixo (perf)
**Esforço**: trivial
**Local**: `apps/interno/src/services/vendaService.ts:166-172`.

**Sugestão**: consolidar em uma chamada `_syncCatPedido(id, { status, status_pagamento })`.

---

#### L7 — `Relacionamento.handleDragCancel(_event)` parâmetro nunca usado

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/pages/Relacionamento.tsx:219`.

**Sugestão**: remover o parâmetro ou usar `()`.

---

#### L8 — Race em optimistic update de `useMoverCard` quando user arrasta 2x

**Severidade**: 🟢 baixo (edge case)
**Esforço**: médio
**Local**: `apps/interno/src/hooks/useRelacionamento.ts:25-58`.

**Sugestão**: rejeitar mutations enquanto há uma pendente para o mesmo `contatoId`.

---

#### L9 — `criar_pedido` faz seq scan de `contatos` por telefone normalizado

**Severidade**: 🟢 baixo (perf, futuro)
**Esforço**: pequeno
**Local**: `add_name_helpers_and_update_criar_pedido.sql:131-136`.

**Sugestão**: criar índice funcional `CREATE INDEX idx_contatos_telefone_norm ON contatos (regexp_replace(telefone, '[^0-9]', '', 'g'))`. Casa com a lógica de H11 (alinhar normalização).

---

#### L10 — `produtoService.deleteImage`: ordem não-transacional

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/services/produtoService.ts:168-181`. Storage delete é "best effort" com warn.

**Sugestão**: aceitar como é; ou inverter ordem (storage primeiro, então DB).

---

#### L11 — `recompraService.getRecompraData` faz query em todas as vendas entregues sem filtro de data

**Severidade**: 🟢 baixo (perf, futuro)
**Esforço**: pequeno
**Local**: `apps/interno/src/services/recompraService.ts:25-29`.

**Sugestão**: limitar a últimos 6 meses com `.gte('data', sixMonthsAgo)` — clientes mais antigos não influenciam o cálculo de "última compra recente".

---

#### L12 — `useIndicacoes` faz transformação morta sobre campo `indicador` não fetchado

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/hooks/useIndicacoes.ts:46-55, 58-66`.

**Sugestão**: deletar a transformação `indicador: Array.isArray(c.indicador) ? c.indicador[0] : c.indicador` — o campo nunca vem da query.

---

### 5.4 — Performance e UX

#### M19 — Padrão `watch(field)` da react-hook-form em 5 modais causa "Compilation Skipped"

**Severidade**: 🟡 médio
**Esforço**: pequeno por arquivo
**Local**: `ContaAPagarModal.tsx:89-91`, `PagamentoContaAPagarModal.tsx:78`, `ContatoFormModal.tsx:60-62` (silenciado por `eslint-disable-next-line` em L59), `CheckoutSidebar.tsx:60-62`, `PaymentSidebar.tsx:74-75`. Lint pega só os 2 primeiros (warnings); os 3 restantes têm o mesmo problema sem warning.

**Risco**: React Compiler abandona memoização do componente todo. Re-render do zero a cada update. Em modais pequenos imperceptível; em CheckoutSidebar (295 linhas, 3 watches) sentido.

**Sugestão**: substituir `watch(field)` por `useWatch({ control, name: 'field' })` (compatível com Compiler). Ou usar `Controller` quando precisar do valor reativo.

---

#### M20 — `useLogistica` realtime sem debounce em ráfaga de inserts

**Severidade**: 🟡 médio
**Esforço**: pequeno
**Local**: `apps/interno/src/hooks/useLogistica.ts:41-54`.

**Risco**: subscription `*` em `vendas` dispara `fetchLogistics()` a cada INSERT/UPDATE/DELETE. Cadastro em massa = N refetchs em segundos.

**Sugestão**: debounce de 1-2s no callback (lodash, custom, ou setTimeout simples).

---

#### M21 — 7 warnings `react-hooks/exhaustive-deps` (closures stale potenciais)

**Severidade**: 🟡 médio
**Esforço**: pequeno (sweep)
**Local**: `useContatos.ts:58/67/82` (toast missing), `PagamentoContaAPagarModal.tsx:103` (contasAtivas), `ContasAPagar.tsx:90` (MONTHS_MAP, now), `ContasReceber.tsx:50` (toast), `Entregas.tsx:113` (toast).

**Sugestão**: padronizar `toast` como referência estável (memoizar no provider) ou adicionar nas deps. `MONTHS_MAP` mover pra fora do componente. `now` capturado intencionalmente — ESLint disable comment justifica.

---

#### M22 — `ContasReceber` faz fetch agressivo de TODAS as vendas e filtra client

**Severidade**: 🟡 médio
**Esforço**: pequeno
**Local**: `apps/interno/src/pages/ContasReceber.tsx:43-44`.

```ts
const data = await vendaService.getVendas(undefined, undefined, false)
setVendas(data.filter(v => v.status === 'entregue' && !v.pago && v.origem !== 'catalogo' && v.formaPagamento !== 'brinde'))
```

**Risco**: `getVendas` faz query com 3 joins e retorna todas as vendas; client filtra. Para 5000 vendas, ~1MB payload e ~ms de filter.

**Sugestão**: criar `vendaService.getContasReceber()` que aplica filtros no DB (`.eq('status', 'entregue').eq('pago', false).neq('origem', 'catalogo').neq('forma_pagamento', 'brinde')`). Ou reutilizar `cashFlowService.getContasReceber`.

---

#### L13 — `useContatos.ts`: 3 errors `react-hooks/preserve-manual-memoization`

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/hooks/useContatos.ts:51,60,69`.

**Sugestão**: o React Compiler memoizá automaticamente; remover useCallbacks manuais (ou manter e deixar o compiler skipar).

---

#### L14 — Sem virtualização em listas grandes (Vendas, Contatos, Produtos)

**Severidade**: 🟢 baixo (futuro)
**Esforço**: médio
**Local**: `pages/Vendas.tsx`, `pages/Contatos.tsx`, `pages/Produtos.tsx`, `pages/Relacionamento.tsx` (Kanban).

**Sugestão**: adicionar `@tanstack/react-virtual` quando listas crescerem para >200 itens. Não urgente.

---

#### L15 — `ContasAPagar.useMemo` com `MONTHS_MAP` e `now` recriados

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/pages/ContasAPagar.tsx:43-50`.

**Sugestão**: mover `MONTHS_MAP` para `const` module-level. `now` é intencionalmente capturado no mount.

---

#### L16 — `produtoService.getAll` faz 2 queries serializadas

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/services/produtoService.ts:11-38`.

**Sugestão**: paralelizar com `Promise.all([produtosQuery, imagensQuery])`.

---

#### L17 — `RelatorioFabrica`: 2 queries serializadas para `configuracoes`

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/pages/RelatorioFabrica.tsx:46-63`.

**Sugestão**: uma query com `.in('chave', ['telefone_fabrica', 'nome_fabrica'])`.

---

#### L18 — `Estoque3DView` carrega three.js sem code-splitting interno

**Severidade**: 🟢 baixo
**Esforço**: pequeno
**Local**: rota `/estoque` em `App.tsx:20`. Página é lazy mas o bundle interno é monolítico.

**Sugestão**: aceitar como é (rota pouco usada). Ou code-split os hooks pesados de R3F.

---

#### L19 — Realtime `useLogistica` sem reconexão lógica em desconexão

**Severidade**: 🟢 baixo
**Esforço**: pequeno
**Local**: `apps/interno/src/hooks/useLogistica.ts:41-54`.

**Sugestão**: o cliente Supabase faz reconnect automático. Verificar com teste manual. Se falhar, ouvir `STATUS_DISCONNECTED` e re-subscribe.

---

### 5.5 — Sync, realtime e dados offline

#### M23 — Sem optimistic locking; concurrent edit = last-write-wins

**Severidade**: 🟡 médio
**Esforço**: médio
**Local**: tabelas `vendas`, `contas_a_pagar`, `cat_pedidos` etc., todas sem coluna `version`.

**Risco**: 2 operadores no mesmo pedido em paralelo. Último UPDATE silenciosamente sobrescreve o primeiro.

**Sugestão**: adicionar coluna `version int default 0` nas tabelas críticas; UPDATEs incrementam e validam. Custom error em conflito. Pode ser feature de longo prazo.

---

#### M24 — Sem mutation queue offline (PWA cacheia só assets)

**Severidade**: 🟡 médio
**Esforço**: grande
**Local**: `apps/interno/vite.config.ts:9-33` (Vite-PWA configurado para assets). Sem queue para mutations.

**Risco**: operador no campo (entrega) com sinal ruim; cria venda offline; perde a operação.

**Sugestão**: implementar queue de mutations com IndexedDB (Workbox Background Sync). Médio-grande projeto. Não bloqueante.

---

#### M25 — Invalidações de cache TanStack inconsistentes pós-mutation

**Severidade**: 🟡 médio
**Esforço**: pequeno (sweep)
**Local**: `useVendas`, `useContatos`, `useContasAPagar`, `useRelacionamento`, etc.

Exemplos concretos:
- `useVendas.createVendaMutation` invalida `['vendas']`, `['dashboard_metrics']`, `['produtos']`. Não invalida `['contas_a_receber']`.
- `useContatos.updateMutation` invalida `['contatos']` e `['venda']` (singular!). `['vendas']` (plural) não é invalidado.
- `useRelacionamento.useMoverCard.onSettled` invalida só `RELACIONAMENTO_QUERY_KEY` — não invalida `['vendas']`.

**Sugestão**: criar `cacheKeys.ts` com mapa central. Cada mutation referencia keys afetadas explicitamente.

---

#### L20 — Realtime usado apenas em `useLogistica` (1 hook em 29)

**Severidade**: 🟢 baixo (escolha arquitetural)
**Esforço**: nenhum (não é defeito)
**Local**: `apps/interno/src/hooks/useLogistica.ts:43`.

**Sugestão**: aceitar como é. Realtime adiciona complexidade; refetch manual via React Query é mais simples.

---

### 5.6 — Operação, banco, arquitetura

#### H15 — Sem observability em produção (Sentry, errors logados só em `console.error`)

**Severidade**: 🟠 alto
**Esforço**: médio (meio-dia)
**Local**: ausência. Erros caídos em `console.error` em todos os services. Em produção (Vercel), não há instrumentation.

**Risco**: bug em prod só descoberto se operador reportar. Inviável para auditoria post-mortem.

**Sugestão**: adicionar Sentry SDK (`@sentry/react`). Capturar via boundary global + manual capture em try/catch críticos. Configurar source maps no Vercel build. Resolver M11 (catch _error) + Sentry pavimenta o resto.

---

#### M26 — Boundary violations: pages importam `supabase` direto em vez de via service

**Severidade**: 🟡 médio
**Esforço**: pequeno (sweep)
**Local**: `pages/RelatorioFabrica.tsx:19,46-63`, `pages/Entregas.tsx:60,119`, `pages/Configuracoes.tsx:74,111,131,145-157`. Hooks `useEstoqueMetrics.ts`, `useIndicacoes.ts`, `useCatalogoPendentes.ts` também.

**Risco**: testes ficam com mock target ambíguo. Refactors em queries quebram o page indiretamente.

**Sugestão**: extrair para `services/configuracoesService.ts`, `services/logisticaService.ts` (já existe — mover query do Entregas.tsx pra lá), etc. Não fazer big-bang; fazer enquanto mexe na vizinhança.

---

#### M27 — `logisticaService.getLogisticsMetrics` retorna `entregasRealizadasTotal: 0` hardcoded

**Severidade**: 🟡 médio
**Esforço**: trivial
**Local**: `apps/interno/src/services/logisticaService.ts:42`.

```ts
return {
    entregasPendentesTotal: pendingCount || 0,
    entregasRealizadasHoje: doneTodayCount || 0,
    entregasRealizadasTotal: 0,           // <-- nunca calculado
    taxaEntregaHoje: Math.round(rate)
}
```

Também filtro redundante na L17-18: `.eq('status', 'pendente').neq('status', 'cancelada')` — o `neq` é supérfluo.

**Risco**: campo `entregasRealizadasTotal` consumido em algum widget mostra sempre 0. Ou é dead field (verificar consumo).

**Sugestão**: ou calcular via query separada, ou remover do retorno e da interface se não é usado.

---

#### L21 — Migrations sem down/.down.sql

**Severidade**: 🟢 baixo
**Esforço**: nenhum (limitação Supabase)
**Local**: `supabase/migrations/`.

**Sugestão**: aceitar.

---

#### L22 — RPCs sem `COMMENT ON FUNCTION` (documentação)

**Severidade**: 🟢 baixo
**Esforço**: pequeno
**Local**: 12 RPCs em produção.

**Sugestão**: adicionar comentários breves descrevendo intent e parâmetros. Faz junto de qualquer mudança em RPC.

---

#### L23 — Possíveis RPCs órfãs / abandonadas

**Severidade**: 🟢 baixo
**Esforço**: pequeno (verificação)
**Local**: `rpc_total_a_receber_simples` (`remote_schema.sql:937`), `rpt_churn` (L952), `rpt_vendas_por_periodo` (L978), `receive_purchase_order` (L610) — não chamadas em `apps/interno/src`. Talvez chamadas pelo `apps/catalogo` ou em SQL ad-hoc.

**Sugestão**: grep em `apps/catalogo` antes de DROP.

---

#### L24 — Inconsistência: services em classe (`ContatoService`, `ProdutoService`, `RelacionamentoService`) vs object literal (8 outros)

**Severidade**: 🟢 baixo
**Esforço**: trivial (escolha)
**Local**: `services/`.

**Sugestão**: padronizar como object literal (mais idiomático em TS quando não há `this`-state). Renomear classes para const literais ao mexer.

---

#### L25 — `ContatoService.func()` — método com nome `func`

**Severidade**: 🟢 baixo
**Esforço**: pequeno (renomear + buscar uses)
**Local**: `apps/interno/src/services/contatoService.ts:12` + `useContatos.ts:20,85`.

**Sugestão**: renomear para `list(query, tipo, status)` ou `getAll`. Sweep em consumers.

---

#### L26 — Duas pastas de testes coexistem; `environment: jsdom` em integration tests

**Severidade**: 🟢 baixo
**Esforço**: pequeno
**Local**: `apps/interno/src/__tests__/` + `apps/interno/tests/integration/`. `vite.config.ts:57` aplica jsdom global.

**Sugestão**: mover tudo para `apps/interno/src/__tests__/` (consistente com `services/__tests__/` adjacente). Em `vite.config.ts`, configurar `environmentMatchGlobs` para usar `node` em integration tests.

---

#### L27 — `apps/interno/.env.example` com configs legacy AIOS (DeepSeek, ClickUp, N8N, Sentry, Railway)

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/.env.example:1-102`.

**Risco**: confunde novo dev. Sugere integrações que não existem.

**Sugestão**: substituir conteúdo por:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

#### L28 — Código morto identificado

**Severidade**: 🟢 baixo
**Esforço**: trivial cada
**Itens**:
- `types/domain.ts:231-260` — `VendaComItens`, `PurchaseOrderWithItems` (substituídos por Domain*).
- `types/domain.ts:22` — valor `'catalogo'` em `tipo` (≡ M8).
- `types/domain.ts:52` — `preco_ancoragem` snake (≡ H5).
- `apps/interno/src/scripts/` — pasta exposta ao build (precisa investigar conteúdo; achado F1-G).

**Sugestão**: deletar `VendaComItens` e `PurchaseOrderWithItems` se grep confirmar zero referências. Investigar `src/scripts/`.

---

#### L29 — `produtoService.uploadImage`: imagem antiga pode ficar órfã se chamadas saem fora de ordem

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: `apps/interno/src/services/produtoService.ts:128-156`.

**Sugestão**: aceitar como é; storage cleanup periódico.

---

#### L30 — Histórico do git contém `.claude/settings.local.json` (untrackeado mas histórico permanece)

**Severidade**: 🟢 baixo
**Esforço**: pequeno (BFG/filter-branch) ou trivial (aceitar)
**Local**: histórico do git (achado pré-existente).

**Sugestão**: aceitar — settings.local.json não vaza secrets críticos. Se preocupado, BFG-rewrite de history em sessão dedicada.

---

#### L31 — ESLint config minimalista (sem `eslint-plugin-import`, sem custom rules)

**Severidade**: 🟢 baixo
**Esforço**: pequeno
**Local**: `apps/interno/eslint.config.js:8-23`.

**Sugestão**: adicionar `eslint-plugin-import` para detectar imports circulares e ordenação. Adicionar `no-unused-modules`.

---

#### L1 — Arquivos órfãos: `apps/interno/tsc-error.txt`, `apps/interno/types-append.txt`

**Severidade**: 🟢 baixo
**Esforço**: trivial
**Local**: raiz de `apps/interno/`.

**Sugestão**: `git rm tsc-error.txt types-append.txt` se de fato órfãos.

---

#### L2 — `apps/interno/src/scripts/` exposto ao build do app

**Severidade**: 🟢 baixo
**Esforço**: pequeno
**Local**: pasta `src/scripts/` (conteúdo não inspecionado).

**Sugestão**: inspecionar conteúdo. Se forem utilitários de seed/dev-only, mover para `apps/interno/scripts/` (fora de `src/`) ou adicionar exclusão no `tsconfig.app.json`.

---

## 6. Apêndice — Findings rejeitados ou mesclados

A rastreabilidade completa (cada um dos 96 raw findings → cataloged ID, mesclado, ou rejeitado com motivo) está em [`brownfield.md` — seção Fase 3](./brownfield.md).

**Rejeitados (8)**: F1-H, F1-I, F2.1-M, F2.2-B, F2.2-I, F2.4-K, F2.5-G, F2.6-K — informações positivas, meta-observações, ou inventário sem defeito.

**Mesclados (12)**: F1-A→L26, F1-B→L1, F1-D→M4, F1-E→M6, F1-F→L20, F2.2-H→M7, F2.4-J→H13, F2.5-C→H6+H10, F2.5-F→L19, F2.6-B→M11, F2.6-C→H2, F2.6-Q→H11.
