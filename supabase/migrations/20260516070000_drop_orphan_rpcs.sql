-- Remove RPCs órfãs sem chamadores no monorepo.
-- EXECUTE de anon/authenticated já foi revogado na Onda 1 (20260515070200).
-- Pre-flight grep confirmou zero chamadas .rpc() em apps/ e packages/.
-- Matches encontrados apenas em packages/shared/src/database.ts (linhas 1996, 1997, 2009)
-- são declarações de tipo auto-geradas pelo `supabase gen types` quando as RPCs ainda existiam.
-- Regeneração dos tipos será feita em ciclo separado via:
--   supabase gen types typescript --linked > packages/shared/src/database.ts

DROP FUNCTION IF EXISTS public.rpc_total_a_receber_simples();
DROP FUNCTION IF EXISTS public.rpt_churn(integer);
DROP FUNCTION IF EXISTS public.rpt_vendas_por_periodo(date, date, text);
