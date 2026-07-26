-- Relacionamento: comprou → Resolvido. Uma venda entregue (não-brinde) fecha a relação de
-- prospecção — move o card p/ 'resolvido', a partir de qualquer estado PRÉ-venda. Não mexe em
-- 'resolvido'/'recusou'. A recompra futura ainda é sinalizada pelas regras temporais
-- ('sumido'/reativação da view), independentes de status_relacionamento.
--
-- Trigger plano, espelha o estilo de fn_enfileirar_purchase_meta (mesma condição de venda válida).

CREATE OR REPLACE FUNCTION public.fn_venda_resolve_relacionamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.status = 'entregue' AND NEW.forma_pagamento <> 'brinde' THEN
        UPDATE public.contatos
        SET status_relacionamento = 'resolvido'
        WHERE id = NEW.contato_id
          AND status_relacionamento::text IN
              ('a_contatar', 'contatado', 'em_negociacao', 'follow_up', 'sem_retorno');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venda_resolve_relacionamento ON public.vendas;
CREATE TRIGGER trg_venda_resolve_relacionamento
    AFTER INSERT OR UPDATE OF status ON public.vendas
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_venda_resolve_relacionamento();
