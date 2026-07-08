-- Reconciliação de saldos: permite calibrar o saldo do sistema para o saldo REAL
-- (InfinityPay / Pessoal-Gilmar / Caixa) via um LANÇAMENTO DE AJUSTE — nunca escrevendo
-- saldo_atual na mão (Regra #3). O trigger tr_lancamentos_saldo leva o saldo_atual ao real.
--
-- Aditiva/reversível. Backup: dump-*-20260704-175624.

-- 1) origem 'ajuste' passa a ser válida em lancamentos.
ALTER TABLE public.lancamentos DROP CONSTRAINT IF EXISTS chk_lancamentos_origem;
ALTER TABLE public.lancamentos ADD CONSTRAINT chk_lancamentos_origem
    CHECK (origem = ANY (ARRAY['manual','venda','brinde','migracao_historica','transferencia','contas_a_pagar','ajuste']));

-- 2) Categoria reservada do ajuste. automatica=true → NÃO aparece nos seletores de categoria
--    (getPlanoDeContas filtra automatica=false) nem aceita lançamento manual; usada só pela RPC.
INSERT INTO public.plano_de_contas (nome, tipo, categoria, ativo, automatica, codigo)
SELECT 'Ajuste de Saldo', 'despesa', 'variavel', true, true, 'AJUSTE_SALDO'
WHERE NOT EXISTS (SELECT 1 FROM public.plano_de_contas WHERE codigo = 'AJUSTE_SALDO');

-- 3) RPC: reconcilia uma conta ao saldo real. Calcula a diferença e insere UM lançamento
--    origem='ajuste' (entrada se falta, saída se sobra). Guard de admin igual às RPCs manuais.
CREATE OR REPLACE FUNCTION public.registrar_ajuste_saldo(p_conta_id uuid, p_saldo_real numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conta   RECORD;
  v_cat_id  uuid;
  v_diff    numeric;
  v_tipo    text;
  v_lanc_id uuid;
BEGIN
  IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
  END IF;

  IF p_saldo_real IS NULL THEN
    RAISE EXCEPTION 'Saldo real e obrigatorio';
  END IF;

  SELECT id, nome, ativo, COALESCE(saldo_atual, 0) AS saldo_atual INTO v_conta
  FROM contas WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta nao encontrada: %', p_conta_id;
  END IF;
  IF NOT v_conta.ativo THEN
    RAISE EXCEPTION 'Conta inativa: %', v_conta.nome;
  END IF;

  v_diff := round(p_saldo_real - v_conta.saldo_atual, 2);
  IF v_diff = 0 THEN
    RETURN NULL;  -- nada a ajustar
  END IF;

  SELECT id INTO v_cat_id FROM plano_de_contas WHERE codigo = 'AJUSTE_SALDO' LIMIT 1;
  IF v_cat_id IS NULL THEN
    RAISE EXCEPTION 'Categoria AJUSTE_SALDO nao encontrada';
  END IF;

  IF v_diff > 0 THEN
    v_tipo := 'entrada';
  ELSE
    v_tipo := 'saida';
    v_diff := -v_diff;
  END IF;

  INSERT INTO lancamentos (tipo, valor, data, descricao, conta_id, plano_conta_id, origem)
  VALUES (v_tipo, v_diff, CURRENT_DATE,
          'Ajuste de saldo (reconciliação)', p_conta_id, v_cat_id, 'ajuste')
  RETURNING id INTO v_lanc_id;

  RETURN v_lanc_id;
END;
$function$;

-- Só authenticated (admin no runtime via is_admin) chama; revoga o grant default a PUBLIC/anon
-- para casar com os RPCs financeiros irmãos (registrar_despesa_manual/entrada_manual) e não
-- reintroduzir o lint 0028 (anon pode executar SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.registrar_ajuste_saldo(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste_saldo(uuid, numeric) TO authenticated;

-- 4) Relatórios: ajustes NÃO são despesa operacional nem entrada/saída de operação.
--    Excluídos do lucro líquido e dos KPIs de caixa; permanecem visíveis no extrato bruto.
--    ⚠️ security_invoker=on precisa ser re-setado (CREATE OR REPLACE reseta reloptions).

CREATE OR REPLACE VIEW public.view_lucro_liquido_mensal
WITH (security_invoker = on) AS
 WITH meses AS (
         SELECT date_trunc('month'::text, vendas.data::timestamp with time zone)::date AS mes
           FROM vendas
          GROUP BY (date_trunc('month'::text, vendas.data::timestamp with time zone)::date)
        ), desp_op AS (
         SELECT date_trunc('month'::text, lancamentos.data::timestamp with time zone)::date AS mes,
            sum(lancamentos.valor) AS despesas_operacionais
           FROM lancamentos
          WHERE lancamentos.tipo = 'saida'::text AND (lancamentos.origem <> ALL (ARRAY['migracao_historica'::text, 'compra_fabrica'::text, 'ajuste'::text]))
          GROUP BY (date_trunc('month'::text, lancamentos.data::timestamp with time zone)::date)
        ), custo_fab AS (
         SELECT date_trunc('month'::text, purchase_order_payments.payment_date)::date AS mes,
            sum(purchase_order_payments.amount) AS custo_fabrica
           FROM purchase_order_payments
          GROUP BY (date_trunc('month'::text, purchase_order_payments.payment_date)::date)
        )
 SELECT m.mes,
    COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0::numeric)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS receita_bruta,
    COALESCE(sum(v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS custo_produtos,
    COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0::numeric) - v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS lucro_bruto,
    COALESCE(d.despesas_operacionais, 0::numeric) AS despesas_operacionais,
    COALESCE(f.custo_fabrica, 0::numeric) AS custo_fabrica,
    COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0::numeric) - v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) + COALESCE(sum(COALESCE(v.taxa_entrega, 0::numeric)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) - COALESCE(d.despesas_operacionais, 0::numeric) AS lucro_liquido,
        CASE
            WHEN sum(v.total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text) > 0::numeric THEN round((COALESCE(sum(v.total - COALESCE(v.taxa_entrega, 0::numeric) - v.custo_total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) + COALESCE(sum(COALESCE(v.taxa_entrega, 0::numeric)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) - COALESCE(d.despesas_operacionais, 0::numeric)) / NULLIF(sum(v.total) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) * 100::numeric, 2)
            ELSE 0::numeric
        END AS margem_liquida_pct,
    COALESCE(sum(COALESCE(v.taxa_entrega, 0::numeric)) FILTER (WHERE v.status = 'entregue'::text AND v.forma_pagamento <> 'brinde'::text), 0::numeric) AS receita_frete
   FROM meses m
     LEFT JOIN vendas v ON date_trunc('month'::text, v.data::timestamp with time zone)::date = m.mes
     LEFT JOIN desp_op d ON d.mes = m.mes
     LEFT JOIN custo_fab f ON f.mes = m.mes
  GROUP BY m.mes, d.despesas_operacionais, f.custo_fabrica
  ORDER BY m.mes DESC;

CREATE OR REPLACE VIEW public.view_fluxo_resumo
WITH (security_invoker = on) AS
 WITH extrato_metrics AS (
         SELECT EXTRACT(month FROM view_extrato_mensal.data)::integer AS mes,
            EXTRACT(year FROM view_extrato_mensal.data)::integer AS ano,
            sum(
                CASE
                    WHEN view_extrato_mensal.tipo = 'entrada'::text THEN view_extrato_mensal.valor
                    ELSE 0::numeric
                END) AS entradas,
            sum(
                CASE
                    WHEN view_extrato_mensal.tipo = 'saida'::text THEN abs(view_extrato_mensal.valor)
                    ELSE 0::numeric
                END) AS saidas
           FROM view_extrato_mensal
          WHERE view_extrato_mensal.origem <> 'ajuste'::text
          GROUP BY (EXTRACT(month FROM view_extrato_mensal.data)::integer), (EXTRACT(year FROM view_extrato_mensal.data)::integer)
        ), vendas_metrics AS (
         SELECT EXTRACT(month FROM vendas.data)::integer AS mes,
            EXTRACT(year FROM vendas.data)::integer AS ano,
            COALESCE(sum(vendas.total), 0::numeric) AS faturamento,
            COALESCE(sum(vendas.custo_total), 0::numeric) AS custo_total,
            COALESCE(sum(
                CASE
                    WHEN vendas.pago = false AND vendas.status = 'entregue'::text AND vendas.forma_pagamento <> 'brinde'::text THEN vendas.total
                    ELSE 0::numeric
                END), 0::numeric) AS a_receber
           FROM vendas
          WHERE vendas.status <> 'cancelada'::text
          GROUP BY (EXTRACT(month FROM vendas.data)::integer), (EXTRACT(year FROM vendas.data)::integer)
        )
 SELECT em.mes,
    em.ano,
    em.entradas AS total_entradas,
    em.saidas AS total_saidas,
    COALESCE(vm.faturamento, 0::numeric) AS total_faturamento,
    COALESCE(vm.faturamento, 0::numeric) - COALESCE(vm.custo_total, 0::numeric) AS lucro_estimado,
    COALESCE(vm.a_receber, 0::numeric) AS total_a_receber
   FROM extrato_metrics em
     LEFT JOIN vendas_metrics vm ON em.mes = vm.mes AND em.ano = vm.ano;
