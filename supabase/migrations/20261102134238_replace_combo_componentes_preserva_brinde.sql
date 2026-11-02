-- replace_combo_componentes (tela de Produtos do sistema interno) apagava e reinseria a composição
-- do combo sem a coluna brinde: editar o Café da Tarde tirava o "de brinde" do doce de leite 400 g.
--
-- Agora cada item aceita "brinde" (true/false). Sem a chave (tela antiga, app em cache), o item que
-- já estava no combo mantém a marca; item novo entra sem brinde. Guarda de admin e grants iguais.
-- Teste: supabase/tests/combo_componentes_brinde.sql. Backup antes: dump-*-20261102-103926.sql.

CREATE OR REPLACE FUNCTION public.replace_combo_componentes(p_combo_id uuid, p_itens jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_brindes uuid[];
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores'
      USING ERRCODE = '42501';
  END IF;

  -- Quem já é brinde neste combo (vale quando o item chega sem a chave "brinde").
  SELECT COALESCE(array_agg(componente_id), '{}')
    INTO v_brindes
    FROM public.produto_componentes
   WHERE combo_id = p_combo_id AND brinde;

  DELETE FROM public.produto_componentes WHERE combo_id = p_combo_id;

  INSERT INTO public.produto_componentes (combo_id, componente_id, quantidade, brinde)
  SELECT p_combo_id,
         (item->>'componenteId')::uuid,
         (item->>'quantidade')::numeric,
         CASE WHEN item ? 'brinde' THEN COALESCE((item->>'brinde')::boolean, false)
              ELSE (item->>'componenteId')::uuid = ANY (v_brindes)
         END
  FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS item;
END;
$function$;
