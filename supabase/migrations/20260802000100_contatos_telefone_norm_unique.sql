-- ============================================================================
-- Torna o telefone o identificador único REAL do contato.
--
-- Antes: `contatos_telefone_key UNIQUE (telefone)` — unicidade sobre o TEXTO.
-- '11969791012' e '11 96979-1012' eram strings diferentes, então a mesma
-- pessoa entrava duas vezes sem o banco reclamar.
--
-- Depois: coluna gerada `telefone_norm` (só dígitos) + UNIQUE nela. A garantia
-- passa a ser incondicional — vale para o interno, o catálogo, a RPC
-- `criar_pedido`, o app do entregador, psql, MCP ou qualquer código futuro.
-- Normalização no app vira conveniência de UX, não mais a única defesa.
--
-- Pré-requisito: 20260802000000_merge_contatos_telefone_duplicados.sql
-- (sem a fusão + backfill, a criação do índice falha).
-- ============================================================================

ALTER TABLE public.contatos
    ADD COLUMN IF NOT EXISTS telefone_norm text
    GENERATED ALWAYS AS (regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) STORED;

COMMENT ON COLUMN public.contatos.telefone_norm IS
    'Telefone só com dígitos, gerado a partir de `telefone`. Chave de identidade '
    'do contato e alvo da busca. Não escrever direto — é GENERATED ALWAYS.';

-- Parcial: contato sem telefone (string vazia) não deve colidir com outro sem telefone.
CREATE UNIQUE INDEX IF NOT EXISTS contatos_telefone_norm_key
    ON public.contatos (telefone_norm)
    WHERE telefone_norm <> '';

NOTIFY pgrst, 'reload schema';
