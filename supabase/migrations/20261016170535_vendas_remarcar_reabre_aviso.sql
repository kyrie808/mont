-- Rodada 2, item C/5 (Luccas, 16/10/2026): remarcação. Mudou a data prevista de entrega,
-- o aviso antigo no #ENTREGAS deixou de valer: aviso_grupo_enviado_em volta a NULL e a
-- automação manda o aviso da nova data na regra de sempre (19h da véspera / na hora).
--
-- No banco (e não só na tela) para valer de qualquer porta: app, SQL, secretária.

CREATE OR REPLACE FUNCTION public.fn_venda_remarcada_reabre_aviso()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.aviso_grupo_enviado_em := NULL;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_venda_remarcada_reabre_aviso() IS
  'Remarcação: data_entrega_prevista mudou → o aviso no #ENTREGAS volta a ser devido (aviso_grupo_enviado_em = NULL).';

DROP TRIGGER IF EXISTS trg_venda_remarcada_reabre_aviso ON public.vendas;
CREATE TRIGGER trg_venda_remarcada_reabre_aviso
  BEFORE UPDATE OF data_entrega_prevista ON public.vendas
  FOR EACH ROW
  WHEN (OLD.data_entrega_prevista IS DISTINCT FROM NEW.data_entrega_prevista)
  EXECUTE FUNCTION public.fn_venda_remarcada_reabre_aviso();
