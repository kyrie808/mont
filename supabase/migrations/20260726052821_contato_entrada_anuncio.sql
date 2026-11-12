-- Relacionamento ↔ Meta Ads: o lead de anúncio inicia a conversa (clica no anúncio → WhatsApp).
-- Isso é o 1º ponto de contato de ENTRADA. Ao cadastrar um contato com origem='anuncio',
-- cria automaticamente uma interação de entrada → aparece na timeline + o trigger
-- fn_contato_assistido_status move o card p/ 'em_negociacao' (Em Conversa) + amarra o campanha_id.
--
-- Trigger plano (sem SECURITY DEFINER), espelha fn_contato_assistido_status. Dedup por marcador
-- na observação → re-edição de origem não duplica.

CREATE OR REPLACE FUNCTION public.fn_contato_entrada_anuncio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    IF COALESCE(NEW.origem, '') = 'anuncio'
       AND NOT EXISTS (
           SELECT 1 FROM public.interacoes i
           WHERE i.contato_id = NEW.id
             AND i.tipo = 'ponto_contato'
             AND i.sentido = 'entrada'
             AND i.observacao = 'Cliente iniciou a conversa pelo anúncio'
       )
    THEN
        INSERT INTO public.interacoes
            (contato_id, tipo, sentido, canal, campanha_id, data, observacao, criado_por)
        VALUES
            (NEW.id, 'ponto_contato', 'entrada', 'whatsapp', NEW.campanha_id,
             COALESCE(NEW.criado_em, now()), 'Cliente iniciou a conversa pelo anúncio', auth.uid());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contato_entrada_anuncio ON public.contatos;
CREATE TRIGGER trg_contato_entrada_anuncio
    AFTER INSERT OR UPDATE OF origem ON public.contatos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_contato_entrada_anuncio();
