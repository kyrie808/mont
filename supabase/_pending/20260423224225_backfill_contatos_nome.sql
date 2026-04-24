-- ============================================================
-- BACKFILL: contatos.nome usando cat_pedidos.nome_cliente
-- Politica: atualiza se o nome candidato tem mais palavras.
-- Inclui snapshot para rollback.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.backfill_contatos_nome_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_table_name text NOT NULL,
    total_snapshot int NOT NULL,
    total_atualizados int NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION public.fn_backfill_contatos_nome()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    snapshot_name text := '_backup_contatos_nome_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
    total_snapshot int := 0;
    total_atualizados int := 0;
BEGIN
    EXECUTE format(
        'CREATE TABLE %I AS
         SELECT id, nome AS nome_antes, telefone, now() AS snapshot_em
         FROM contatos',
        snapshot_name
    );

    GET DIAGNOSTICS total_snapshot = ROW_COUNT;

    WITH candidatos AS (
        SELECT DISTINCT ON (c.id)
            c.id AS contato_id,
            cp.nome_cliente AS nome_candidato
        FROM contatos c
        INNER JOIN cat_pedidos cp ON cp.contato_id = c.id
        ORDER BY c.id, fn_count_words(cp.nome_cliente) DESC, cp.criado_em DESC
    ),
    atualizados AS (
        UPDATE contatos
        SET nome = fn_capitalize_name(cand.nome_candidato)
        FROM candidatos cand
        WHERE contatos.id = cand.contato_id
          AND fn_count_words(cand.nome_candidato) > fn_count_words(contatos.nome)
        RETURNING contatos.id
    )
    SELECT count(*) INTO total_atualizados FROM atualizados;

    INSERT INTO backfill_contatos_nome_log (snapshot_table_name, total_snapshot, total_atualizados)
    VALUES (snapshot_name, total_snapshot, total_atualizados);

    RAISE NOTICE 'Snapshot criado: %', snapshot_name;
    RAISE NOTICE 'Backfill concluido. Linhas atualizadas: %', total_atualizados;

    RETURN jsonb_build_object(
        'snapshot_table_name', snapshot_name,
        'total_snapshot', total_snapshot,
        'total_atualizados', total_atualizados
    );
END;
$$;


SELECT public.fn_backfill_contatos_nome();
