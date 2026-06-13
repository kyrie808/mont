-- RPC atômico p/ substituir a composição de um combo (delete + insert numa transação).
-- Motivo: produtoService.replaceComponentes fazia delete e insert em DUAS chamadas separadas;
-- se o insert falhasse após o delete, o combo ficava com 0 componentes (eh_combo=true, vazio)
-- e o catálogo renderizava o kit sem conteúdo. plpgsql roda em transação única → atômico.
-- Itens vazios ([]) apenas limpam (desfaz o combo), comportamento idêntico ao anterior.

CREATE OR REPLACE FUNCTION public.replace_combo_componentes(p_combo_id uuid, p_itens jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.produto_componentes WHERE combo_id = p_combo_id;

  INSERT INTO public.produto_componentes (combo_id, componente_id, quantidade)
  SELECT p_combo_id,
         (item->>'componenteId')::uuid,
         (item->>'quantidade')::numeric
  FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) AS item;
END;
$function$;
