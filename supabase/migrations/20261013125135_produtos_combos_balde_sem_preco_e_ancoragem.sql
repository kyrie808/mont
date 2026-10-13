-- Combos Balde: tira o preço escrito ("Comprando separado: R$100,00 …") e preenche o
-- preco_ancoragem com a soma real dos itens separados, pelos preços de 13/10/2026:
--   Combo Balde 4kg + Palito 1kg          = Massa 4kg 75 + Palito 1kg 40      = 115 (combo 95)
--   Combo Balde 4kg + Pão de Queijo 1kg   = Massa 4kg 75 + Pão de Queijo 1kg 30 = 105 (combo 85)
-- O texto antigo dizia 100 e 90 ("comprando separado"), que eram os preços de antes.
--
-- Efeito aceito pelo diretor: o trigger fn_produtos_set_slug normaliza o slug legado em
-- qualquer UPDATE (combo_petisco_completo → combo-petisco-completo; combo_familia_feliz →
-- combo-familia-feliz). Os dois estão fora do catálogo e nada referencia o slug antigo.
DO $$
DECLARE
  slugs_antes jsonb;
  n int;
  outros_slugs int;
  ok_ancoragem int;
  com_preco int;
BEGIN
  SELECT jsonb_object_agg(id, slug) INTO slugs_antes FROM public.produtos;

  UPDATE public.produtos
     SET descricao = regexp_replace(descricao, E'\s*\n\s*\n(De R\$[^\n]*|Comprando separado:[^\n]*)\s*$', ''),
         preco_ancoragem = CASE id
           WHEN '1337061e-6b9c-4db1-8ee1-4526aaa16107' THEN 115
           WHEN '1ced78ab-1fa1-4c69-b383-9c7811bf8632' THEN 105
         END
   WHERE id IN ('1337061e-6b9c-4db1-8ee1-4526aaa16107', '1ced78ab-1fa1-4c69-b383-9c7811bf8632')
     AND preco_ancoragem IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  SELECT count(*) INTO outros_slugs FROM public.produtos p
   WHERE slugs_antes->>p.id::text IS DISTINCT FROM p.slug
     AND p.id NOT IN ('1337061e-6b9c-4db1-8ee1-4526aaa16107', '1ced78ab-1fa1-4c69-b383-9c7811bf8632');

  SELECT count(*) INTO ok_ancoragem FROM public.produtos
   WHERE (id = '1337061e-6b9c-4db1-8ee1-4526aaa16107' AND preco_ancoragem = 115 AND slug = 'combo-petisco-completo')
      OR (id = '1ced78ab-1fa1-4c69-b383-9c7811bf8632' AND preco_ancoragem = 105 AND slug = 'combo-familia-feliz');

  SELECT count(*) INTO com_preco FROM public.produtos WHERE descricao ~ 'R\$';

  IF n <> 2 OR outros_slugs <> 0 OR ok_ancoragem <> 2 OR com_preco <> 0 THEN
    RAISE EXCEPTION 'abortado: linhas=% (esperado 2), outros slugs mudaram=% (esperado 0), ancoragem+slug ok=% (esperado 2), descricoes com R$=% (esperado 0)',
      n, outros_slugs, ok_ancoragem, com_preco;
  END IF;
END $$;
