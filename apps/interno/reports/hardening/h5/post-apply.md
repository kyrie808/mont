# H-5 Post-Apply — Role Test Results

**Data:** 2026-05-22  
**Migration:** `20260522090658_hardening_h5_contatos_update_admin_only.sql`  
**Apply method:** `npx supabase db push --linked`  
**Status:** ✅ SUCESSO — 4/4 testes passaram

## Policy alterada

```
tablename: contatos
policyname: Authenticated update access
cmd: UPDATE
roles: {authenticated}
```

| Campo | Antes (vulnerável) | Depois (hardened) |
|---|---|---|
| USING | `true` | `(SELECT is_admin())` |
| WITH CHECK | `true` | `(SELECT is_admin())` |

Confirmado via `pg_policies` pós-apply.

---

## Critério de sucesso

| Contexto | Operação | Esperado |
|---|---|---|
| non-admin | UPDATE contatos | 0 rows (RLS bloqueia) |
| admin | UPDATE contatos | 1 row (passa) |
| non-admin | SELECT contatos | 1 row (inalterado) |
| anon (public) | INSERT contatos | policy inalterada (verificado via pg_policies) |

---

## Resultados

### Teste 1 — non-admin UPDATE (bloqueado)

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';
UPDATE public.contatos SET nome = nome WHERE id = '63040302-54d5-4213-8b11-9e208e45174b' RETURNING id, nome;
ROLLBACK;
```

| Resultado | Esperado | Status |
|---|---|---|
| `[]` (0 rows) | 0 rows | ✅ |

RLS bloqueou antes do trigger `tr_contatos_audit` — sem FK error. Contrasta com baseline onde a mesma query causava FK error (passava RLS, falhava no trigger).

### Teste 2 — admin UPDATE (passa)

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "e9cbd39c-90ab-48c1-9a43-ed23eb64af4f", "role": "authenticated"}';
UPDATE public.contatos SET nome = nome WHERE id = '63040302-54d5-4213-8b11-9e208e45174b' RETURNING id, nome;
ROLLBACK;
```

| Resultado | Esperado | Status |
|---|---|---|
| `[{id, nome: "__TEST__Cliente"}]` (1 row) | 1 row | ✅ |

Admin (`is_admin()=true`) passou a policy. ROLLBACK — zero persistência.

### Teste 3 — non-admin SELECT (inalterado)

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT id, nome FROM public.contatos WHERE id = '63040302-54d5-4213-8b11-9e208e45174b';
ROLLBACK;
```

| Resultado | Esperado | Status |
|---|---|---|
| `[{id, nome: "__TEST__Cliente"}]` (1 row) | 1 row | ✅ |

Policy `Authenticated read access` (USING: true) não foi alterada — leitura inalterada.

### Teste 4 — anon INSERT (policy inalterada)

Verificado via `pg_policies` pós-apply:

```
policyname: Public insert access
cmd: INSERT
roles: {public}
with_check: true
```

Policy intacta — INSERT do catálogo (fluxo `criar_pedido`) não afetado. ✅

---

## Cleanup

Todos os testes usaram `ROLLBACK` explícito. Nenhum dado persistido. Contato `__TEST__Cliente` (`63040302-54d5-4213-8b11-9e208e45174b`) inalterado.

---

## Policies em contatos pós-apply (estado final)

| policyname | cmd | roles | qual | with_check |
|---|---|---|---|---|
| Admin full access | ALL | {authenticated} | (SELECT is_admin()) | (SELECT is_admin()) |
| Public insert access | INSERT | {public} | null | true |
| Authenticated read access | SELECT | {authenticated} | true | null |
| Authenticated update access | UPDATE | {authenticated} | **(SELECT is_admin())** | **(SELECT is_admin())** |
