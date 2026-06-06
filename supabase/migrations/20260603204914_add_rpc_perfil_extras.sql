CREATE OR REPLACE FUNCTION public.rpc_perfil_extras(p_contato_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ultimo_produto text;
  v_fiado_estado   text;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RETURN NULL;
  END IF;

  SELECT p.nome INTO v_ultimo_produto
  FROM vendas v
  JOIN itens_venda iv ON iv.venda_id = v.id
  JOIN produtos p ON p.id = iv.produto_id
  WHERE v.contato_id = p_contato_id
    AND v.status = 'entregue'
    AND v.forma_pagamento <> 'brinde'
  ORDER BY v.data DESC, v.criado_em DESC
  LIMIT 1;

  SELECT CASE
    WHEN k.aba_atual = 'cobranca' THEN 'em_aberto'
    WHEN EXISTS (
      SELECT 1 FROM vendas v2
      WHERE v2.contato_id = p_contato_id
        AND v2.forma_pagamento = 'fiado'
    ) THEN 'quitou'
    ELSE 'nunca_usou'
  END
  INTO v_fiado_estado
  FROM view_relacionamento_kanban k
  WHERE k.contato_id = p_contato_id;

  IF v_fiado_estado IS NULL THEN
    v_fiado_estado := CASE
      WHEN EXISTS (
        SELECT 1 FROM vendas v3
        WHERE v3.contato_id = p_contato_id
          AND v3.forma_pagamento = 'fiado'
      ) THEN 'quitou'
      ELSE 'nunca_usou'
    END;
  END IF;

  RETURN jsonb_build_object(
    'ultimo_produto', v_ultimo_produto,
    'fiado_estado',   v_fiado_estado
  );
END;
$$;
