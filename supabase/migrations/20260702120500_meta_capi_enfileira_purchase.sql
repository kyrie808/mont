-- Meta CAPI — enfileiramento de Purchase na outbox meta_eventos
-- Blueprint §3.3 e §9.1. TDD: apps/interno/src/services/__tests__/metaEventos.integration.test.ts
--
-- Regra (invioláveis §2 / §9.1):
--   Enfileira Purchase quando  status = 'entregue' AND forma_pagamento <> 'brinde'.
--   fiado INCLUÍDO (dispara na entrega, independente de `pago`); brinde EXCLUÍDO.
--   origem = 'catalogo' EXCLUÍDA: o Pixel do navegador do catálogo já dispara Purchase
--   (carrinho/page.tsx) — enfileirar aqui contaria em dobro (event_id diferente, sem dedup).
--
-- event_id = 'venda_<id>'  → a UNIQUE em meta_eventos.event_id garante idempotência:
--   re-disparos do trigger (ex.: mudança de forma_pagamento numa venda já entregue)
--   caem no ON CONFLICT DO NOTHING. Uma venda nunca duplica evento.
--
-- Trigger é o único ponto de choke: interno é SPA client-only e há vários caminhos de
-- escrita em vendas (updateVenda, cancelVenda, RPC criar_pedido, triggers de sync
-- cat_pedido↔venda). Só no banco capturamos todos.

CREATE OR REPLACE FUNCTION public.fn_enfileirar_purchase_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ctwa_clid     text;
  v_action_source text;
BEGIN
  IF NEW.status = 'entregue'
     AND NEW.forma_pagamento <> 'brinde'
     AND coalesce(NEW.origem, '') <> 'catalogo'
  THEN
    -- Snapshot do ctwa_clid do contato (v1: quase sempre NULL — sem gateway ainda).
    SELECT c.ctwa_clid INTO v_ctwa_clid
    FROM public.contatos c
    WHERE c.id = NEW.contato_id;

    v_action_source := CASE
      WHEN v_ctwa_clid IS NOT NULL THEN 'business_messaging'
      ELSE 'physical_store'
    END;

    INSERT INTO public.meta_eventos (
      evento, event_id, contato_id, venda_id, event_time,
      valor, moeda, ctwa_clid, action_source, status
    )
    VALUES (
      'Purchase',
      'venda_' || NEW.id,
      NEW.contato_id,
      NEW.id,
      -- Momento da conversão: preferir data_entrega; senão data da venda; senão criação.
      coalesce(NEW.data_entrega::timestamptz, NEW.data::timestamptz, NEW.criado_em, now()),
      NEW.total,
      'BRL',
      v_ctwa_clid,
      v_action_source,
      'pendente'
    )
    ON CONFLICT (event_id) DO NOTHING;  -- idempotência
  END IF;

  RETURN NEW;
END;
$$;

-- AFTER INSERT (imports que já entram 'entregue') OR UPDATE OF status/forma_pagamento
-- (o flip para entregue). Restringir as colunas evita disparo a cada update de `pago`.
DROP TRIGGER IF EXISTS trg_enfileirar_purchase_meta ON public.vendas;
CREATE TRIGGER trg_enfileirar_purchase_meta
  AFTER INSERT OR UPDATE OF status, forma_pagamento ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enfileirar_purchase_meta();

-- Trigger-only: não deve ser chamável via API REST. O trigger dispara independente de
-- grant; revogar EXECUTE fecha os lints 0028/0029 sem afetar o enfileiramento.
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM authenticated;

NOTIFY pgrst, 'reload schema';
