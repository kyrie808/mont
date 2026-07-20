-- Oferta ↔ evento de contato: a interação (ponto de contato) pode referenciar a
-- campanha/oferta que foi apresentada. Dá o HISTÓRICO (dia/ordem/resposta) na
-- linha do tempo. FK opcional; ON DELETE SET NULL (apagar a campanha não apaga o contato).
ALTER TABLE public.interacoes
    ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL;
