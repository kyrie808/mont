-- Adiciona conta_id explícito em pagamentos_venda + propaga p_conta_id na RPC.
-- Aditiva/reversível, zero toque em dados existentes. A conta já era rastreável
-- via lancamentos; isto torna o vínculo pagamento↔conta 1:1 explícito (robusto
-- para pagamentos parciais e para a futura página de histórico de pagamentos).
-- Backup: dump-{schema,data}-20260622-014043.sql

ALTER TABLE public.pagamentos_venda
  ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES public.contas(id);

-- Índice de cobertura da nova FK (default de performance do projeto).
CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_conta_id
  ON public.pagamentos_venda(conta_id);

-- RPC: grava conta_id também no pagamento (o lançamento já recebia p_conta_id).
-- Mantida idêntica à versão atual exceto pela coluna conta_id no INSERT.
CREATE OR REPLACE FUNCTION public.registrar_pagamento_venda(
    p_venda_id uuid,
    p_valor numeric,
    p_metodo text,
    p_data date,
    p_conta_id uuid,
    p_observacao text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_plano_id      uuid;
    v_lancamento_id uuid;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

    -- 1. Registra o pagamento -- trigger trigger_update_venda_pagamento dispara
    --    automaticamente e recalcula vendas.valor_pago e vendas.pago
    INSERT INTO public.pagamentos_venda (venda_id, valor, data, metodo, observacao, conta_id)
    VALUES (p_venda_id, p_valor, p_data::timestamptz, p_metodo, p_observacao, p_conta_id);

    -- 2. Lookup do plano de contas por codigo tecnico imutavel
    SELECT id INTO v_plano_id
    FROM public.plano_de_contas
    WHERE codigo = 'RECEBIMENTO_VENDA'
    LIMIT 1;

    -- 3. Cria lancamento no fluxo de caixa
    INSERT INTO public.lancamentos (
        data, descricao, valor, tipo, conta_id, plano_conta_id, venda_id, origem
    ) VALUES (
        p_data,
        CASE
            WHEN p_metodo IS NOT NULL THEN 'Pagamento venda - ' || p_metodo
            ELSE 'Recebimento de venda'
        END,
        p_valor,
        'entrada',
        p_conta_id,
        v_plano_id,
        p_venda_id,
        'venda'
    )
    RETURNING id INTO v_lancamento_id;

    RETURN v_lancamento_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';
