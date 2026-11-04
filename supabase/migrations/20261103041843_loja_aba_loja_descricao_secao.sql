-- Parte B da paridade (03/11/2026): aba "Loja" na tela de produto + descrição da seção.
-- Backup antes: supabase/backups/dumps/dump-*-20261103-011508.sql
--
-- * cat_secoes.descricao: frase curta sob o título da seção na loja (editável na tela Catálogo).
-- * loja_vitrine.usar_ancoragem: mostrar o preço de ancoragem do cadastro como "de" fora de campanha.
--   Desligado por padrão: "de/por" só com preço já praticado (decisão de 03/11).
-- * loja_salvar_vitrine: grava a aba "Loja" de um produto numa chamada (linha sempre visível);
--   "leva junto?" e destaque do topo ficam em um produto por vez. SECURITY INVOKER: a escrita passa
--   pela policy de admin de loja_vitrine; a checagem explícita só dá um erro claro.

ALTER TABLE public.cat_secoes
  ADD COLUMN descricao text,
  ADD CONSTRAINT cat_secoes_descricao_uma_linha CHECK (
    descricao IS NULL OR (descricao !~ '[\r\n]' AND length(btrim(descricao)) BETWEEN 1 AND 120)
  );
COMMENT ON COLUMN public.cat_secoes.descricao IS 'Frase curta sob o título da seção na loja. NULL = sem frase.';

-- As frases que a loja mostrava antes da Parte A voltam, agora editáveis na tela Catálogo.
UPDATE public.cat_secoes SET descricao = 'Queijo Canastra de verdade. Parmesão e Meia Cura.' WHERE slug = 'resfriados';
UPDATE public.cat_secoes SET descricao = 'Potes de 680 g e 400 g · sabores conforme estoque' WHERE slug = 'doces';

ALTER TABLE public.loja_vitrine ADD COLUMN usar_ancoragem boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.loja_vitrine.usar_ancoragem IS
  'Fora de campanha, mostra produtos.preco_ancoragem riscado. Só com preço já praticado.';

CREATE FUNCTION public.loja_salvar_vitrine(
    p_produto_id uuid,
    p_nome_loja text,
    p_frase_card text,
    p_resumo text,
    p_secao_id uuid,
    p_ordem_loja integer,
    p_destaque_hero boolean,
    p_leva_junto boolean,
    p_disponivel boolean,
    p_usa_estoque boolean,
    p_usar_ancoragem boolean
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

REVOKE EXECUTE ON FUNCTION public.loja_salvar_vitrine(uuid, text, text, text, uuid, integer, boolean, boolean, boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loja_salvar_vitrine(uuid, text, text, text, uuid, integer, boolean, boolean, boolean, boolean, boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
