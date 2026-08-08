-- ============================================================================
-- Funde contatos duplicados por telefone e normaliza a coluna `telefone`.
--
-- CONTEXTO (bug de produção, 01/08/2026):
-- A UNIQUE(telefone) existente era sobre o TEXTO cru, então '11969791012' e
-- '11 96979-1012' passavam como registros distintos — a mesma pessoa virava
-- dois clientes. 632 de 813 contatos estavam salvos com máscara.
--
-- Esta migration prepara o terreno: sem fundir os duplicados e sem backfill,
-- o índice único sobre os dígitos (migration seguinte) não consegue ser criado.
--
-- Política de fusão (decidida pelo diretor):
--   sobrevivente = o mais ANTIGO (preserva criado_em, origem, aquisição)
--   nome         = o mais COMPLETO dos dois (mais palavras; empate → mais longo)
--   demais campos = COALESCE(sobrevivente, perdedor) — preenche buraco, não sobrescreve
--
-- Os triggers `trg_enfileirar_lead_meta` e `trg_contato_entrada_anuncio` são
-- `UPDATE OF origem`; esta migration não toca `origem`, então não dispara
-- evento de Lead falso para a Meta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fusão dos duplicados
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    g       record;
    loser   uuid;
    fundidos int := 0;
BEGIN
    FOR g IN
        WITH norm AS (
            SELECT id,
                   criado_em,
                   regexp_replace(coalesce(telefone, ''), '\D', '', 'g') AS d
            FROM public.contatos
        ),
        grp AS (
            SELECT d,
                   array_agg(id ORDER BY criado_em, id) AS todos
            FROM norm
            WHERE d <> ''
            GROUP BY d
            HAVING count(*) > 1
        )
        SELECT d,
               todos[1]                        AS survivor,
               array_remove(todos, todos[1])   AS losers
        FROM grp
    LOOP
        FOREACH loser IN ARRAY g.losers
        LOOP
            -- Filhas com PK composta: apagar o que colidiria, repontar o resto.
            DELETE FROM public.contato_tags t
             WHERE t.contato_id = loser
               AND EXISTS (SELECT 1 FROM public.contato_tags s
                            WHERE s.contato_id = g.survivor AND s.tag_id = t.tag_id);
            UPDATE public.contato_tags SET contato_id = g.survivor WHERE contato_id = loser;

            DELETE FROM public.contato_campanhas c
             WHERE c.contato_id = loser
               AND EXISTS (SELECT 1 FROM public.contato_campanhas s
                            WHERE s.contato_id = g.survivor AND s.campanha_id = c.campanha_id);
            UPDATE public.contato_campanhas SET contato_id = g.survivor WHERE contato_id = loser;

            -- Filhas com PK própria: repontar direto.
            UPDATE public.vendas           SET contato_id    = g.survivor WHERE contato_id    = loser;
            UPDATE public.cat_pedidos      SET contato_id    = g.survivor WHERE contato_id    = loser;
            UPDATE public.interacoes       SET contato_id    = g.survivor WHERE contato_id    = loser;
            UPDATE public.meta_eventos     SET contato_id    = g.survivor WHERE contato_id    = loser;
            UPDATE public.purchase_orders  SET fornecedor_id = g.survivor WHERE fornecedor_id = loser;
            UPDATE public.contatos         SET indicado_por_id = g.survivor WHERE indicado_por_id = loser;

            -- Consolida os campos do perdedor no sobrevivente antes de apagá-lo.
            UPDATE public.contatos s
               SET nome = CASE
                            WHEN public.fn_count_words(l.nome) > public.fn_count_words(s.nome)
                                 OR (public.fn_count_words(l.nome) = public.fn_count_words(s.nome)
                                     AND length(l.nome) > length(s.nome))
                            THEN l.nome ELSE s.nome
                          END,
                   apelido        = COALESCE(NULLIF(btrim(s.apelido), ''),     NULLIF(btrim(l.apelido), '')),
                   endereco       = COALESCE(NULLIF(btrim(s.endereco), ''),    NULLIF(btrim(l.endereco), '')),
                   cep            = COALESCE(NULLIF(btrim(s.cep), ''),         NULLIF(btrim(l.cep), '')),
                   logradouro     = COALESCE(NULLIF(btrim(s.logradouro), ''),  NULLIF(btrim(l.logradouro), '')),
                   numero         = COALESCE(NULLIF(btrim(s.numero), ''),      NULLIF(btrim(l.numero), '')),
                   complemento    = COALESCE(NULLIF(btrim(s.complemento), ''), NULLIF(btrim(l.complemento), '')),
                   bairro         = COALESCE(NULLIF(btrim(s.bairro), ''),      NULLIF(btrim(l.bairro), '')),
                   cidade         = COALESCE(NULLIF(btrim(s.cidade), ''),      NULLIF(btrim(l.cidade), '')),
                   uf             = COALESCE(NULLIF(btrim(s.uf), ''),          NULLIF(btrim(l.uf), '')),
                   observacoes    = COALESCE(NULLIF(btrim(s.observacoes), ''), NULLIF(btrim(l.observacoes), '')),
                   indicado_por_id = COALESCE(s.indicado_por_id, l.indicado_por_id),
                   fonte          = COALESCE(s.fonte, l.fonte),
                   campanha_id    = COALESCE(s.campanha_id, l.campanha_id),
                   ultimo_contato = GREATEST(s.ultimo_contato, l.ultimo_contato),
                   -- 'cliente' vence 'lead': se qualquer um dos dois comprou, o fundido é cliente.
                   status = CASE
                              WHEN 'cliente' IN (s.status, l.status) THEN 'cliente'
                              ELSE s.status
                            END,
                   atualizado_em = now()
              FROM public.contatos l
             WHERE s.id = g.survivor AND l.id = loser;

            DELETE FROM public.contatos WHERE id = loser;
            fundidos := fundidos + 1;
        END LOOP;
    END LOOP;

    -- Um contato não pode indicar a si mesmo (possível após repontar).
    UPDATE public.contatos SET indicado_por_id = NULL WHERE indicado_por_id = id;

    RAISE NOTICE 'Contatos duplicados fundidos: %', fundidos;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Backfill: `telefone` passa a guardar SOMENTE dígitos
-- ----------------------------------------------------------------------------
UPDATE public.contatos
   SET telefone = regexp_replace(telefone, '\D', '', 'g')
 WHERE telefone ~ '[^0-9]';

-- ----------------------------------------------------------------------------
-- 3. Guarda de sanidade — aborta a migration se ainda sobrar duplicado
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    restantes int;
BEGIN
    SELECT count(*) INTO restantes FROM (
        SELECT regexp_replace(coalesce(telefone, ''), '\D', '', 'g') AS d
        FROM public.contatos
        WHERE coalesce(telefone, '') <> ''
        GROUP BY 1 HAVING count(*) > 1
    ) x;

    IF restantes > 0 THEN
        RAISE EXCEPTION 'Ainda existem % telefones duplicados após a fusão', restantes;
    END IF;
END $$;
