-- Seções da vitrine do catálogo (gerenciadas no interno, consumidas pelo catálogo).
-- Camada de merchandising sobre produtos. A coluna `categoria` do produto segue intacta.

create table if not exists public.cat_secoes (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    slug text not null unique,
    ordem integer not null default 0,
    tipo text not null default 'grid' check (tipo in ('bento','grid')),
    ativa boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Só uma seção pode ser do tipo 'bento' (a primeira dobra da vitrine).
create unique index if not exists cat_secoes_tipo_bento_uniq
    on public.cat_secoes (tipo) where (tipo = 'bento');

create index if not exists cat_secoes_ordem_idx on public.cat_secoes (ordem);

create table if not exists public.cat_secao_produtos (
    id uuid primary key default gen_random_uuid(),
    secao_id uuid not null references public.cat_secoes(id) on delete cascade,
    produto_id uuid not null references public.produtos(id) on delete cascade,
    ordem integer not null default 0,
    created_at timestamptz not null default now(),
    unique (secao_id, produto_id)
);

-- Índices de cobertura de FK (regra da skill). O unique(secao_id, produto_id) já cobre
-- buscas com secao_id à esquerda; produto_id precisa do índice próprio.
create index if not exists cat_secao_produtos_produto_id_idx on public.cat_secao_produtos (produto_id);
create index if not exists cat_secao_produtos_secao_ordem_idx on public.cat_secao_produtos (secao_id, ordem);

-- RLS — espelha o padrão de cat_imagens_produto (Public read + Admin manage),
-- mas com leitura pública escopada a `anon` para não empilhar policy permissiva
-- no role `authenticated` (evita multiple_permissive_policies).
alter table public.cat_secoes enable row level security;
alter table public.cat_secao_produtos enable row level security;

create policy "Public read active secoes" on public.cat_secoes
    for select to anon using (ativa = true);
create policy "Admin manage secoes" on public.cat_secoes
    for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Public read secao_produtos" on public.cat_secao_produtos
    for select to anon using (true);
create policy "Admin manage secao_produtos" on public.cat_secao_produtos
    for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));

-- Reordenação atômica em lote (SECURITY INVOKER: RLS de admin protege os dados).
create or replace function public.reorder_secoes(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    update public.cat_secoes s
    set ordem = idx.ord, updated_at = now()
    from (select unnest(p_ids) as id, generate_subscripts(p_ids, 1) as ord) idx
    where s.id = idx.id;
end;
$$;

create or replace function public.reorder_secao_produtos(p_secao_id uuid, p_produto_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    update public.cat_secao_produtos sp
    set ordem = idx.ord
    from (select unnest(p_produto_ids) as produto_id, generate_subscripts(p_produto_ids, 1) as ord) idx
    where sp.secao_id = p_secao_id and sp.produto_id = idx.produto_id;
end;
$$;

notify pgrst, 'reload schema';
