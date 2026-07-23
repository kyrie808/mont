-- Fase 1 (Integração Meta): campanhas de tráfego passam a vir da Meta.
--
-- A Meta vira a fonte da verdade das campanhas de TRÁFEGO (aquisição). Cada campanha
-- da Meta = 1 linha em `campanhas` (1:1, a Meta já é a granularidade). Campanhas de
-- PROMOÇÃO (ofertas a clientes: Dia das Mães, lado promo da Copa) continuam internas.
--
-- Este migration só adiciona o elo + cache da sync na tabela existente. Não mexe em
-- RLS/grants; `contatos.campanha_id`, `contato_campanhas` e as views `rpt_campanhas*`
-- seguem funcionando (campanha Meta continua sendo uma linha de `campanhas`).

ALTER TABLE public.campanhas
    ADD COLUMN IF NOT EXISTS meta_campaign_id text UNIQUE,
    ADD COLUMN IF NOT EXISTS origem_campanha  text NOT NULL DEFAULT 'interna'
        CHECK (origem_campanha IN ('interna', 'meta')),
    ADD COLUMN IF NOT EXISTS meta_objetivo    text,
    ADD COLUMN IF NOT EXISTS meta_status      text,
    ADD COLUMN IF NOT EXISTS meta_sync_em     timestamptz;

COMMENT ON COLUMN public.campanhas.meta_campaign_id IS
    'ID da campanha na Meta (Graph API). Null para campanhas internas (promoção). UNIQUE impede dupla contagem de gasto.';
COMMENT ON COLUMN public.campanhas.origem_campanha IS
    'interna = criada à mão (promoção/oferta); meta = sincronizada da Meta (tráfego pago).';
COMMENT ON COLUMN public.campanhas.meta_status IS
    'effective_status da campanha na Meta no último sync (ACTIVE/PAUSED/etc).';
COMMENT ON COLUMN public.campanhas.meta_sync_em IS
    'Timestamp do último sync bem-sucedido vindo da Meta.';
