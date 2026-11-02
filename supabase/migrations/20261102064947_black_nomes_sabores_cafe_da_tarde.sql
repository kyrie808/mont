-- ============================================================
-- Black da Mont · decisões de 02/11/2026 (decisoes-fase0.md, P4 e P9)
--
-- 1. Nomes novos (só o nome visível; ids, códigos, slugs e vendas antigas ficam):
--      Combo Família → Mesa Cheia · Balde + doce → Par Mineiro · 3 doces → Trio Mineiro
--      Kit Top → Café da Tarde (combo novo, ver 2) · Dupla Zero mantém.
-- 2. Café da Tarde: UM combo com escolha de geleia no lugar dos 3 SKUs "Kit Top — X":
--      2 baldinhos 1 kg + doce de leite tradicional 400 g de brinde (fixos, entram no
--      rateio) + "Escolha 1 geleia de 680 g" (morango ou frutas vermelhas; goiaba fora).
--      Pix 89 · débito 91 · crédito 1x 92 · crédito 2x 95 · âncora 108.
--      Os 3 SKUs antigos ficam INATIVOS (nenhum foi vendido; nada é apagado).
-- 3. Sabores dos grupos de doce 680 g (Mesa Cheia, Par Mineiro, Trio Mineiro), sem geleias:
--      doce de leite tradicional, com coco, com geleia de ameixa, com geleia de café;
--      cocada cremosa, cocada com maracujá; doce de milho.
--      (Era o rascunho supabase/rascunhos/sabores_combos_black.sql.)
-- 4. Âncoras "separado: a partir de": 293 · 94 · 108 · 87 · 78.
--
-- Referências por produtos.codigo. O bloco final confere tudo e aborta a migration
-- inteira se algo não bater. Backup antes: dump-*-20261102-034516.sql.
-- ============================================================

-- 1. Nomes.
UPDATE public.produtos p
   SET nome = v.nome
  FROM (VALUES
    ('combo_black_familia',    'Mesa Cheia (Black)'),
    ('combo_black_balde_doce', 'Par Mineiro (Black)'),
    ('combo_black_3_doces',    'Trio Mineiro (Black)')
  ) v(codigo, nome)
 WHERE p.codigo = v.codigo;

UPDATE public.loja_vitrine lv
   SET nome_loja = v.nome_loja
  FROM (VALUES
    ('combo_black_familia',    'Mesa Cheia'),
    ('combo_black_balde_doce', 'Par Mineiro'),
    ('combo_black_3_doces',    'Trio Mineiro')
  ) v(codigo, nome_loja)
  JOIN public.produtos p ON p.codigo = v.codigo
 WHERE lv.produto_id = p.id;

-- 2. Café da Tarde (preço = Pix da Black, como os outros combos; custo = soma dos fixos).
INSERT INTO public.produtos (nome, codigo, preco, custo, unidade, categoria, eh_combo, ativo, visivel_catalogo, descricao)
SELECT 'Café da Tarde (Black)', 'combo_black_cafe_da_tarde', 89.00,
       (SELECT sum(p.custo * f.qtd)
          FROM (VALUES ('balde_pao_queijo_1kg', 2), ('doce_leite_tradicional_400g', 1)) f(codigo, qtd)
          JOIN public.produtos p ON p.codigo = f.codigo),
       'un', 'combo', true, true, false,
       '2 baldinhos de massa 1 kg + 1 geleia 680 g à escolha (morango ou frutas vermelhas) + doce de leite tradicional 400 g de brinde.';

INSERT INTO public.produto_componentes (combo_id, componente_id, quantidade)
SELECT c.id, p.id, v.qtd
FROM (VALUES
    ('balde_pao_queijo_1kg',        2),
    ('doce_leite_tradicional_400g', 1)
) v(componente, qtd)
JOIN public.produtos c ON c.codigo = 'combo_black_cafe_da_tarde'
JOIN public.produtos p ON p.codigo = v.componente;

INSERT INTO public.combo_grupos (combo_id, titulo, rotulo_singular, rotulo_plural, quantidade, permite_repetir, ordem)
SELECT p.id, 'Escolha 1 geleia de 680 g', 'geleia', 'geleias', 1, true, 1
  FROM public.produtos p WHERE p.codigo = 'combo_black_cafe_da_tarde';

INSERT INTO public.combo_grupo_opcoes (grupo_id, produto_id, ordem)
SELECT g.id, p.id, v.ordem
FROM (VALUES
    ('geleia_morango_680g',          1),
    ('geleia_frutas_vermelhas_680g', 2)
) v(codigo, ordem)
JOIN public.produtos c ON c.codigo = 'combo_black_cafe_da_tarde'
JOIN public.combo_grupos g ON g.combo_id = c.id
JOIN public.produtos p ON p.codigo = v.codigo;

INSERT INTO public.loja_precos (campanha_id, produto_id, preco_pix, preco_debito, preco_credito_1x, preco_credito_2x, ancora)
SELECT c.id, p.id, 89.00, 91.00, 92.00, 95.00, 108.00
  FROM public.produtos p
 CROSS JOIN (SELECT id FROM public.loja_campanhas WHERE nome = 'Black da Mont 2026') c
 WHERE p.codigo = 'combo_black_cafe_da_tarde';

INSERT INTO public.loja_vitrine (produto_id, secao, ordem, visivel, usa_estoque, destaque_hero, leva_junto, nome_loja, resumo)
SELECT p.id, 'combos', 3, true, false, false, false, 'Café da Tarde',
       '2 baldinhos 1 kg + 1 geleia 680 g à escolha + doce de leite 400 g de brinde'
  FROM public.produtos p WHERE p.codigo = 'combo_black_cafe_da_tarde';

UPDATE public.produtos
   SET ativo = false
 WHERE codigo IN ('combo_black_kit_top_morango', 'combo_black_kit_top_frutas_vermelhas', 'combo_black_kit_top_goiaba');

-- 3. Sabores dos grupos de doce 680 g.
INSERT INTO public.combo_grupo_opcoes (grupo_id, produto_id, ordem)
SELECT g.id, p.id, s.ordem
  FROM public.combo_grupos g
  JOIN public.produtos c ON c.id = g.combo_id
   AND c.codigo IN ('combo_black_familia', 'combo_black_balde_doce', 'combo_black_3_doces')
 CROSS JOIN (VALUES
    ('doce_leite_tradicional_680g', 1),
    ('doce_leite_coco_680g',        2),
    ('doce_leite_ameixa_680g',      3),
    ('doce_leite_cafe_680g',        4),
    ('cocada_cremosa_680g',         5),
    ('cocada_maracuja_680g',        6),
    ('doce_milho_680g',             7)
 ) s(codigo, ordem)
  JOIN public.produtos p ON p.codigo = s.codigo;

-- 4. Âncoras.
UPDATE public.loja_precos lp
   SET ancora = v.ancora
  FROM (VALUES
    ('combo_black_familia',    293.00),
    ('combo_black_balde_doce',  94.00),
    ('combo_black_3_doces',     87.00),
    ('combo_black_dupla_zero',  78.00)
  ) v(codigo, ancora)
  JOIN public.produtos p ON p.codigo = v.codigo
 WHERE lp.produto_id = p.id
   AND lp.campanha_id = (SELECT id FROM public.loja_campanhas WHERE nome = 'Black da Mont 2026');

-- Conferência: aborta tudo se algo não casou.
DO $$
DECLARE
    n_nomes int; n_vitrine_nomes int; n_cafe_fixos int; n_cafe_geleias int; n_doces int;
    n_geleias_em_doces int; n_ancoras int; n_kit_top_ativos int; n_precos int; n_vitrine int;
BEGIN
    SELECT count(*) INTO n_nomes FROM public.produtos
     WHERE (codigo, nome) IN (('combo_black_familia', 'Mesa Cheia (Black)'), ('combo_black_balde_doce', 'Par Mineiro (Black)'),
                              ('combo_black_3_doces', 'Trio Mineiro (Black)'), ('combo_black_cafe_da_tarde', 'Café da Tarde (Black)'),
                              ('combo_black_dupla_zero', 'Dupla Zero (Black)'));
    SELECT count(*) INTO n_vitrine_nomes FROM public.loja_vitrine
     WHERE nome_loja IN ('Mesa Cheia', 'Par Mineiro', 'Trio Mineiro', 'Café da Tarde', 'Dupla Zero');
    SELECT count(*) INTO n_cafe_fixos FROM public.produto_componentes pc
      JOIN public.produtos c ON c.id = pc.combo_id WHERE c.codigo = 'combo_black_cafe_da_tarde';
    SELECT count(*) INTO n_cafe_geleias FROM public.combo_grupo_opcoes o
      JOIN public.combo_grupos g ON g.id = o.grupo_id JOIN public.produtos c ON c.id = g.combo_id
     WHERE c.codigo = 'combo_black_cafe_da_tarde';
    SELECT count(*) INTO n_doces FROM public.combo_grupo_opcoes o
      JOIN public.combo_grupos g ON g.id = o.grupo_id JOIN public.produtos c ON c.id = g.combo_id
     WHERE c.codigo IN ('combo_black_familia', 'combo_black_balde_doce', 'combo_black_3_doces');
    SELECT count(*) INTO n_geleias_em_doces FROM public.combo_grupo_opcoes o
      JOIN public.combo_grupos g ON g.id = o.grupo_id JOIN public.produtos c ON c.id = g.combo_id
      JOIN public.produtos p ON p.id = o.produto_id
     WHERE c.codigo IN ('combo_black_familia', 'combo_black_balde_doce', 'combo_black_3_doces')
       AND p.codigo LIKE 'geleia%';
    SELECT count(*) INTO n_ancoras FROM public.loja_precos lp JOIN public.produtos p ON p.id = lp.produto_id
     WHERE (p.codigo, lp.ancora) IN (('combo_black_familia', 293), ('combo_black_balde_doce', 94), ('combo_black_cafe_da_tarde', 108),
                                     ('combo_black_3_doces', 87), ('combo_black_dupla_zero', 78));
    SELECT count(*) INTO n_kit_top_ativos FROM public.produtos WHERE codigo LIKE 'combo_black_kit_top%' AND ativo;
    SELECT count(*) INTO n_precos FROM public.loja_precos;
    SELECT count(*) INTO n_vitrine FROM public.loja_vitrine;

    IF n_nomes <> 5 OR n_vitrine_nomes <> 5 OR n_cafe_fixos <> 2 OR n_cafe_geleias <> 2 OR n_doces <> 21
       OR n_geleias_em_doces <> 0 OR n_ancoras <> 5 OR n_kit_top_ativos <> 0 OR n_precos <> 22 OR n_vitrine <> 22 THEN
        RAISE EXCEPTION 'Decisões de 02/11 incompletas: nomes=% (5) vitrine=% (5) cafe_fixos=% (2) cafe_geleias=% (2) doces=% (21) geleias_em_doces=% (0) ancoras=% (5) kit_top_ativos=% (0) precos=% (22) vitrine=% (22)',
            n_nomes, n_vitrine_nomes, n_cafe_fixos, n_cafe_geleias, n_doces, n_geleias_em_doces, n_ancoras, n_kit_top_ativos, n_precos, n_vitrine;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
