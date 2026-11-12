-- Pivot: atribuição produto→seção vira FK única em produtos (image copy 4: 1 aba por produto).
-- Aposenta o M:N cat_secao_produtos e o conceito 'bento' (destaque agora é carrossel via flag).

-- 1. Renomear seções existentes para o modelo de abas.
update public.cat_secoes set nome = 'Combos',    slug = 'combos'    where slug = 'destaques';
update public.cat_secoes set nome = 'Resfriados', slug = 'resfriados' where slug = 'refrigerados';

-- 2. Novas colunas em produtos.
alter table public.produtos
  add column if not exists secao_id uuid references public.cat_secoes(id) on delete set null,
  add column if not exists ordem_vitrine integer not null default 0;
create index if not exists produtos_secao_id_idx on public.produtos(secao_id);

-- 3. Migrar associação (combo→Combos, congelado→Congelados, refrigerado→Resfriados).
update public.produtos p set secao_id = s.id
from public.cat_secoes s
where s.slug = 'combos' and p.eh_combo = true and p.visivel_catalogo = true;

update public.produtos p set secao_id = s.id
from public.cat_secoes s
where s.slug = 'congelados' and p.categoria = 'congelado'
  and coalesce(p.eh_combo, false) = false and p.visivel_catalogo = true;

update public.produtos p set secao_id = s.id
from public.cat_secoes s
where s.slug = 'resfriados' and p.categoria = 'refrigerado'
  and coalesce(p.eh_combo, false) = false and p.visivel_catalogo = true;

-- 4. Ordem inicial dentro da aba (destaque primeiro, depois nome).
update public.produtos p set ordem_vitrine = sub.rn
from (
  select id, (row_number() over (partition by secao_id order by destaque desc nulls last, nome))::int as rn
  from public.produtos
  where secao_id is not null
) sub
where sub.id = p.id;

-- 5. Descontinuar M:N + conceito bento.
drop function if exists public.reorder_secao_produtos(uuid, uuid[]);
drop table if exists public.cat_secao_produtos;
alter table public.cat_secoes drop column if exists tipo;  -- remove também o índice parcial de bento

-- 6. Reordenação dos produtos dentro de uma aba (cabine /catalogo).
create or replace function public.reorder_produtos_vitrine(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    update public.produtos pr
    set ordem_vitrine = idx.ord
    from (select unnest(p_ids) as id, generate_subscripts(p_ids, 1) as ord) idx
    where pr.id = idx.id;
end;
$$;

-- 7. Expor secao_id e ordem_vitrine no catálogo.
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
    secao_id, ordem_vitrine
   from public.produtos p
  where visivel_catalogo = true;

notify pgrst, 'reload schema';
