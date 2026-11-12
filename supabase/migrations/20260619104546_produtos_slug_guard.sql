-- Rede de segurança: todo produto SEMPRE tem slug único (qualquer caminho de escrita).

-- slugify em SQL (remove acentos + não-alfanuméricos → '-').
create or replace function public.fn_slugify(p text)
returns text
language sql
immutable
set search_path = ''
as $$
    select trim(both '-' from regexp_replace(
        lower(translate(coalesce(p, ''),
            'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
        '[^a-z0-9]+', '-', 'g'));
$$;

-- Backfill de TODOS os faltantes (inclui invisíveis) com sufixo de id → unicidade garantida.
update public.produtos
set slug = coalesce(nullif(public.fn_slugify(nome), ''), 'produto') || '-' || left(replace(id::text, '-', ''), 6)
where slug is null or slug = '';

-- Trigger: preenche slug do nome quando vazio e garante unicidade (sufixo -2, -3, …).
create or replace function public.fn_produtos_set_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    base text;
    candidate text;
    n int := 1;
begin
    base := public.fn_slugify(coalesce(nullif(btrim(new.slug), ''), new.nome));
    if base is null or base = '' then
        base := 'produto';
    end if;
    candidate := base;
    while exists (select 1 from public.produtos p where p.slug = candidate and p.id <> new.id) loop
        n := n + 1;
        candidate := base || '-' || n::text;
    end loop;
    new.slug := candidate;
    return new;
end;
$$;

drop trigger if exists trg_produtos_set_slug on public.produtos;
create trigger trg_produtos_set_slug
    before insert or update on public.produtos
    for each row execute function public.fn_produtos_set_slug();

-- Enforcement no schema.
alter table public.produtos alter column slug set not null;
create unique index if not exists produtos_slug_uniq on public.produtos(slug);

notify pgrst, 'reload schema';
