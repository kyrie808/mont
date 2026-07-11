-- Stage 2c — RPC do extrato de repasse (lado admin): por entregador e período,
-- devido (entregas × repasse) × pago (despesas de repasse) × dinheiro coletado
-- (informativo) × saldo (devido − pago). Guard is_admin.
-- Backup: dump-schema/-data-20260711 (admin_extrato).

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
          AND v.recebido_em::date BETWEEN p_inicio AND p_fim
    ) col ON true
    WHERE e.ativo = true
    ORDER BY e.nome;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_extrato_entregadores(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_extrato_entregadores(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
