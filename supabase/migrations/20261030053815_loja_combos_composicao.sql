-- ============================================================
-- Loja (apps/loja) · composição dos combos com escolha — SEM sabores
--
-- Decidido (BRIEFING 6.2 + Luccas 30/10): a composição é fixa, só os SABORES
-- estão pendentes (P4). Cria o grupo de escolha de cada combo com título e
-- quantidade, sem nenhuma opção em combo_grupo_opcoes. Enquanto não houver
-- sabores, a loja mostra o grupo com "sabores ainda sendo definidos" e não
-- deixa pôr o combo na sacola.
--
--   Combo Família = balde ×1 + baldinho ×2 (fixos) + 6 doces 680 g à escolha → 9 itens
--   Balde + doce  = balde ×1 (fixo)               + 1 doce 680 g à escolha  → 2 itens
--   3 doces       =                                 3 doces 680 g à escolha → 3 itens
--
-- Fora: Dupla Zero (fixa: 1 DL zero + 1 brigadeiro zero, sem escolha) e Kit Top (pendente).
-- ============================================================

INSERT INTO public.combo_grupos (combo_id, titulo, rotulo_singular, rotulo_plural, quantidade, permite_repetir, ordem)
SELECT p.id, v.titulo, 'doce', 'doces', v.quantidade, true, 1
FROM (VALUES
    ('combo_black_familia',    'Escolha 6 doces de 680 g', 6),
    ('combo_black_balde_doce', 'Escolha 1 doce de 680 g',  1),
    ('combo_black_3_doces',    'Escolha 3 doces de 680 g', 3)
) v(codigo, titulo, quantidade)
JOIN public.produtos p ON p.codigo = v.codigo;

DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM public.combo_grupos;
    IF n <> 3 THEN
        RAISE EXCEPTION 'Composição dos combos: % grupos (esperado 3)', n;
    END IF;
    IF EXISTS (SELECT 1 FROM public.combo_grupo_opcoes) THEN
        RAISE EXCEPTION 'Não deveria haver sabores cadastrados (P4 pendente)';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
