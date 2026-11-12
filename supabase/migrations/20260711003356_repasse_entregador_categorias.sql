-- Stage 2a — Repasse ao entregador: categorias + colunas de suporte.
--
-- (1) 2 categorias de despesa: "Frete Grátis (cortesia)" (marketing/aquisição —
--     quando a Mont banca o R$5 do frete grátis) e "Repasse Frete Entregador"
--     (logística/pass-through — quando o cliente pagou o frete e a Mont repassa).
--     automatica=false → aparecem na modal de Despesas e aceitam lançamento manual.
-- (2) lancamentos ganha entregador_id + comprovante_url (pro anexo do comprovante
--     e o extrato do entregador).
-- (3) registrar_despesa_manual ganha p_entregador_id + p_comprovante_url opcionais.
--
-- Backup: dump-{schema,data}-20260710 (stage2a).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Categorias (idempotente por codigo)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.plano_de_contas (id, nome, tipo, categoria, ativo, automatica, codigo)
SELECT gen_random_uuid(), 'Frete Grátis (cortesia)', 'despesa', 'variavel', true, false, 'FRETE_GRATIS'
WHERE NOT EXISTS (SELECT 1 FROM public.plano_de_contas WHERE codigo = 'FRETE_GRATIS');

INSERT INTO public.plano_de_contas (id, nome, tipo, categoria, ativo, automatica, codigo)
SELECT gen_random_uuid(), 'Repasse Frete Entregador', 'despesa', 'variavel', true, false, 'REPASSE_ENTREGADOR'
WHERE NOT EXISTS (SELECT 1 FROM public.plano_de_contas WHERE codigo = 'REPASSE_ENTREGADOR');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Colunas de suporte em lancamentos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lancamentos
    ADD COLUMN IF NOT EXISTS entregador_id uuid REFERENCES public.entregadores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS comprovante_url text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. registrar_despesa_manual + p_entregador_id + p_comprovante_url (opcionais).
--    Assinatura muda (2 params novos) → DROP a versão de 5 args + CREATE a de 7.
--    Chamadas antigas (5 args nomeados) resolvem na nova (extras default NULL).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.registrar_despesa_manual(numeric, text, date, uuid, uuid);

CREATE OR REPLACE FUNCTION public.registrar_despesa_manual(
    p_valor numeric,
    p_descricao text,
    p_data date,
    p_conta_id uuid,
    p_plano_conta_id uuid,
    p_entregador_id uuid DEFAULT NULL,
    p_comprovante_url text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lancamento_id UUID;
  v_conta         RECORD;
  v_plano         RECORD;
BEGIN
    IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores'
        USING ERRCODE = '42501';
    END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero. Recebido: %', p_valor;
  END IF;

  SELECT id, nome, ativo INTO v_conta
  FROM contas WHERE id = p_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta nao encontrada: %', p_conta_id;
  END IF;
  IF NOT v_conta.ativo THEN
    RAISE EXCEPTION 'Conta inativa: %', v_conta.nome;
  END IF;

  SELECT id, nome, tipo, ativo, automatica INTO v_plano
  FROM plano_de_contas WHERE id = p_plano_conta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de contas nao encontrado: %', p_plano_conta_id;
  END IF;
  IF NOT v_plano.ativo THEN
    RAISE EXCEPTION 'Categoria inativa: %', v_plano.nome;
  END IF;
  IF v_plano.tipo <> 'despesa' THEN
    RAISE EXCEPTION 'Categoria "%" nao e do tipo despesa (tipo atual: %)',
      v_plano.nome, v_plano.tipo;
  END IF;
  IF v_plano.automatica = true THEN
    RAISE EXCEPTION 'Categoria "%" e automatica e nao aceita lancamento manual',
      v_plano.nome;
  END IF;

  IF p_data > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data nao pode ser futura: %', p_data;
  END IF;

  INSERT INTO lancamentos (
    tipo, valor, data, descricao, conta_id,
    plano_conta_id, origem, entregador_id, comprovante_url
  ) VALUES (
    'saida', p_valor, p_data, p_descricao, p_conta_id,
    p_plano_conta_id, 'manual', p_entregador_id, p_comprovante_url
  )
  RETURNING id INTO v_lancamento_id;

  RETURN v_lancamento_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_despesa_manual(numeric, text, date, uuid, uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_despesa_manual(numeric, text, date, uuid, uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
