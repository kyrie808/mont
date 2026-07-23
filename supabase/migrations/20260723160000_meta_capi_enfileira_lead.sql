-- Meta CAPI (Fase 3) — enfileiramento de Lead na outbox meta_eventos.
--
-- Fecha a direção de SAÍDA do loop: quando um lead é cadastrado com origem='anuncio',
-- enfileira um evento Lead → o worker meta-capi-worker (cron diário) manda pra Meta,
-- com o mesmo user_data hasheado (telefone/nome/cidade/UF/CEP/external_id) que o Purchase.
-- Isso alimenta o algoritmo e engrossa a atribuição.
--
-- Espelha fn_enfileirar_purchase_meta (20260702120500): SECURITY DEFINER, search_path='',
-- REVOKE EXECUTE (fecha lints 0028/0029; o trigger dispara independente de grant).
--
-- event_id = 'lead_<id>' → a UNIQUE em meta_eventos.event_id garante idempotência:
-- re-disparo (ex.: editar origem) cai no ON CONFLICT DO NOTHING. Um contato = um Lead.
-- Escopo v1: só origem='anuncio' (sinal limpo de lead vindo do tráfego pago).

CREATE OR REPLACE FUNCTION public.fn_enfileirar_lead_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action_source text;
BEGIN
  IF coalesce(NEW.origem, '') = 'anuncio' THEN
    v_action_source := CASE
      WHEN NEW.ctwa_clid IS NOT NULL THEN 'business_messaging'
      ELSE 'physical_store'
    END;

    INSERT INTO public.meta_eventos (
      evento, event_id, contato_id, event_time,
      ctwa_clid, action_source, status
    )
    VALUES (
      'Lead',
      'lead_' || NEW.id,
      NEW.id,
      coalesce(NEW.criado_em, now()),
      NEW.ctwa_clid,
      v_action_source,
      'pendente'
    )
    ON CONFLICT (event_id) DO NOTHING;  -- idempotência
  END IF;

  RETURN NEW;
END;
$$;

-- AFTER INSERT (cadastro novo) OR UPDATE OF origem (editar um contato pra Anúncio).
DROP TRIGGER IF EXISTS trg_enfileirar_lead_meta ON public.contatos;
CREATE TRIGGER trg_enfileirar_lead_meta
  AFTER INSERT OR UPDATE OF origem ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enfileirar_lead_meta();

-- Trigger-only: não deve ser chamável via API REST.
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_lead_meta() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_lead_meta() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_lead_meta() FROM authenticated;

NOTIFY pgrst, 'reload schema';
