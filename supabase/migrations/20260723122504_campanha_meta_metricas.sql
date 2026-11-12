-- Fase 2 (Integração Meta): série temporal diária de insights por campanha.
--
-- Guarda o GASTO real (denominador do ROAS) + impressões/cliques por dia × campanha,
-- vindo da Marketing API (insights). Só métricas aditivas (somam por período); reach/
-- results ficam de fora porque não somam por dia.
--
-- Escrita só service_role (a Edge Function faz o upsert); leitura só admin. Espelha o
-- padrão de RLS de `meta_eventos`.

CREATE TABLE IF NOT EXISTS public.campanha_meta_metricas (
    campanha_id uuid        NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    dia         date        NOT NULL,
    gasto       numeric     NOT NULL DEFAULT 0,
    impressoes  bigint      NOT NULL DEFAULT 0,
    cliques     bigint      NOT NULL DEFAULT 0,
    sync_em     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (campanha_id, dia)
);

COMMENT ON TABLE public.campanha_meta_metricas IS
    'Insights diários por campanha da Meta (gasto/impressões/cliques). Fonte do ROAS. Populada pela Edge Function meta-ads-sync.';

ALTER TABLE public.campanha_meta_metricas ENABLE ROW LEVEL SECURITY;

-- service_role ignora RLS (faz o upsert). Só o SELECT de admin precisa de policy.
CREATE POLICY "admin le metricas meta" ON public.campanha_meta_metricas
    FOR SELECT TO authenticated
    USING (is_admin(auth.uid()));
