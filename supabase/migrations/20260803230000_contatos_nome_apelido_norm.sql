-- ============================================================================
-- Busca de contato insensível a acento.
--
-- PROBLEMA: 'Claudia' não achava "Cláudia", 'Antonio' não achava "Antônio".
-- 140 dos 807 contatos têm acento no nome e 128 no apelido — ~17% da base
-- ficava invisível para quem digita sem acento (e vice-versa). Com a busca por
-- palavra exata (espaço no fim) o problema virou crítico: no modo substring
-- ainda havia chance de casar por outro pedaço; no modo exato, vem vazio.
--
-- POR QUE COLUNA GERADA: o PostgREST não chama função sobre coluna no filtro
-- (`unaccent(nome) ilike …` é impossível via `.or()`). A forma normalizada
-- precisa estar materializada — mesmo padrão já usado em `telefone_norm`, e a
-- tabela já tem precedente de coluna gerada (`fts`).
--
-- POR QUE `normalize(NFD)` E NÃO A EXTENSÃO `unaccent`:
--   * `unaccent()` é STABLE — não serve para coluna gerada sem um wrapper
--     IMMUTABLE mentiroso (e exigiria instalar a extensão).
--   * `normalize(text, NFD)` é genuinamente IMMUTABLE (verificado em
--     pg_proc.provolatile = 'i'), decompõe o acento e deixa a marca combinante
--     separada; o regexp_replace apaga a marca. Cobre qualquer idioma, sem
--     mapa de caracteres para manter.
--   * É o espelho EXATO de `stripAccents` (packages/shared/src/metaNormalize.ts),
--     que faz `normalize('NFD').replace(/[̀-ͯ]/g, '')` no cliente.
--     Banco e app precisam concordar, senão a busca falha em silêncio.
-- ============================================================================

ALTER TABLE public.contatos
    ADD COLUMN IF NOT EXISTS nome_norm text
    GENERATED ALWAYS AS (
        regexp_replace(normalize(coalesce(nome, ''), NFD), E'[̀-ͯ]', '', 'g')
    ) STORED;

ALTER TABLE public.contatos
    ADD COLUMN IF NOT EXISTS apelido_norm text
    GENERATED ALWAYS AS (
        regexp_replace(normalize(coalesce(apelido, ''), NFD), E'[̀-ͯ]', '', 'g')
    ) STORED;

COMMENT ON COLUMN public.contatos.nome_norm IS
    'Nome sem acento, gerado de `nome`. Alvo da busca — espelha stripAccents() do app. Nao escrever: e GENERATED ALWAYS.';
COMMENT ON COLUMN public.contatos.apelido_norm IS
    'Apelido sem acento, gerado de `apelido`. Alvo da busca — espelha stripAccents() do app. Nao escrever: e GENERATED ALWAYS.';

-- ----------------------------------------------------------------------------
-- Guarda de sanidade: aborta se qualquer acento sobreviveu à normalização.
-- Protege contra o escape Unicode do literal não ter sido interpretado.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    restantes int;
BEGIN
    SELECT count(*) INTO restantes
    FROM public.contatos
    WHERE nome_norm ~ '[^\x00-\x7F]' OR apelido_norm ~ '[^\x00-\x7F]';

    IF restantes > 0 THEN
        RAISE EXCEPTION 'Normalizacao de acento falhou em % contatos', restantes;
    END IF;
END $$;

-- Sem índice: 807 linhas e o filtro é `ilike '%…%'` / regex, que btree não serve.
-- Se a base crescer, o caminho é pg_trgm (já disponível, não instalado).

NOTIFY pgrst, 'reload schema';
