-- PDP: campo "Por que a Mont" por produto + recomendação por co-compra (market-basket).

-- 1. Benefícios por produto (texto, um por linha) — usado no tile "Por que a Mont".
alter table public.produtos add column if not exists beneficios text;

-- 2. Expor beneficios no catálogo.
create or replace view public.vw_catalogo_produtos with (security_invoker = 'on') as
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
    secao_id, ordem_vitrine, beneficios
   from public.produtos p
  where visivel_catalogo = true;

-- 3. Recomendação por co-compra: produtos comprados junto com o atual (exclui brinde),
--    só produtos visíveis, rankeado por nº de pedidos distintos. SECURITY DEFINER pois
--    itens_venda é leitura só-admin e o catálogo é anon (mesmo padrão de criar_pedido);
--    retorna só id + score (nada sensível).
create or replace function public.produtos_comprados_juntos(p_produto_id uuid, p_limit integer default 8)
returns table(produto_id uuid, score bigint)
language sql
security definer
set search_path = ''
as $$
    select iv2.produto_id, count(distinct iv2.venda_id) as score
    from public.itens_venda iv1
    join public.itens_venda iv2
      on iv2.venda_id = iv1.venda_id and iv2.produto_id <> iv1.produto_id
    join public.vendas v on v.id = iv1.venda_id
    join public.produtos p on p.id = iv2.produto_id
    where iv1.produto_id = p_produto_id
      and coalesce(v.forma_pagamento, '') <> 'brinde'
      and p.visivel_catalogo = true
    group by iv2.produto_id
    order by score desc, iv2.produto_id
    limit greatest(p_limit, 0);
$$;

notify pgrst, 'reload schema';
