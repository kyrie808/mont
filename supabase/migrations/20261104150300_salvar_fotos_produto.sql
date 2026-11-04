-- Galeria de fotos do produto (Parte D da paridade da loja, 04/11/2026).
--
-- O banco já guarda várias fotos por produto em cat_imagens_produto (ordem + tipo 'cover'), e a loja
-- e o catálogo antigo (vw_catalogo_produtos) já leem a capa de lá. Faltava gravar a galeria: a
-- add_image_reference APAGA todas as fotos do produto antes de gravar uma, então não serve para várias.
--
-- salvar_fotos_produto(produto, fotos em ordem) substitui a galeria inteira numa transação (tudo ou nada):
--   - a 1ª foto é a capa (tipo 'cover', ordem 0); as demais 'detail', na ordem recebida;
--   - a capa é copiada para sis_imagens_produto (1 por produto, usada nas listas do sistema interno);
--   - lista vazia = produto sem foto.
-- Só admin (guard is_admin interno, como add_image_reference) ou service_role. Só aceita fotos do
-- bucket público 'products' do projeto, sem repetição, no máximo 12. Nenhuma tabela ou coluna muda;
-- add_image_reference e delete_image_reference ficam como estão.

CREATE OR REPLACE FUNCTION public.salvar_fotos_produto(p_produto_id uuid, p_urls text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_prefixo constant text := 'https://herlvujykltxnwqmwmyx.supabase.co/storage/v1/object/public/products/';
  v_urls text[] := COALESCE(p_urls, '{}'::text[]);
  v_n int := cardinality(COALESCE(p_urls, '{}'::text[]));
BEGIN
  IF NOT (SELECT public.is_admin()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
  END IF;

  -- Trava o produto: dois salvamentos ao mesmo tempo não se misturam.
  PERFORM 1 FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_n > 12 THEN
    RAISE EXCEPTION 'No máximo 12 fotos por produto' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_urls) AS u
     WHERE u IS NULL
        OR left(u, length(c_prefixo)) <> c_prefixo
        OR length(u) = length(c_prefixo)
        OR u ~ '[[:space:]"''<>\\]'
  ) THEN
    RAISE EXCEPTION 'Foto fora do armazenamento de produtos' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT u) FROM unnest(v_urls) AS u) <> v_n THEN
    RAISE EXCEPTION 'A mesma foto aparece duas vezes' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.cat_imagens_produto WHERE produto_id = p_produto_id;
  INSERT INTO public.cat_imagens_produto (produto_id, url, tipo, ordem, ativo)
  SELECT p_produto_id, t.u, CASE WHEN t.o = 1 THEN 'cover' ELSE 'detail' END, (t.o - 1)::int, true
    FROM unnest(v_urls) WITH ORDINALITY AS t(u, o);

  DELETE FROM public.sis_imagens_produto WHERE produto_id = p_produto_id;
  IF v_n > 0 THEN
    INSERT INTO public.sis_imagens_produto (produto_id, url, tipo, ordem, ativo)
    VALUES (p_produto_id, v_urls[1], 'internal', 0, true);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.salvar_fotos_produto(uuid, text[]) IS
  'Galeria do produto: substitui as fotos (1ª = capa) em cat_imagens_produto e copia a capa para sis_imagens_produto. Só admin.';

REVOKE ALL ON FUNCTION public.salvar_fotos_produto(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_fotos_produto(uuid, text[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
