-- tags: cadastro/registry de tags de campanha
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cor        text not null,
  created_at timestamptz not null default now()
);
-- nome único, case-insensitive (não deixa "DDM" duplicar nem por casing)
create unique index tags_nome_lower_key on public.tags (lower(nome));

-- contato_tags: associação N:N
create table public.contato_tags (
  contato_id uuid not null references public.contatos(id) on delete cascade,
  tag_id     uuid not null references public.tags(id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contato_id, tag_id)
);
create index contato_tags_tag_id_idx on public.contato_tags (tag_id);

-- RLS — espelha o padrão do módulo (SELECT authenticated true / ALL is_admin())
alter table public.tags         enable row level security;
alter table public.contato_tags enable row level security;

create policy "Authenticated read tags" on public.tags
  for select to authenticated using (true);
create policy "Admin manage tags" on public.tags
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "Authenticated read contato_tags" on public.contato_tags
  for select to authenticated using (true);
create policy "Admin manage contato_tags" on public.contato_tags
  for all to authenticated using (is_admin()) with check (is_admin());
