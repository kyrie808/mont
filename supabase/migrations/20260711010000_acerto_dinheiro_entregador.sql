-- Stage 2d — Acerto do dinheiro da Mont recolhido pelo entregador.
--
-- Fecha a reconciliação: o admin confirma "a Mont recebeu de volta o dinheiro
-- que o entregador coletou do cliente". Com isso o "dinheiro em mãos" fica
-- correto (sobe no recolher, zera no acerto) e separa o dinheiro DELE (repasse)
-- do dinheiro da MONT (recolhido).
-- Backup: dump-schema/-data-20260711 (acerto_dinheiro).

-- 1. Marcador do acerto (quando a Mont recebeu o dinheiro de volta do entregador).
ALTER TABLE public.vendas
    ADD COLUMN IF NOT EXISTS dinheiro_acertado_em timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. entregador_minhas_entregas: + valor_recebido (o que ele recolheu) +
--    dinheiro_acertado_em (pra o app calcular "em mãos" = recolhido não acertado).
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
    ORDER BY COALESCE(v.data_entrega, v.data) ASC, v.criado_em ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_minhas_entregas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_minhas_entregas() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_extrato_entregadores: dinheiro_coletado passa a contar só o NÃO acertado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_extrato_entregadores(p_inicio date, p_fim date)
 RETURNS TABLE (
    entregador_id       uuid,
    nome                text,
    repasse_por_entrega numeric,
    entregas            bigint,
    devido              numeric,
    pago                numeric,
    dinheiro_coletado   numeric,
    saldo_repasse       numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.nome,
        e.repasse_por_entrega,
        COALESCE(ent.cnt, 0) AS entregas,
        COALESCE(ent.cnt, 0)::numeric * e.repasse_por_entrega AS devido,
        COALESCE(pg.total, 0) AS pago,
        COALESCE(col.total, 0) AS dinheiro_coletado,
        (COALESCE(ent.cnt, 0)::numeric * e.repasse_por_entrega) - COALESCE(pg.total, 0) AS saldo_repasse
    FROM public.entregadores e
    LEFT JOIN LATERAL (
        SELECT count(*) AS cnt
        FROM public.vendas v
        WHERE v.entregador_id = e.id
          AND v.status = 'entregue'
          AND COALESCE(v.data_entrega, v.data) BETWEEN p_inicio AND p_fim
    ) ent ON true
    LEFT JOIN LATERAL (
        SELECT COALESCE(sum(l.valor), 0) AS total
        FROM public.lancamentos l
        WHERE l.entregador_id = e.id
          AND l.tipo = 'saida'
          AND l.data BETWEEN p_inicio AND p_fim
    ) pg ON true
    LEFT JOIN LATERAL (
        SELECT COALESCE(sum(v.total), 0) AS total
        FROM public.vendas v
        WHERE v.recebido_por_entregador_id = e.id
          AND v.dinheiro_acertado_em IS NULL
          AND v.recebido_em::date BETWEEN p_inicio AND p_fim
    ) col ON true
    WHERE e.ativo = true
    ORDER BY e.nome;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_extrato_entregadores(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_extrato_entregadores(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
