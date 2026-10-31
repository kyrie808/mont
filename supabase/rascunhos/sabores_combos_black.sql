-- RASCUNHO — sabores dos combos da Black (Combo Família, Balde + doce, 3 doces).
--
-- PENDENTE GILMAR (decisoes-fase0.md, P4). Enquanto ele não decidir, os três combos aparecem
-- na Nova Venda e na loja como "Sabores em definição" e não podem ser vendidos (a combo_itens
-- recusa grupo sem opções).
--
-- COMO APLICAR, depois da decisão:
--   1. Ajustar a lista `sabores` abaixo para a decisão final (nomes exatos de `produtos.nome`).
--   2. Apagar o bloco TRAVA.
--   3. Backup (supabase/scripts/dump-prod.ps1) e aplicar como MIGRATION versionada
--      (apply_migration), não pelo Studio. O mesmo conteúdo vale para a loja e a Nova Venda.
--   4. Conferir: SELECT g.titulo, count(o.*) FROM combo_grupos g
--                LEFT JOIN combo_grupo_opcoes o ON o.grupo_id = g.id GROUP BY 1;
--
-- A lista abaixo é a RECOMENDAÇÃO da P4 (geleias fora dos doces 680 g), não a decisão.

-- ── TRAVA: remova este bloco só depois da decisão do Gilmar ──
DO $$ BEGIN
  RAISE EXCEPTION 'Rascunho: confirme os sabores com o Gilmar e remova esta trava antes de aplicar.';
END $$;

DO $$
DECLARE
  sabores text[] := ARRAY[
    'Doce de Leite Tradicional 680g',
    'Doce de Leite com Coco 680g',
    'Doce de Leite com Geleia de Ameixa 680g',
    'Doce de Leite com Geleia de Café 680g',
    'Cocada Cremosa 680g',
    'Cocada Cremosa com Maracujá 680g',
    'Doce de Milho 680g'
  ];
  combos text[] := ARRAY['Combo Família (Black)', 'Balde + doce (Black)', '3 doces (Black)'];
  faltando text[];
  n int;
BEGIN
  SELECT array_agg(s) INTO faltando
    FROM unnest(sabores) s
   WHERE NOT EXISTS (SELECT 1 FROM public.produtos p WHERE p.nome = s AND p.ativo);
  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Sabores sem produto ativo com esse nome: %', faltando;
  END IF;

  INSERT INTO public.combo_grupo_opcoes (grupo_id, produto_id, ordem)
  SELECT g.id, p.id, t.ordem
    FROM public.combo_grupos g
    JOIN public.produtos c ON c.id = g.combo_id AND c.nome = ANY (combos)
   CROSS JOIN unnest(sabores) WITH ORDINALITY AS t(nome, ordem)
    JOIN public.produtos p ON p.nome = t.nome
  ON CONFLICT (grupo_id, produto_id) DO NOTHING;

  SELECT count(*) INTO n
    FROM public.combo_grupo_opcoes o
    JOIN public.combo_grupos g ON g.id = o.grupo_id
    JOIN public.produtos c ON c.id = g.combo_id AND c.nome = ANY (combos);
  IF n <> array_length(sabores, 1) * array_length(combos, 1) THEN
    RAISE EXCEPTION 'Esperadas % opções, ficaram %', array_length(sabores, 1) * array_length(combos, 1), n;
  END IF;
END $$;
