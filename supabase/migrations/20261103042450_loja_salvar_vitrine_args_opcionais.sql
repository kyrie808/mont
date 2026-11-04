-- loja_salvar_vitrine (criada em 20261103041843, ainda sem uso): seção e ordem só da loja viram
-- argumentos OPCIONAIS no fim da lista (DEFAULT NULL = "igual ao cadastro"), para o cliente omitir em
-- vez de mandar null (o gerador de tipos marca argumento sem default como obrigatório e não-nulo).
-- Backup antes: supabase/backups/dumps/dump-*-20261103-012124.sql

DROP FUNCTION public.loja_salvar_vitrine(uuid, text, text, text, uuid, integer, boolean, boolean, boolean, boolean, boolean);

CREATE FUNCTION public.loja_salvar_vitrine(
    p_produto_id uuid,
    p_nome_loja text,
    p_frase_card text,
    p_resumo text,
    p_destaque_hero boolean,
    p_leva_junto boolean,
    p_disponivel boolean,
    p_usa_estoque boolean,
    p_usar_ancoragem boolean,
    p_secao_id uuid DEFAULT NULL,
    p_ordem_loja integer DEFAULT NULL
) RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
BEGIN
    IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores' USING ERRCODE = '42501';
    END IF;

    IF p_leva_junto THEN
        UPDATE public.loja_vitrine SET leva_junto = false WHERE leva_junto AND produto_id <> p_produto_id;
    END IF;
    IF p_destaque_hero THEN
        UPDATE public.loja_vitrine SET destaque_hero = false WHERE destaque_hero AND produto_id <> p_produto_id;
    END IF;

    INSERT INTO public.loja_vitrine (
        produto_id, visivel, nome_loja, frase_card, resumo, secao_id, ordem_loja,
        destaque_hero, leva_junto, disponivel, usa_estoque, usar_ancoragem
    ) VALUES (
        p_produto_id, true,
        NULLIF(btrim(COALESCE(p_nome_loja, '')), ''),
        NULLIF(btrim(COALESCE(p_frase_card, '')), ''),
        NULLIF(btrim(COALESCE(p_resumo, '')), ''),
        p_secao_id, p_ordem_loja,
        COALESCE(p_destaque_hero, false), COALESCE(p_leva_junto, false),
        COALESCE(p_disponivel, true), COALESCE(p_usa_estoque, false), COALESCE(p_usar_ancoragem, false)
    )
    ON CONFLICT (produto_id) DO UPDATE SET
        visivel = true,
        nome_loja = EXCLUDED.nome_loja,
        frase_card = EXCLUDED.frase_card,
        resumo = EXCLUDED.resumo,
        secao_id = EXCLUDED.secao_id,
        ordem_loja = EXCLUDED.ordem_loja,
        destaque_hero = EXCLUDED.destaque_hero,
        leva_junto = EXCLUDED.leva_junto,
        disponivel = EXCLUDED.disponivel,
        usa_estoque = EXCLUDED.usa_estoque,
        usar_ancoragem = EXCLUDED.usar_ancoragem;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.loja_salvar_vitrine(uuid, text, text, text, boolean, boolean, boolean, boolean, boolean, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loja_salvar_vitrine(uuid, text, text, text, boolean, boolean, boolean, boolean, boolean, uuid, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
