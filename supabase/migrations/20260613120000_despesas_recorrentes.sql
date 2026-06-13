-- Despesas Stage 2 — recorrência mensal ("fixa").
-- Aditiva e reversível: nova tabela despesas_recorrentes (templates), 2 colunas nullable
-- em contas_a_pagar (recorrente_id, competencia) e um RPC idempotente que materializa as
-- ocorrências do mês. Sem cron — a página Despesas chama o gerador no load (lazy);
-- rodar 2× não duplica (unique recorrente_id+competencia + ON CONFLICT DO NOTHING).

-- 1) Templates de despesa recorrente -----------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_recorrentes (
    id              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    descricao       text NOT NULL,
    credor          text NOT NULL,
    valor           numeric(12,2) NOT NULL CHECK (valor > 0),
    plano_conta_id  uuid NOT NULL REFERENCES public.plano_de_contas(id),
    dia_vencimento  integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    ativa           boolean DEFAULT true NOT NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    created_by      uuid,
    updated_by      uuid,
    criado_em       timestamptz DEFAULT now(),
    atualizado_em   timestamptz DEFAULT now()
);

ALTER TABLE public.despesas_recorrentes OWNER TO postgres;
ALTER TABLE public.despesas_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage despesas_recorrentes" ON public.despesas_recorrentes
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

CREATE OR REPLACE TRIGGER tr_despesas_recorrentes_audit
    BEFORE INSERT OR UPDATE ON public.despesas_recorrentes
    FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

GRANT ALL ON TABLE public.despesas_recorrentes TO anon;
GRANT ALL ON TABLE public.despesas_recorrentes TO authenticated;
GRANT ALL ON TABLE public.despesas_recorrentes TO service_role;

-- 2) Vínculo da ocorrência com o template + idempotência ---------------------
ALTER TABLE public.contas_a_pagar
    ADD COLUMN IF NOT EXISTS recorrente_id uuid REFERENCES public.despesas_recorrentes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS competencia   date;

-- NULLs são distintos por padrão → as contas manuais (recorrente_id/competencia NULL)
-- não colidem; só uma ocorrência por (template, mês de competência).
ALTER TABLE public.contas_a_pagar
    ADD CONSTRAINT uq_contas_a_pagar_recorrente_competencia UNIQUE (recorrente_id, competencia);

-- 3) Gerador idempotente das ocorrências do mês ------------------------------
CREATE OR REPLACE FUNCTION public.gerar_despesas_recorrentes(p_competencia date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    r            RECORD;
    v_comp       date := date_trunc('month', p_competencia)::date;
    v_last_day   int  := EXTRACT(DAY FROM (date_trunc('month', p_competencia) + INTERVAL '1 month - 1 day'));
    v_venc       date;
    v_count      int  := 0;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
    END IF;

    FOR r IN SELECT * FROM public.despesas_recorrentes WHERE ativa = true LOOP
        -- vencimento = dia configurado, limitado ao último dia do mês (ex.: dia 31 em fev → 28/29).
        v_venc := v_comp + ((LEAST(r.dia_vencimento, v_last_day) - 1) * INTERVAL '1 day');

        INSERT INTO public.contas_a_pagar (
            descricao, credor, valor_total, data_vencimento,
            plano_conta_id, parcela_atual, total_parcelas,
            recorrente_id, competencia
        ) VALUES (
            r.descricao, r.credor, r.valor, v_venc,
            r.plano_conta_id, 1, 1,
            r.id, v_comp
        )
        ON CONFLICT (recorrente_id, competencia) DO NOTHING;

        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$function$;

ALTER FUNCTION public.gerar_despesas_recorrentes(date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.gerar_despesas_recorrentes(date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.gerar_despesas_recorrentes(date) TO authenticated;
GRANT ALL ON FUNCTION public.gerar_despesas_recorrentes(date) TO service_role;
