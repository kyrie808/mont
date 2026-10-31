-- ============================================================
-- Estoque: fn_ajusta_estoque_item deixa de ser executável pela API (29/10/2026)
--
-- Achado do advisor (lint 0028) durante 20261029211837_catalogo_fecha_escrita_publica:
-- fn_ajusta_estoque_item(produto, quantidade, sinal) é SECURITY DEFINER, não
-- tem guard is_admin e estava executável por PUBLIC/anon/authenticated. Com a
-- chave pública, qualquer um chamava /rest/v1/rpc/fn_ajusta_estoque_item e
-- mudava o estoque_atual de qualquer produto.
--
-- Por que escapou: 20260726210131_estoque_movimento_simetrico_revoke_execute
-- revogou fn_estoque_aplica_venda e fn_estoque_on_venda_delete, mas não esta
-- (criada antes, em 20260613042317_combo_stock_explosion).
--
-- Ninguém de fora chama a função: no monorepo não há nenhum .rpc() para ela
-- (só o tipo gerado em packages/shared/src/database.ts). Os chamadores são
-- fn_estoque_aplica_venda e fn_estoque_item_venda_entregue, ambas SECURITY
-- DEFINER do postgres — rodam como o dono, então o REVOKE não as afeta.
--
-- Rollback: supabase/rollbacks/20261030024933_estoque_revoke_ajusta_item.rollback.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.fn_ajusta_estoque_item(uuid, numeric, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_ajusta_estoque_item(uuid, numeric, integer)
  TO service_role;

NOTIFY pgrst, 'reload schema';
