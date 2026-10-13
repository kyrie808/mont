-- Meta CAPI — o canal (`action_source`) sai do trigger e vai para o worker.
--
-- O bug: os triggers gravavam `business_messaging` para todo contato com `ctwa_clid`, e a
-- Meta recusava 100% desses eventos (erro 100, subcode 2804063, "parâmetro de canal de
-- mensagens ausente"). Esse canal exige `messaging_channel: 'whatsapp'` e o WABA
-- (`whatsapp_business_account_id`), que só existe com a API oficial — a Mont usa o
-- WhatsApp Business app pela Evolution. 39 eventos ficaram em `erro` até o reenvio
-- manual de 13/10/2026 (como `physical_store`: 39 de 39 aceitos).
--
-- Quem sabe se o WABA existe é o worker (segredo `META_WABA_ID`), então é ele que decide
-- — ver `packages/shared/src/metaCapi.ts`. O trigger passa a registrar só o fato e o
-- `ctwa_clid` (snapshot), e `action_source` muda de sentido: deixa de ser "canal
-- pretendido" e vira "canal com que a Meta ACEITOU o evento", gravado no envio.
--
-- Nenhuma linha existente é tocada: as 568 já enviadas têm `action_source` preenchido
-- (todas `physical_store`), e é isso que a regra nova exige delas.

-- ── Coluna ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.meta_eventos
  ALTER COLUMN action_source DROP NOT NULL;

ALTER TABLE public.meta_eventos
  ADD CONSTRAINT meta_eventos_action_source_check
    CHECK (action_source IS NULL OR action_source IN ('physical_store', 'business_messaging'));

-- Evento que a Meta aceitou sempre diz por qual canal entrou.
ALTER TABLE public.meta_eventos
  ADD CONSTRAINT meta_eventos_enviado_tem_canal_check
    CHECK (status <> 'enviado' OR action_source IS NOT NULL);

COMMENT ON COLUMN public.meta_eventos.action_source IS
  'Canal com que o worker enviou à Meta (physical_store | business_messaging). NULL enquanto pendente; em erro, o último canal tentado. Decidido no worker (META_WABA_ID), nunca no trigger.';

-- ── Lead ────────────────────────────────────────────────────────────────────────
-- Igual a 20260723160000, menos a decisão de canal.
CREATE OR REPLACE FUNCTION public.fn_enfileirar_lead_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(NEW.origem, '') = 'anuncio' THEN
    INSERT INTO public.meta_eventos (
      evento, event_id, contato_id, event_time, ctwa_clid, status
    )
    VALUES (
      'Lead',
      'lead_' || NEW.id,
      NEW.id,
      coalesce(NEW.criado_em, now()),
      NEW.ctwa_clid,
      'pendente'
    )
    ON CONFLICT (event_id) DO NOTHING;  -- idempotência
  END IF;

  RETURN NEW;
END;
$$;

-- ── Purchase ────────────────────────────────────────────────────────────────────
-- Igual a 20260702120500, menos a decisão de canal.
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
     AND coalesce(NEW.origem, '') <> 'catalogo'
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

-- CREATE OR REPLACE preserva o ACL, mas o REVOKE fica explícito: as duas são
-- trigger-only e não podem ser chamáveis pela API (lints 0028/0029).
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_lead_meta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_enfileirar_purchase_meta() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
