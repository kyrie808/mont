# H-2 Baseline — Comportamento Atual das RPCs (Pré-Hardening)

**Data:** 2026-05-19  
**Propósito:** Capturar comportamento de produção ANTES de qualquer guard ser aplicado. Serve como baseline de regressão para H-3..H-6.  
**Endpoint base:** `https://herlvujykltxnwqmwmyx.supabase.co/rest/v1/rpc/`  
**Total de chamadas:** 33 (11 RPCs × 3 roles)

---

## Contexto: Achado proacl

Todas as 11 RPCs são `SECURITY DEFINER`. ACLs obtidas via `pg_proc.proacl`:

| RPC | anon EXECUTE | authenticated EXECUTE |
|---|---|---|
| registrar_pagamento_venda | ❌ | ✅ |
| registrar_pagamento_conta_a_pagar | ❌ | ✅ |
| criar_obrigacao_parcelada | ❌ | ✅ |
| update_purchase_order_with_items | ❌ | ✅ |
| registrar_despesa_manual | ❌ | ✅ |
| registrar_entrada_manual | ❌ | ✅ |
| add_image_reference | ❌ | ✅ |
| delete_image_reference | ❌ | ✅ |
| is_admin | ❌ | ✅ |
| rpc_total_a_receber_dashboard | ❌ | ✅ |
| criar_pedido | ✅ (PUBLIC) | ✅ |

**Consequência:** Qualquer usuário `authenticated` (admin ou não-admin) tem `EXECUTE` nas 11 RPCs. Não há guard interno nas funções que verifique `is_admin()` antes de executar. Este é o gap que Hardening fecha.

---

## Tier 1 — RPCs Financeiras 🔴

### RPC: registrar_pagamento_venda

- **Assinatura:** `p_venda_id uuid, p_valor numeric, p_metodo text, p_data date, p_conta_id uuid, p_observacao text DEFAULT NULL`
- **Payload usado:** `{"p_venda_id":"ffd2c50b-...", "p_valor":1.00, "p_metodo":"pix", "p_data":"2026-05-19", "p_conta_id":"ceed4504-..."}`
- **Efeito colateral:** Insere em `pagamentos_venda` + `lancamentos` (tipo=entrada). Trigger atualiza `vendas.valor_pago` e `contas.saldo_atual`.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_pagamento_venda"}` | ✅ bloqueado |
| authenticated não-admin | 200 | `"b158b5e5-c151-4045-95a3-5fd07202b56f"` (lancamento_id) | ⚠️ executou |
| admin | 200 | `"e2c5ed4a-5e05-49cf-b274-8fda0e304b97"` (lancamento_id) | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 200 (mantém) |

---

### RPC: registrar_pagamento_conta_a_pagar

- **Assinatura:** `p_conta_a_pagar_id uuid, p_valor numeric, p_data_pagamento date, p_conta_id uuid, p_metodo_pagamento text DEFAULT 'pix', p_observacao text DEFAULT NULL, p_conta_credor_id uuid DEFAULT NULL`
- **Payload usado:** `{"p_conta_a_pagar_id":"41723fda-...", "p_valor":1.00, "p_data_pagamento":"2026-05-19", "p_conta_id":"ceed4504-..."}`
- **Efeito colateral:** Insere em `pagamentos_conta_a_pagar` + `lancamentos` (tipo=saida). Trigger recalcula `contas_a_pagar.status` e `contas.saldo_atual`.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_pagamento_conta_a_pagar"}` | ✅ bloqueado |
| authenticated não-admin | 200 | `"9000db2d-1f63-4700-9c7a-5c6cafb0428a"` (lancamento_id) | ⚠️ executou |
| admin | 200 | `"5fcddb7b-c370-4c00-8356-a8556ca355e9"` (lancamento_id) | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 200 (mantém) |

---

### RPC: criar_obrigacao_parcelada

- **Assinatura:** `p_descricao text, p_credor text, p_valor_total numeric, p_data_vencimento date, p_plano_conta_id uuid, p_total_parcelas integer DEFAULT 1, p_referencia text DEFAULT NULL, p_observacao text DEFAULT NULL`
- **Payload usado:** `{"p_descricao":"Teste H2 Baseline Obrigacao","p_credor":"Credor H2 Test","p_valor_total":10.00,"p_data_vencimento":"2026-12-31","p_plano_conta_id":"cdebbbd0-..."}`
- **Efeito colateral:** Cria registros em `contas_a_pagar` (1 por parcela).

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function criar_obrigacao_parcelada"}` | ✅ bloqueado |
| authenticated não-admin | 200 | `["44df9e97-f32c-44a5-a2e2-ecc01ea0f605"]` | ⚠️ executou |
| admin | 200 | `["70b2c954-6c70-46f5-baee-c7e982afb299"]` | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 200 (mantém) |

---

### RPC: update_purchase_order_with_items

- **Assinatura:** `p_order_id uuid, p_fornecedor_id uuid, p_order_date date, p_total_amount numeric, p_notes text, p_status text, p_payment_status text, p_items jsonb`
- **Payload usado:** `{"p_order_id":"cae2a55f-...","p_fornecedor_id":"63040302-...","p_order_date":"2026-05-19","p_total_amount":50.00,"p_notes":"__h2_baseline_test__","p_status":"pending","p_payment_status":"unpaid","p_items":[]}`
- **Efeito colateral:** UPDATE em `purchase_orders` + DELETE/INSERT em `purchase_order_items`.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function update_purchase_order_with_items"}` | ✅ bloqueado |
| authenticated não-admin | 204 | (sem body) | ⚠️ executou |
| admin | 204 | (sem body) | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 204 (mantém) |

---

### RPC: registrar_despesa_manual

- **Assinatura:** `p_valor numeric, p_descricao text, p_data date, p_conta_id uuid, p_plano_conta_id uuid`
- **Payload usado:** `{"p_valor":1.00,"p_descricao":"__h2_baseline_test__ despesa","p_data":"2026-05-19","p_conta_id":"ceed4504-...","p_plano_conta_id":"cdebbbd0-..."}`
- **Efeito colateral:** Insere em `lancamentos` (tipo=saida). Trigger atualiza `contas.saldo_atual`.
- **Validações internas:** plano_conta deve ser tipo=despesa, automatica=false; data não pode ser futura.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_despesa_manual"}` | ✅ bloqueado |
| authenticated não-admin | 200 | `"4c96cff4-aadc-4ca3-b972-c16351f0ece1"` (lancamento_id) | ⚠️ executou |
| admin | 200 | `"46f486f8-1b23-48db-8435-86f0228558db"` (lancamento_id) | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 200 (mantém) |

---

### RPC: registrar_entrada_manual

- **Assinatura:** `p_valor numeric, p_descricao text, p_data date, p_conta_id uuid, p_plano_conta_id uuid`
- **Payload usado:** `{"p_valor":1.00,"p_descricao":"__h2_baseline_test__ entrada","p_data":"2026-05-19","p_conta_id":"ceed4504-...","p_plano_conta_id":"71a602aa-..."}`
- **Efeito colateral:** Insere em `lancamentos` (tipo=entrada). Trigger atualiza `contas.saldo_atual`.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function registrar_entrada_manual"}` | ✅ bloqueado |
| authenticated não-admin | 200 | `"5c3f3171-cc4f-4011-a410-b97a4aaa1ea5"` (lancamento_id) | ⚠️ executou |
| admin | 200 | `"0ac3b5c9-eaa0-4971-8bfa-0a8c080afc68"` (lancamento_id) | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 200 (mantém) |

---

## Tier 2 — RPCs SECDEF Não-Financeiras

### RPC: add_image_reference

- **Assinatura:** `p_produto_id uuid, p_url text`
- **Payload usado:** `{"p_produto_id":"d8095cfc-...","p_url":"https://example.com/__h2_baseline_test__"}`
- **Efeito colateral:** DELETE + INSERT em `sis_imagens_produto` e `cat_imagens_produto` (replace atômico).

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function add_image_reference"}` | ✅ bloqueado |
| authenticated não-admin | 204 | (sem body) | ⚠️ executou — substituiu imagem real |
| admin | 204 | (sem body) | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 204 (mantém) |

---

### RPC: delete_image_reference

- **Assinatura:** `p_produto_id uuid`
- **Payload usado:** `{"p_produto_id":"d8095cfc-..."}`
- **Efeito colateral:** DELETE em `sis_imagens_produto` e `cat_imagens_produto` para o produto.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function delete_image_reference"}` | ✅ bloqueado |
| authenticated não-admin | 204 | (sem body) | ⚠️ executou — deletou imagens |
| admin | 204 | (sem body) | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 204 (mantém) |

---

### RPC: is_admin

- **Assinatura:** `check_user_id uuid DEFAULT auth.uid()`
- **Payload usado:** `{}`
- **Efeito colateral:** Nenhum (read-only). Retorna boolean.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function is_admin"}` | ✅ bloqueado |
| authenticated não-admin | 200 | `false` | ✅ correto — função é o mecanismo de check, não o problema |
| admin | 200 | `true` | ✅ esperado |

> **Nota:** `is_admin` funciona corretamente — retorna `false` para não-admin e `true` para admin. O problema é que as **outras** RPCs não chamam `is_admin()` antes de executar.

**Comportamento esperado pós-Hardening:** sem alteração necessária para esta RPC.

---

### RPC: rpc_total_a_receber_dashboard

- **Assinatura:** `(sem parâmetros)`
- **Payload usado:** `{}`
- **Efeito colateral:** Nenhum (read-only). Retorna agregado financeiro.

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 401 | `{"code":"42501","message":"permission denied for function rpc_total_a_receber_dashboard"}` | ✅ bloqueado |
| authenticated não-admin | 200 | `{"total_a_receber":7680.00,"total_vendas_abertas":119}` | ⚠️ expõe dados financeiros reais |
| admin | 200 | `{"total_a_receber":7680.00,"total_vendas_abertas":119}` | ✅ esperado |

**Comportamento esperado pós-Hardening:**
| Role | Status esperado |
|---|---|
| anon | 401 (mantém) |
| authenticated não-admin | 403 / permission denied |
| admin | 200 (mantém) |

---

### RPC: criar_pedido

- **Assinatura:** `p_nome_cliente text, p_telefone_cliente text, p_endereco_entrega text, p_metodo_entrega text, p_metodo_pagamento text, p_subtotal numeric, p_frete numeric, p_total numeric, p_observacoes text DEFAULT NULL, p_indicado_por text DEFAULT NULL, p_itens jsonb DEFAULT '[]', p_cep text DEFAULT NULL, ...`
- **Payload usado:** `{"p_nome_cliente":"Teste H2 Baseline","p_telefone_cliente":"11999999999","p_endereco_entrega":"Rua Teste H2, 0","p_metodo_entrega":"retirada","p_metodo_pagamento":"pix","p_subtotal":10.00,"p_frete":0.00,"p_total":10.00,"p_observacoes":"__h2_baseline_test__","p_itens":[]}`
- **Efeito colateral:** Cria `cat_pedidos` + trigger `fn_sync_cat_pedido_to_venda` cria `vendas`. Com itens vazios: sem `cat_itens_pedido` / `itens_venda`.
- **proacl:** `=X/postgres` — PUBLIC tem EXECUTE (endpoint público intencional do catálogo).

| Role | Status HTTP | Body (resumo) | Comportamento |
|---|---|---|---|
| anon | 200 | `{"id":"e98b6c4c-...","total":10.00,"status":"pendente","numero_pedido":59}` | ✅ acesso público intencional |
| authenticated não-admin | 200 | `{"id":"b3f10045-...","total":10.00,"status":"pendente","numero_pedido":61}` | ✅ esperado (público) |
| admin | 200 | `{"id":"33768711-...","total":10.00,"status":"pendente","numero_pedido":60}` | ✅ esperado |

> **Nota:** `criar_pedido` é a única RPC com acesso anon intencional. Baseline confirma comportamento correto — não requer Hardening nesta RPC.

**Comportamento esperado pós-Hardening:** sem alteração.

---

## Resumo Executivo

### Tier 1 — RPCs Financeiras 🔴

**6/6 RPCs retornaram HTTP 200 para authenticated não-admin.** Todas as operações financeiras críticas são executáveis por qualquer usuário autenticado sem validação de role.

| RPC | anon | não-admin (ATUAL) | admin |
|---|---|---|---|
| registrar_pagamento_venda | 401 ✅ | **200 ⚠️** | 200 ✅ |
| registrar_pagamento_conta_a_pagar | 401 ✅ | **200 ⚠️** | 200 ✅ |
| criar_obrigacao_parcelada | 401 ✅ | **200 ⚠️** | 200 ✅ |
| update_purchase_order_with_items | 401 ✅ | **204 ⚠️** | 204 ✅ |
| registrar_despesa_manual | 401 ✅ | **200 ⚠️** | 200 ✅ |
| registrar_entrada_manual | 401 ✅ | **200 ⚠️** | 200 ✅ |

### Tier 2 — RPCs SECDEF Não-Financeiras

| RPC | anon | não-admin (ATUAL) | admin | Requer fix |
|---|---|---|---|---|
| add_image_reference | 401 ✅ | **204 ⚠️** | 204 ✅ | Sim |
| delete_image_reference | 401 ✅ | **204 ⚠️** | 204 ✅ | Sim |
| is_admin | 401 ✅ | 200 ✅ (false) | 200 ✅ (true) | Não |
| rpc_total_a_receber_dashboard | 401 ✅ | **200 ⚠️** (dados reais) | 200 ✅ | Sim |
| criar_pedido | 200 ✅ (público) | 200 ✅ (público) | 200 ✅ | Não |

**RPCs que requerem guard:** 9 de 11 (exceto `is_admin` e `criar_pedido`).

---

## Cleanup

**Executado em:** 2026-05-19

| Tabela | Registros deletados |
|---|---|
| lancamentos | 8 (4 despesa/entrada manual × 2 roles + 2 pagamento_venda + 2 pagamento_cap) |
| pagamentos_venda | 2 (nonadmin + admin na venda de teste) |
| pagamentos_conta_a_pagar | 2 (nonadmin + admin na cap de teste) |
| itens_venda | 0 (itens vazios em todos os pedidos) |
| vendas | 4 (1 teste direto + 3 sintetizadas via trigger de criar_pedido) |
| cat_itens_pedido | 0 (itens vazios) |
| cat_pedidos | 3 (anon + nonadmin + admin) |
| contas_a_pagar | 3 (1 teste direto + 2 de criar_obrigacao_parcelada) |
| purchase_order_items | 0 |
| purchase_orders | 1 |

**Imagens Chipa 1kg:** restauradas em `sis_imagens_produto` e `cat_imagens_produto`.

**Saldo Pix (ceed4504):**
- Snapshot pré-teste: R$ 9.906,00
- Pós-cleanup: R$ 9.906,00 ✅
- Delta: R$ 0,00 (net das 4 entradas e 4 saídas de R$ 1,00 foi zero; trigger `tr_lancamentos_saldo` reverteu automaticamente ao deletar os lancamentos)

**Verificação zero registros:** ✅ todas as tabelas confirmadas com 0 registros de teste restantes.
