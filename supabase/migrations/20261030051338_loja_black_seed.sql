-- ============================================================
-- Loja (apps/loja) · Fase 1 · seed da Black da Mont 2026 — SÓ o que está DECIDIDO
-- (docs/loja-black/decisoes-fase0.md + BRIEFING.md seção 6).
--
-- Entra:
--   1. Os 3 combos que ainda não existiam como produto (Combo Família,
--      Balde + doce, 3 doces), com os itens FIXOS em produto_componentes.
--      Sem grupos de sabor: estão PENDENTES (P4).
--   2. Campanha "Black da Mont 2026": 03/11 00:00 → 30/11 23:59:59 (SP).
--   3. Preços Pix e crédito 1x dos avulsos e dos combos (P3), exceto Kit Top.
--      Débito, 2x e âncora dos combos ficam NULL (tabela/regra pendentes).
--   4. Vitrine: seções, ordem, hero (Combo Família), "Leva junto?" (doce de
--      leite tradicional 400 g, P13), doces de P11/P12. Congelados fora.
--
-- NÃO entra (PENDENTE GILMAR): grupos de sabor, Kit Top (preço e SKUs) e a
-- tabela de bairros. Os 3 SKUs "Kit Top — X (Black)" ficam como estão.
--
-- Referências por produtos.codigo (nenhum id fixo). Um bloco no fim confere
-- as contagens e aborta a migration inteira se algo não bater.
-- ============================================================

-- 1. Combos novos (preço = Pix da Black; custo = soma dos itens fixos).
INSERT INTO public.produtos (nome, codigo, preco, custo, unidade, categoria, eh_combo, ativo, visivel_catalogo, descricao)
SELECT v.nome, v.codigo, v.preco,
       COALESCE((SELECT sum(p.custo * f.qtd)
                 FROM (VALUES ('balde_pao_queijo_4kg', v.qtd_balde), ('balde_pao_queijo_1kg', v.qtd_baldinho)) f(codigo, qtd)
                 JOIN public.produtos p ON p.codigo = f.codigo), 0),
       'un', 'combo', true, true, false, v.descricao
FROM (VALUES
    ('Combo Família (Black)', 'combo_black_familia',    199.00, 1, 2, 'Balde de massa 4 kg + 2 baldinhos de massa 1 kg + 6 doces 680 g à escolha.'),
    ('Balde + doce (Black)',  'combo_black_balde_doce',  85.00, 1, 0, 'Balde de massa 4 kg + 1 doce 680 g à escolha.'),
    ('3 doces (Black)',       'combo_black_3_doces',     79.00, 0, 0, '3 doces 680 g à escolha.')
) v(nome, codigo, preco, qtd_balde, qtd_baldinho, descricao);

-- Itens fixos (os doces à escolha entram como grupo, quando definidos).
INSERT INTO public.produto_componentes (combo_id, componente_id, quantidade)
SELECT c.id, p.id, v.qtd
FROM (VALUES
    ('combo_black_familia',    'balde_pao_queijo_4kg', 1),
    ('combo_black_familia',    'balde_pao_queijo_1kg', 2),
    ('combo_black_balde_doce', 'balde_pao_queijo_4kg', 1)
) v(combo, componente, qtd)
JOIN public.produtos c ON c.codigo = v.combo
JOIN public.produtos p ON p.codigo = v.componente;

-- 2. Campanha.
INSERT INTO public.loja_campanhas (nome, inicio, fim)
VALUES ('Black da Mont 2026', '2026-11-03 00:00:00-03', '2026-11-30 23:59:59-03');

-- 3. Preços (Pix → crédito 1x).
INSERT INTO public.loja_precos (campanha_id, produto_id, preco_pix, preco_credito_1x)
SELECT c.id, p.id, v.pix, v.credito
FROM (VALUES
    -- Massa
    ('balde_pao_queijo_4kg',          65.00,  68.00),
    ('balde_pao_queijo_1kg',          27.00,  28.00),
    -- Doces 680 g
    ('doce_leite_tradicional_680g',   29.00,  30.00),
    ('doce_leite_coco_680g',          29.00,  30.00),
    ('doce_leite_ameixa_680g',        29.00,  30.00),
    ('doce_leite_cafe_680g',          29.00,  30.00),
    ('cocada_cremosa_680g',           29.00,  30.00),
    ('cocada_maracuja_680g',          29.00,  30.00),
    ('doce_milho_680g',               29.00,  30.00),
    -- Geleias 680 g
    ('geleia_morango_680g',           33.00,  35.00),
    ('geleia_frutas_vermelhas_680g',  35.00,  37.00),
    ('geleia_goiaba_680g',            25.00,  26.00),
    -- Doces 400 g (P11)
    ('doce_leite_tradicional_400g',   21.00,  22.00),
    ('doce_leite_coco_400g',          21.00,  22.00),
    ('ambrosia_400g',                 21.00,  22.00),
    -- Zero 400 g
    ('doce_leite_zero_400g',          39.00,  41.00),
    ('brigadeiro_zero_400g',          39.00,  41.00),
    -- Combos (Kit Top pendente)
    ('combo_black_familia',          199.00, 206.00),
    ('combo_black_balde_doce',        85.00,  88.00),
    ('combo_black_3_doces',           79.00,  82.00),
    ('combo_black_dupla_zero',        75.00,  78.00)
) v(codigo, pix, credito)
JOIN public.produtos p ON p.codigo = v.codigo
CROSS JOIN (SELECT id FROM public.loja_campanhas WHERE nome = 'Black da Mont 2026') c;

-- 4. Vitrine.
INSERT INTO public.loja_vitrine (produto_id, secao, ordem, visivel, usa_estoque, destaque_hero, leva_junto, nome_loja, resumo)
SELECT p.id, v.secao, v.ordem, true, v.usa_estoque, v.hero, v.leva_junto, v.nome_loja, v.resumo
FROM (VALUES
    -- Combos (Kit Top entra quando o preço e os sabores forem decididos)
    ('combo_black_familia',          'combos', 1, false, true,  false, 'Combo Família', 'Balde 4 kg + 2 baldinhos 1 kg + 6 doces 680 g à escolha'),
    ('combo_black_balde_doce',       'combos', 2, false, false, false, 'Balde + doce',  'Balde 4 kg + 1 doce 680 g à escolha'),
    ('combo_black_3_doces',          'combos', 4, false, false, false, '3 doces',       '3 doces 680 g à escolha'),
    ('combo_black_dupla_zero',       'combos', 5, false, false, false, 'Dupla Zero',    '2 doces zero 400 g à escolha'),
    -- Massa (só a chave manual)
    ('balde_pao_queijo_4kg',         'massa',  1, false, false, false, NULL, NULL),
    ('balde_pao_queijo_1kg',         'massa',  2, false, false, false, NULL, NULL),
    -- Doces (chave + estoque)
    ('doce_leite_tradicional_680g',  'doces',  1, true,  false, false, NULL, NULL),
    ('doce_leite_coco_680g',         'doces',  2, true,  false, false, NULL, NULL),
    ('cocada_cremosa_680g',          'doces',  3, true,  false, false, NULL, NULL),
    ('doce_leite_ameixa_680g',       'doces',  4, true,  false, false, NULL, NULL),
    ('doce_milho_680g',              'doces',  5, true,  false, false, NULL, NULL),
    ('cocada_maracuja_680g',         'doces',  6, true,  false, false, NULL, NULL),
    ('doce_leite_cafe_680g',         'doces',  7, true,  false, false, NULL, NULL),
    ('geleia_morango_680g',          'doces',  8, true,  false, false, NULL, NULL),
    ('geleia_frutas_vermelhas_680g', 'doces',  9, true,  false, false, NULL, NULL),
    ('geleia_goiaba_680g',           'doces', 10, true,  false, false, NULL, NULL),
    ('doce_leite_tradicional_400g',  'doces', 11, true,  false, true,  NULL, NULL),
    ('doce_leite_coco_400g',         'doces', 12, true,  false, false, NULL, NULL),
    ('ambrosia_400g',                'doces', 13, true,  false, false, NULL, NULL),
    -- Zero
    ('doce_leite_zero_400g',         'zero',   1, true,  false, false, NULL, NULL),
    ('brigadeiro_zero_400g',         'zero',   2, true,  false, false, NULL, NULL)
) v(codigo, secao, ordem, usa_estoque, hero, leva_junto, nome_loja, resumo)
JOIN public.produtos p ON p.codigo = v.codigo;

-- Conferência: aborta tudo se alguma referência por código não casou.
DO $$
DECLARE
    n_combos int; n_fixos int; n_camp int; n_precos int; n_vitrine int;
BEGIN
    SELECT count(*) INTO n_combos FROM public.produtos
     WHERE codigo IN ('combo_black_familia', 'combo_black_balde_doce', 'combo_black_3_doces') AND eh_combo;
    SELECT count(*) INTO n_fixos FROM public.produto_componentes pc JOIN public.produtos c ON c.id = pc.combo_id
     WHERE c.codigo IN ('combo_black_familia', 'combo_black_balde_doce', 'combo_black_3_doces');
    SELECT count(*) INTO n_camp FROM public.loja_campanhas;
    SELECT count(*) INTO n_precos FROM public.loja_precos;
    SELECT count(*) INTO n_vitrine FROM public.loja_vitrine;

    IF n_combos <> 3 OR n_fixos <> 3 OR n_camp <> 1 OR n_precos <> 21 OR n_vitrine <> 21 THEN
        RAISE EXCEPTION 'Seed da Black incompleto: combos=% (3) fixos=% (3) campanhas=% (1) precos=% (21) vitrine=% (21)',
            n_combos, n_fixos, n_camp, n_precos, n_vitrine;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
