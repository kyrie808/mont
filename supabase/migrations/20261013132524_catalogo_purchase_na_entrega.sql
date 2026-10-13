-- Meta CAPI — Purchase do catálogo passa a sair do sistema, na entrega.
--
-- Antes: o site mandava Purchase no clique de "finalizar pedido" (antes do WhatsApp) e
-- este trigger excluía origem='catalogo'. Resultado: pedido nunca entregue contava como
-- compra (3 desde agosto: R$ 55, 65, 220) e venda do catálogo entregue nunca virava
-- Purchase. Desde o deploy do PR #4 o site manda InitiateCheckout no envio do pedido, e
-- a compra do catálogo sai daqui, quando a venda é entregue.
--
-- CORTE = 2026-10-13 13:22:05 UTC, hora em que o deploy de produção do catálogo (commit
-- e2c7990) ficou pronto. Venda do catálogo criada ANTES disso já mandou Purchase pelo
-- site (código antigo); enfileirar na entrega contaria a mesma compra duas vezes.
--
-- Fora o corte, igual a 20261013092618 (canal decidido pelo worker, action_source NULL).
CREATE OR REPLACE FUNCTION public.fn_enfileirar_purchase_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ctwa_clid text;
BEGIN
  IF NEW.status = 'entregue'
     AND NEW.forma_pagamento <> 'brinde'
     AND (
       coalesce(NEW.origem, '') <> 'catalogo'
       OR NEW.criado_em >= TIMESTAMPTZ '2026-10-13 13:22:05+00'
     )
  THEN
    -- Snapshot do ctwa_clid do contato no momento da conversão.
    SELECT c.ctwa_clid INTO v_ctwa_clid
    FROM public.contatos c
    WHERE c.id = NEW.contato_id;

    INSERT INTO public.meta_eventos (
      evento, event_id, contato_id, venda_id, event_time,
      valor, moeda, ctwa_clid, status
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
      'pendente'
    )
    ON CONFLICT (event_id) DO NOTHING;  -- idempotência
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
