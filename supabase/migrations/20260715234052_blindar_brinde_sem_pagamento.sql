-- Blinda a invariante do brinde: BRINDE NUNCA RECEBE DINHEIRO (regra do Gilmar, 15/07).
--
-- PROBLEMA (colisão de triggers):
--   `handle_brinde_before_insert` forçava pago=false/valor_pago=0 SÓ em BEFORE INSERT.
--   Registrar um pagamento depois disparava `update_venda_pagamento_summary`, que faz
--   `pago = (SUM(pagamentos) >= total)` → voltava pra TRUE, atropelando a proteção.
--   Resultado em prod: 12 vendas brinde com linha de pagamento, 6 com pago=true, e
--   R$188,02 de lançamentos RECEBIMENTO_VENDA (entrada) por produto DOADO.
--   (A limpeza desses dados vai na migration seguinte.)
--
-- SOLUÇÃO — 2 camadas:
--   1. Bloqueio na fonte: pagamento em venda brinde levanta exceção. Fecha TODOS os
--      caminhos de uma vez (UI, RPC, app do entregador, SQL manual).
--   2. Invariante em UPDATE: mesmo que algo atualize `vendas`, brinde volta a
--      pago=false/valor_pago=0. Fecha o buraco da conversão-para-brinde por UPDATE
--      (origem das linhas órfãs de 27/03).
--
-- ROLLBACK:
--   DROP TRIGGER trg_bloquear_pagamento_em_brinde ON public.pagamentos_venda;
--   DROP FUNCTION public.fn_bloquear_pagamento_em_brinde();
--   DROP TRIGGER trigger_brinde_invariante ON public.vendas;
--   DROP FUNCTION public.fn_brinde_invariante();
--   -- e recriar handle_brinde_before_insert + trigger_brinde_before_insert (BEFORE INSERT).

-- ── Camada 1: bloqueio na fonte ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_bloquear_pagamento_em_brinde()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.vendas v
        WHERE v.id = NEW.venda_id AND v.forma_pagamento = 'brinde'
    ) THEN
        RAISE EXCEPTION 'Brinde não recebe pagamento: a venda % é um brinde', NEW.venda_id
            USING ERRCODE = '22000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_pagamento_em_brinde ON public.pagamentos_venda;
CREATE TRIGGER trg_bloquear_pagamento_em_brinde
    BEFORE INSERT OR UPDATE ON public.pagamentos_venda
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_bloquear_pagamento_em_brinde();

-- ── Camada 2: invariante do brinde em INSERT **e** UPDATE ────────────────────
-- Renomeado de `handle_brinde_before_insert`: o nome antigo mentiria rodando em UPDATE.
CREATE OR REPLACE FUNCTION public.fn_brinde_invariante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.forma_pagamento = 'brinde' THEN
        NEW.pago       := false;
        NEW.valor_pago := 0;

        -- `status` só é forçado na CRIAÇÃO. Num UPDATE isso travaria a venda em
        -- 'entregue' e quebraria o "Voltar para Pendente" — e o fluxo de ENTREGA
        -- do brinde tem que continuar funcionando normalmente.
        IF TG_OP = 'INSERT' THEN
            NEW.status := 'entregue';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_brinde_before_insert ON public.vendas;
DROP TRIGGER IF EXISTS trigger_brinde_invariante ON public.vendas;
CREATE TRIGGER trigger_brinde_invariante
    BEFORE INSERT OR UPDATE ON public.vendas
    FOR EACH ROW
    WHEN (NEW.forma_pagamento = 'brinde')
    EXECUTE FUNCTION public.fn_brinde_invariante();

DROP FUNCTION IF EXISTS public.handle_brinde_before_insert();
