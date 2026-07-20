-- Campanhas — unifica "campanha de anúncio" (aquisição) e "ação promocional".
--
-- 1) campanhas ganha `tipo` (aquisicao/promocao/ambos) + período + descrição.
-- 2) nova contato_campanhas (N:N) = PARTICIPAÇÃO promocional ("cliente ofertado
--    nesta ação"), espelhando contato_tags. Aquisição segue em contatos.campanha_id.
-- 3) migra as tags de campanha (Copa 57, Dia das Mães 64) → campanhas + participações;
--    tags de atributo (Whatsapp Incorreto, Revenda, Feedback) ficam.
--
-- Copa já existe como campanha de anúncio (1 lead) E como tag (57) → mesma iniciativa:
-- vira tipo='ambos'. Dia das Mães (só tag) → campanha nova tipo='promocao'.

-- 1) campanhas: tipo + período + descrição -----------------------------------
ALTER TABLE public.campanhas
    ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'aquisicao'
        CHECK (tipo IN ('aquisicao', 'promocao', 'ambos')),
    ADD COLUMN IF NOT EXISTS data_inicio date,
    ADD COLUMN IF NOT EXISTS data_fim date,
    ADD COLUMN IF NOT EXISTS descricao text;

-- 2) contato_campanhas (participação promocional) ----------------------------
CREATE TABLE IF NOT EXISTS public.contato_campanhas (
    contato_id  uuid NOT NULL REFERENCES public.contatos(id)  ON DELETE CASCADE,
    campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    criado_em   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contato_id, campanha_id)
);
ALTER TABLE public.contato_campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read contato_campanhas" ON public.contato_campanhas
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage contato_campanhas" ON public.contato_campanhas
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 3) migração das tags de campanha -------------------------------------------
-- Copa: campanha de anúncio existente vira "ambos".
UPDATE public.campanhas SET tipo = 'ambos' WHERE nome = 'Copa';

-- Dia das Mães: cria campanha de promoção (idempotente).
INSERT INTO public.campanhas (nome, ativo, tipo)
SELECT 'Dia das Mães', true, 'promocao'
WHERE NOT EXISTS (SELECT 1 FROM public.campanhas WHERE nome = 'Dia das Mães');

-- Participações: contato_tags(Copa) → contato_campanhas(Copa)
INSERT INTO public.contato_campanhas (contato_id, campanha_id, criado_em)
SELECT ct.contato_id,
       (SELECT id FROM public.campanhas WHERE nome = 'Copa' LIMIT 1),
       COALESCE(ct.created_at, now())
FROM public.contato_tags ct JOIN public.tags t ON t.id = ct.tag_id
WHERE lower(t.nome) = 'copa'
ON CONFLICT DO NOTHING;

-- Participações: contato_tags(Dia das Mães) → contato_campanhas(Dia das Mães)
INSERT INTO public.contato_campanhas (contato_id, campanha_id, criado_em)
SELECT ct.contato_id,
       (SELECT id FROM public.campanhas WHERE nome = 'Dia das Mães' LIMIT 1),
       COALESCE(ct.created_at, now())
FROM public.contato_tags ct JOIN public.tags t ON t.id = ct.tag_id
WHERE lower(t.nome) IN ('dia das mães', 'dia das maes')
ON CONFLICT DO NOTHING;

-- Apaga as tags de campanha (as de atributo ficam).
DELETE FROM public.contato_tags ct USING public.tags t
WHERE ct.tag_id = t.id AND lower(t.nome) IN ('copa', 'dia das mães', 'dia das maes');
DELETE FROM public.tags WHERE lower(nome) IN ('copa', 'dia das mães', 'dia das maes');
