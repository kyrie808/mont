-- Adiciona `selo` (badge do card do catálogo) à produtos + expõe na vw_catalogo_produtos.
-- selo: 'mais_vendido' | 'oferta' | 'queridinho' (text, nullable). Display-only, curado no interno.
-- Desacopla o badge do card do `destaque` (que passa a significar só "aparece no carrossel").

alter table public.produtos add column if not exists selo text;

-- Seed de continuidade: itens hoje no carrossel (destaque=true) seguem com "Mais vendido".
-- O admin reajusta os selos manualmente depois.
update public.produtos set selo = 'mais_vendido' where destaque = true and selo is null;

-- Recria a view com `selo` no fim da lista (CREATE OR REPLACE exige só ADD ao final).
create or replace view public.vw_catalogo_produtos with (security_invoker = 'on') as
 select
    id,
    nome,
    codigo,
    slug,
    descricao,
    categoria,
    subtitulo,
    estoque_atual,
    estoque_minimo,
    visivel_catalogo,
    destaque,
    preco,
    to_char(preco, 'FM999G990D00'::text) as preco_formatado,
    ( select img.url
        from public.cat_imagens_produto img
       where img.produto_id = p.id and img.tipo::text = 'cover'::text and img.ativo = true
       order by img.ordem
       limit 1) as url_imagem_principal,
    ( select coalesce(json_agg(json_build_object('id', img.id, 'url', img.url, 'alt_text', img.alt_text, 'is_primary', img.tipo::text = 'cover'::text, 'sort_order', img.ordem) order by img.ordem), '[]'::json)
        from public.cat_imagens_produto img
       where img.produto_id = p.id and img.ativo = true) as imagens,
    case
        when estoque_atual <= 0 then 'Sem Estoque'::text
        when estoque_atual <= estoque_minimo then 'Estoque Baixo'::text
        else 'Em Estoque'::text
    end as status_estoque,
    preco_ancoragem,
    instrucoes_preparo,
    secao_id,
    ordem_vitrine,
    beneficios,
    selo
   from public.produtos p
  where visivel_catalogo = true;

grant all on public.vw_catalogo_produtos to anon, authenticated, service_role;

notify pgrst, 'reload schema';
