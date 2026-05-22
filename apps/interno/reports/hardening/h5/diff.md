# H-5 Diff — Baseline → Pós-Apply

**Data:** 2026-05-22  
**Referência baseline:** baseline estabelecido em sessão pré-apply (2026-05-22T09:06)

## Transição da policy alvo

| Campo | Baseline | Pós H-5 | Transição |
|---|---|---|---|
| USING | `true` | `(SELECT is_admin())` | ✅ permissiva → restrita |
| WITH CHECK | `true` | `(SELECT is_admin())` | ✅ permissiva → restrita |

## Comportamento por role

| Role | Operação | Baseline | Pós H-5 | Transição |
|---|---|---|---|---|
| non-admin | UPDATE contatos | FK error (RLS passava, trigger falhava FK) | 0 rows (RLS bloqueia) | ✅ passava → bloqueado |
| admin | UPDATE contatos | N/A (testado pós-apply) | 1 row (admin passa) | ✅ |
| non-admin | SELECT contatos | retorna linha | retorna linha | ✅ inalterado |
| anon | INSERT contatos | permitido (policy public) | permitido (policy inalterada) | ✅ inalterado |

## Policies não alteradas

| policyname | cmd | Status |
|---|---|---|
| Admin full access | ALL | ✅ inalterada |
| Public insert access | INSERT | ✅ inalterada |
| Authenticated read access | SELECT | ✅ inalterada |

## Nota sobre baseline non-admin UPDATE

O baseline mostrou FK error (`contatos_updated_by_fkey`) em vez de 0 rows porque o UID simulado
(`aaaaaaaa-0000-0000-0000-000000000001`) não existe em `auth.users`. A RLS passou (USING: true),
o trigger `tr_contatos_audit` executou (`updated_by = auth.uid()`), e a FK rejeitou o UID inválido.
Um usuário real (com UID válido em `auth.users`) teria o UPDATE concluído com sucesso — vulnerabilidade confirmada.
Pós-apply: RLS bloqueia antes do trigger, zero FK errors.
