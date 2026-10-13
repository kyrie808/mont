-- Tira o preço escrito no fim da descrição dos produtos ("De R$X por apenas R$Y 🍯").
-- O preço de verdade vem de `preco` / `preco_ancoragem`, que o catálogo já mostra. Preço
-- no texto fica velho: 5 produtos diziam um preço que não era mais o do campo
-- (ex.: Massa 4kg "por apenas R$65" com preco = 75). Só a última linha sai; o resto do
-- texto fica idêntico. Backup CSV das 22 linhas em _dados_analise_ads (13/10/2026).
--
-- Os 2 "Combo Balde" ficam de fora desta migration: qualquer UPDATE neles faz o
-- trigger fn_produtos_set_slug trocar o slug legado (combo_petisco_completo →
-- combo-petisco-completo), e isso depende de decisão à parte.
DO $$
DECLARE
  slugs_antes jsonb;
  n int;
  slugs_mudaram int;
BEGIN
  SELECT jsonb_object_agg(id, slug) INTO slugs_antes FROM public.produtos;

  UPDATE public.produtos
     SET descricao = regexp_replace(descricao, E'\s*\n\s*\n(De R\$[^\n]*|Comprando separado:[^\n]*)\s*$', '')
   WHERE descricao ~ E'\n\s*\n(De R\$|Comprando separado:)[^\n]*\s*$'
     AND id NOT IN ('1337061e-6b9c-4db1-8ee1-4526aaa16107', '1ced78ab-1fa1-4c69-b383-9c7811bf8632');
  GET DIAGNOSTICS n = ROW_COUNT;

  SELECT count(*) INTO slugs_mudaram
    FROM public.produtos p WHERE slugs_antes->>p.id::text IS DISTINCT FROM p.slug;

  IF n <> 20 OR slugs_mudaram <> 0 THEN
    RAISE EXCEPTION 'abortado: % descrições (esperado 20), % slugs mudaram (esperado 0)', n, slugs_mudaram;
  END IF;
END $$;
