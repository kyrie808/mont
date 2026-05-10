-- ============================================================
-- Onda 1 — H1: cleanup de artefatos do backfill de contatos.nome
-- ============================================================
-- Contexto:
--   A migration 20260423224225_backfill_contatos_nome.sql criou:
--     - tabela `backfill_contatos_nome_log` (sem RLS, com PII)
--     - funcao `fn_backfill_contatos_nome()` SECURITY DEFINER
--     - snapshots `_backup_contatos_nome_<timestamp>` a cada apply
--   O backfill ja rodou em prod (2026-04-24). Os artefatos cumpriram
--   o papel e agora sao apenas vetores de exposicao de PII (nome,
--   telefone) sem RLS.
--
-- Acao:
--   - Drop de TODAS as tabelas snapshot `_backup_contatos_nome_*`.
--   - Drop da tabela de log.
--   - Drop da funcao SECURITY DEFINER.
--
-- Resolve advisor lints:
--   - rls_disabled_in_public (2)
--   - anon_security_definer_function_executable (fn_backfill_contatos_nome)
--   - authenticated_security_definer_function_executable (idem)
-- ============================================================

DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE '\_backup\_contatos\_nome\_%' ESCAPE '\'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I', t.tablename);
    END LOOP;
END $$;

DROP TABLE IF EXISTS public.backfill_contatos_nome_log;

DROP FUNCTION IF EXISTS public.fn_backfill_contatos_nome();
