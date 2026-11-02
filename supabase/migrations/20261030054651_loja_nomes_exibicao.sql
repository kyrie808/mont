-- ============================================================
-- Loja (apps/loja) · nomes de exibição na loja (loja_vitrine.nome_loja)
-- Lista aprovada pelo Luccas em 30/10/2026 (baldes: "Balde de massa 4 kg" e "Baldinho de massa 1 kg").
--
-- produtos.nome não muda (Jarvis e catálogo seguem iguais). Massa ganha nome de
-- vitrine; doces mantêm o nome do banco em caixa de frase, com "680 g"/"400 g".
-- Combos já têm nome_loja desde o seed (Combo Família, Balde + doce, 3 doces, Dupla Zero).
-- ============================================================

UPDATE public.loja_vitrine v
SET nome_loja = n.nome
FROM (VALUES
    ('balde_pao_queijo_4kg',         'Balde de massa 4 kg'),
    ('balde_pao_queijo_1kg',         'Baldinho de massa 1 kg'),
    ('doce_leite_tradicional_680g',  'Doce de leite tradicional 680 g'),
    ('doce_leite_coco_680g',         'Doce de leite com coco 680 g'),
    ('cocada_cremosa_680g',          'Cocada cremosa 680 g'),
    ('doce_leite_ameixa_680g',       'Doce de leite com geleia de ameixa 680 g'),
    ('doce_milho_680g',              'Doce de milho 680 g'),
    ('cocada_maracuja_680g',         'Cocada cremosa com maracujá 680 g'),
    ('doce_leite_cafe_680g',         'Doce de leite com geleia de café 680 g'),
    ('geleia_morango_680g',          'Geleia de morango 680 g'),
    ('geleia_frutas_vermelhas_680g', 'Geleia de frutas vermelhas 680 g'),
    ('geleia_goiaba_680g',           'Geleia de goiaba 680 g'),
    ('doce_leite_tradicional_400g',  'Doce de leite tradicional 400 g'),
    ('doce_leite_coco_400g',         'Doce de leite com coco 400 g'),
    ('ambrosia_400g',                'Ambrosia 400 g'),
    ('doce_leite_zero_400g',         'Doce de leite zero 400 g'),
    ('brigadeiro_zero_400g',         'Brigadeiro de colher zero 400 g')
) n(codigo, nome)
JOIN public.produtos p ON p.codigo = n.codigo
WHERE v.produto_id = p.id;

-- Dupla Zero passou a ser FIXA (decisões P4, 30/10): o texto do card deixa de dizer "à escolha".
UPDATE public.loja_vitrine v
SET resumo = 'Doce de leite zero 400 g + brigadeiro de colher zero 400 g'
FROM public.produtos p
WHERE p.id = v.produto_id AND p.codigo = 'combo_black_dupla_zero';

DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM public.loja_vitrine WHERE nome_loja IS NOT NULL;
    IF n <> 21 THEN
        RAISE EXCEPTION 'Nomes da loja: % com nome_loja (esperado 21)', n;
    END IF;
END $$;
