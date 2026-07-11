-- Feature #1 (Gilmar) — Ordenar a sequência da rota pelo ENTREGADOR.
--
-- O Maurício arruma no app a ordem em que vai rodar as entregas (1ª, 2ª, 3ª…),
-- arrastando os cards. A ordem persiste em vendas.ordem_rota e a listagem do
-- entregador passa a respeitá-la (nulls last → não-ordenadas caem por data).
--
-- Backup: dump-{schema,data}-20260711 (ordenar_rota).

-- 1. Coluna de ordem manual da rota (null = sem ordem → por data).
ALTER TABLE public.vendas
    ADD COLUMN IF NOT EXISTS ordem_rota integer;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: o entregador reordena a própria rota. Recebe os ids NA ORDEM desejada
--    e grava ordem_rota = posição. SECURITY DEFINER + guard is_entregador +
--    valida que TODAS as vendas são dele e não canceladas (senão RAISE).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entregador_reordenar_rota(p_venda_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entregador_id uuid;
    v_validas       integer;
BEGIN
    IF NOT (SELECT public.is_entregador()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas entregadores' USING ERRCODE = '42501';
    END IF;

    IF p_venda_ids IS NULL OR array_length(p_venda_ids, 1) IS NULL THEN
        RETURN; -- nada a fazer
    END IF;

    SELECT id INTO v_entregador_id
      FROM public.entregadores WHERE user_id = (SELECT auth.uid()) AND ativo = true;

    -- Todas as vendas precisam ser dele e não canceladas.
    SELECT count(*) INTO v_validas
      FROM unnest(p_venda_ids) AS x(id)
      JOIN public.vendas v ON v.id = x.id
     WHERE v.entregador_id = v_entregador_id
       AND v.status <> 'cancelada';

    IF v_validas <> array_length(p_venda_ids, 1) THEN
        RAISE EXCEPTION 'Entrega inválida ou não atribuída a você' USING ERRCODE = '42501';
    END IF;

    UPDATE public.vendas v
       SET ordem_rota = x.ord
      FROM unnest(p_venda_ids) WITH ORDINALITY AS x(id, ord)
     WHERE v.id = x.id
       AND v.entregador_id = v_entregador_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_reordenar_rota(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_reordenar_rota(uuid[]) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. entregador_minhas_entregas: ordena por ordem_rota (nulls last). Recreate a
--    partir da versão pós-#4 (preserva nota_entregador/valor_recebido/acertado).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.entregador_minhas_entregas();
CREATE FUNCTION public.entregador_minhas_entregas()
 RETURNS TABLE (
    venda_id             uuid,
    data                 date,
    status_entrega       text,
    estado_pagamento     text,
    taxa_entrega         numeric,
    valor_a_receber      numeric,
    valor_recebido       numeric,
    dinheiro_acertado_em timestamptz,
    repasse              numeric,
    observacao_entregador text,
    nota_entregador      text,
    recebido_em          timestamptz,
    cliente_nome         text,
    cliente_apelido      text,
    cliente_telefone     text,
    endereco             text,
    logradouro           text,
    numero               text,
    complemento          text,
    bairro               text,
    cidade               text,
    uf                   text,
    cep                  text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entregador_id uuid;
    v_repasse       numeric;
BEGIN
    IF NOT (SELECT public.is_entregador()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas entregadores' USING ERRCODE = '42501';
    END IF;

    SELECT e.id, e.repasse_por_entrega
      INTO v_entregador_id, v_repasse
      FROM public.entregadores e
     WHERE e.user_id = (SELECT auth.uid()) AND e.ativo = true;

    RETURN QUERY
    SELECT
        v.id,
        COALESCE(v.data_entrega, v.data),
        v.status,
        CASE
            WHEN v.dinheiro_na_entrega = true AND v.pago = false THEN 'receber_na_entrega'
            ELSE 'so_entregar'
        END,
        COALESCE(v.taxa_entrega, 0),
        GREATEST(v.total - COALESCE(v.valor_pago, 0), 0),
        CASE WHEN v.recebido_em IS NOT NULL THEN v.total ELSE 0 END,
        v.dinheiro_acertado_em,
        v_repasse,
        v.observacao_entregador,
        v.nota_entregador,
        v.recebido_em,
        c.nome,
        c.apelido,
        c.telefone,
        c.endereco,
        c.logradouro,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.uf,
        c.cep
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    WHERE v.entregador_id = v_entregador_id
      AND v.status <> 'cancelada'
    ORDER BY v.ordem_rota ASC NULLS LAST, COALESCE(v.data_entrega, v.data) ASC, v.criado_em ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_minhas_entregas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_minhas_entregas() TO authenticated;

NOTIFY pgrst, 'reload schema';
