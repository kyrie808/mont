-- Suíte: galeria de fotos do produto — salvar_fotos_produto (Parte D da paridade da loja,
-- migração 20261104150300, 04/11/2026).
--
-- PADRÃO "TRANSAÇÃO DESCARTADA": um DO-block que SEMPRE termina em RAISE EXCEPTION; nada é gravado.
-- Produto fictício com o código 'tmp_suite_fotos'. Roda como a CONTA-TESTE (admin), como o sistema interno.
-- Nenhum trigger faz HTTP e nenhuma sequência visível é usada.
--   SUITE_OK     fotos_produto 8/8 | [...]

DO $suite$
DECLARE
  c_uid_teste constant uuid := '627bc83a-8e02-4949-ab6b-7efae29c4ac5';
  c_base constant text := 'https://herlvujykltxnwqmwmyx.supabase.co/storage/v1/object/public/products/';
  c_codigo constant text := 'tmp_suite_fotos';

  resultados jsonb := '[]'::jsonb;
  passou int := 0;
  casos int := 0;
  antes jsonb;
  depois jsonb;
  v_prod uuid;
  v_ok boolean;
  v_det text;
BEGIN
  antes := jsonb_build_object(
    'produtos', (SELECT count(*) FROM public.produtos),
    'cat_imagens', (SELECT count(*) FROM public.cat_imagens_produto),
    'sis_imagens', (SELECT count(*) FROM public.sis_imagens_produto)
  );
  IF EXISTS (SELECT 1 FROM public.produtos WHERE codigo = c_codigo) THEN
    RAISE EXCEPTION 'SUITE_ABORTADA: já existe produto com o código fictício %', c_codigo;
  END IF;

  INSERT INTO public.produtos (nome, codigo, preco, custo, slug, ativo, visivel_catalogo)
  VALUES ('Produto Suite Fotos', c_codigo, 10, 5, 'tmp-suite-fotos', true, true)
  RETURNING id INTO v_prod;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM c_uid_teste THEN RAISE EXCEPTION 'SUITE_ABORTADA: auth.uid() não é a conta-teste'; END IF;

  -- ── G1: 3 fotos → 3 linhas na ordem, a 1ª é a capa e vai para sis_imagens_produto ──
  casos := casos + 1;
  BEGIN
    PERFORM public.salvar_fotos_produto(v_prod, ARRAY[c_base || 'a.webp', c_base || 'b.webp', c_base || 'c.webp']);
    SELECT string_agg(right(url, 6) || ':' || tipo || ':' || ordem, ',' ORDER BY ordem) INTO v_det
      FROM public.cat_imagens_produto WHERE produto_id = v_prod;
    v_ok := v_det = 'a.webp:cover:0,b.webp:detail:1,c.webp:detail:2'
      AND (SELECT url FROM public.sis_imagens_produto WHERE produto_id = v_prod) = c_base || 'a.webp';
    resultados := resultados || jsonb_build_object('caso', 'G1 tres fotos, 1a = capa', 'ok', v_ok, 'det', v_det);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G1', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── G2: nova ordem (c vira capa) → capa e sis acompanham; a vitrine antiga lê a capa nova ──
  casos := casos + 1;
  BEGIN
    PERFORM public.salvar_fotos_produto(v_prod, ARRAY[c_base || 'c.webp', c_base || 'a.webp', c_base || 'b.webp']);
    SELECT string_agg(right(url, 6) || ':' || tipo, ',' ORDER BY ordem) INTO v_det
      FROM public.cat_imagens_produto WHERE produto_id = v_prod;
    v_ok := v_det = 'c.webp:cover,a.webp:detail,b.webp:detail'
      AND (SELECT url FROM public.sis_imagens_produto WHERE produto_id = v_prod) = c_base || 'c.webp'
      AND (SELECT url_imagem_principal FROM public.vw_catalogo_produtos WHERE id = v_prod) = c_base || 'c.webp'
      AND (SELECT json_array_length(imagens) FROM public.vw_catalogo_produtos WHERE id = v_prod) = 3;
    resultados := resultados || jsonb_build_object('caso', 'G2 reordenar troca a capa', 'ok', v_ok, 'det', v_det);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G2', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── G3: foto de fora do bucket é recusada e a galeria fica como estava ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.salvar_fotos_produto(v_prod, ARRAY['https://exemplo.com/x.webp']);
      v_ok := false;
    EXCEPTION WHEN invalid_parameter_value THEN
      v_ok := (SELECT count(*) FROM public.cat_imagens_produto WHERE produto_id = v_prod) = 3;
    END;
    resultados := resultados || jsonb_build_object('caso', 'G3 fora do bucket recusada', 'ok', v_ok);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G3', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── G4: a mesma foto duas vezes é recusada ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.salvar_fotos_produto(v_prod, ARRAY[c_base || 'a.webp', c_base || 'a.webp']);
      v_ok := false;
    EXCEPTION WHEN invalid_parameter_value THEN
      v_ok := true;
    END;
    resultados := resultados || jsonb_build_object('caso', 'G4 repetida recusada', 'ok', v_ok);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G4', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── G5: mais de 12 fotos é recusado ──
  casos := casos + 1;
  BEGIN
    BEGIN
      PERFORM public.salvar_fotos_produto(v_prod, ARRAY(SELECT c_base || g || '.webp' FROM generate_series(1, 13) g));
      v_ok := false;
    EXCEPTION WHEN invalid_parameter_value THEN
      v_ok := true;
    END;
    resultados := resultados || jsonb_build_object('caso', 'G5 limite de 12', 'ok', v_ok);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G5', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── G6: lista vazia = sem foto nas duas tabelas ──
  casos := casos + 1;
  BEGIN
    PERFORM public.salvar_fotos_produto(v_prod, ARRAY[]::text[]);
    v_ok := NOT EXISTS (SELECT 1 FROM public.cat_imagens_produto WHERE produto_id = v_prod)
      AND NOT EXISTS (SELECT 1 FROM public.sis_imagens_produto WHERE produto_id = v_prod);
    resultados := resultados || jsonb_build_object('caso', 'G6 lista vazia limpa', 'ok', v_ok);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G6', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── G7: usuário logado que não é admin é barrado ──
  casos := casos + 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.salvar_fotos_produto(v_prod, ARRAY[c_base || 'a.webp']);
      v_ok := false;
    EXCEPTION WHEN insufficient_privilege THEN
      v_ok := true;
    END;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_uid_teste, 'role', 'authenticated')::text, true);
    resultados := resultados || jsonb_build_object('caso', 'G7 nao-admin barrado', 'ok', v_ok);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G7', 'ok', false, 'erro', SQLERRM);
  END;

  -- ── G8: chave pública (anon) não pode nem chamar ──
  casos := casos + 1;
  BEGIN
    v_ok := NOT has_function_privilege('anon', 'public.salvar_fotos_produto(uuid, text[])', 'execute')
      AND has_function_privilege('authenticated', 'public.salvar_fotos_produto(uuid, text[])', 'execute');
    resultados := resultados || jsonb_build_object('caso', 'G8 anon sem execute', 'ok', v_ok);
    IF v_ok THEN passou := passou + 1; END IF;
  EXCEPTION WHEN others THEN
    resultados := resultados || jsonb_build_object('caso', 'G8', 'ok', false, 'erro', SQLERRM);
  END;

  RESET ROLE;
  depois := jsonb_build_object(
    'produtos', (SELECT count(*) FROM public.produtos),
    'cat_imagens', (SELECT count(*) FROM public.cat_imagens_produto),
    'sis_imagens', (SELECT count(*) FROM public.sis_imagens_produto)
  );

  RAISE EXCEPTION '% fotos_produto %/% | contagens_antes=% | dentro_da_transacao=% | %',
    CASE WHEN passou = casos THEN 'SUITE_OK' ELSE 'SUITE_FALHOU' END,
    passou, casos, antes, depois, resultados;
END
$suite$;
