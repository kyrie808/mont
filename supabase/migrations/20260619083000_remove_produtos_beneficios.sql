-- Remove beneficios ("Por que a Mont"): a PDP passa a usar descrição + instruções de preparo.
-- CREATE OR REPLACE VIEW não remove coluna → DROP + CREATE; re-grant pra preservar acesso.

drop view if exists public.vw_catalogo_produtos;

alter table public.produtos drop column if exists beneficios;

create view public.vw_catalogo_produtos with (security_invoker = 'on') as
 select
    id, nome, codigo, slug, descricao, categoria, subtitulo,
    estoque_atual, estoque_minimo, visivel_catalogo, destaque, preco,
    to_char(preco, 'FM999G990D00'::text) as preco_formatado,
    ( select img.url from public.cat_imagens_produto img
       where img.produto_id = p.id and img.tipo::text = 'cover'::text and img.ativo = true
       order by img.ordem limit 1) as url_imagem_principal,
    ( select coalesce(json_agg(json_build_object('id', img.id, 'url', img.url, 'alt_text', img.alt_text, 'is_primary', img.tipo::text = 'cover'::text, 'sort_order', img.ordem) order by img.ordem), '[]'::json)
       from public.cat_imagens_produto img
       where img.produto_id = p.id and img.ativo = true) as imagens,
    case
        when estoque_atual <= 0 then 'Sem Estoque'::text
        when estoque_atual <= estoque_minimo then 'Estoque Baixo'::text
        else 'Em Estoque'::text
    end as status_estoque,
    preco_ancoragem, instrucoes_preparo,
    secao_id, ordem_vitrine
   from public.produtos p
  where visivel_catalogo = true;

grant all on public.vw_catalogo_produtos to anon, authenticated, service_role;

notify pgrst, 'reload schema';
