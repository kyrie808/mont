-- Marca de origem: este registro foi escrito por IA, não pelo Gilmar.
--
-- Governança: a IA sugere, o humano confirma. Um registro automático entra na timeline
-- com selo visível e pode ser editado ou apagado. Automação que decide sozinha e não
-- se identifica erra em silêncio.
--
-- Também é a alavanca de reversão: se o analista sair ruim, um único DELETE por
-- `gerado_por_ia = true` limpa tudo que a IA escreveu sem tocar no que é humano.

ALTER TABLE public.interacoes
  ADD COLUMN IF NOT EXISTS gerado_por_ia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.interacoes.gerado_por_ia IS
  'true = escrito pelo analista de conversa (W2). A UI mostra selo de origem automática.';

CREATE INDEX IF NOT EXISTS idx_interacoes_gerado_por_ia
  ON public.interacoes (contato_id) WHERE gerado_por_ia;

NOTIFY pgrst, 'reload schema';
