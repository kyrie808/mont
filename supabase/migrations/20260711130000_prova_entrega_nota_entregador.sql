-- Feature #4 (Gilmar) — Observação da entrega escrita pelo ENTREGADOR.
--
-- Versão enxuta (decisão do Luccas): SEM foto/storage. Só um campo de texto
-- onde o Maurício declara algo na entrega ("deixei com o vizinho, portão X",
-- "cliente ausente"). Assinatura/RG ficam no recibo físico (offline).
--
-- ATENÇÃO: distinta de vendas.observacao_entregador, que é o campo do COMERCIAL
-- _para_ o entregador (instrução; ex.: "aguardar confirmação do pix"). Aqui é o
-- inverso — o entregador escreve o próprio registro. Colunas separadas de
-- propósito (não sobrescrever a instrução do comercial).
--
-- Backup: dump-{schema,data}-20260711 (nota_entregador).

-- 1. Coluna: a nota escrita pelo entregador.
ALTER TABLE public.vendas
    ADD COLUMN IF NOT EXISTS nota_entregador text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC de escrita do entregador — grava a própria nota. SECURITY DEFINER +
--    guard is_entregador() + posse da linha (mesma forma de marcar_entregue).
--    O entregador NUNCA escreve direto em vendas (RLS).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.entregador_salvar_nota(p_venda_id uuid, p_nota text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entregador_id uuid;
    v_status        text;
BEGIN
    IF NOT (SELECT public.is_entregador()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas entregadores' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_entregador_id
      FROM public.entregadores WHERE user_id = (SELECT auth.uid()) AND ativo = true;

    SELECT status INTO v_status
      FROM public.vendas
     WHERE id = p_venda_id AND entregador_id = v_entregador_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Entrega não encontrada ou não atribuída a você' USING ERRCODE = '42501';
    END IF;

    IF v_status = 'cancelada' THEN
        RAISE EXCEPTION 'Venda cancelada não aceita observação' USING ERRCODE = '22000';
    END IF;

    UPDATE public.vendas
       SET nota_entregador = NULLIF(btrim(p_nota), '')
     WHERE id = p_venda_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_salvar_nota(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_salvar_nota(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. entregador_minhas_entregas: + nota_entregador. Recreate a partir da versão
--    canônica atual (Stage 2d), preservando valor_recebido/dinheiro_acertado_em.
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
    ORDER BY COALESCE(v.data_entrega, v.data) ASC, v.criado_em ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.entregador_minhas_entregas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.entregador_minhas_entregas() TO authenticated;

NOTIFY pgrst, 'reload schema';
