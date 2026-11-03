-- "Sempre em Mais vendidos" na Nova Venda (pedido do Gilmar, 03/11/2026).
-- Os fixados vêm primeiro (pelo nome); o ranking de 90 dias completa até 8, sem repetir.
-- Só o interno lê; a loja e o catálogo não usam esta coluna.
-- Backup: dump-*-20261103-120825.sql
alter table public.produtos
    add column fixo_mais_vendidos boolean not null default false;

comment on column public.produtos.fixo_mais_vendidos is
    'Sempre em "Mais vendidos" na Nova Venda do interno (fixados primeiro, depois o ranking de 90 dias, até 8).';

-- Já nascem fixados: Brigadeiro de Colher Zero 400g e Doce de Leite Zero 400g.
-- Confere id + nome antes; se não achar os dois, aborta tudo.
do $$
declare
    alvos constant jsonb := '{
        "fd133482-7777-4b46-911b-1c404ecd6161": "Brigadeiro de Colher Zero 400g",
        "c93e59d2-7678-4057-bcba-4629d1c46310": "Doce de Leite Zero 400g"
    }';
    n int;
begin
    update public.produtos p
       set fixo_mais_vendidos = true
     where p.id = any (array(select jsonb_object_keys(alvos))::uuid[])
       and p.nome = alvos ->> p.id::text
       and p.ativo;
    get diagnostics n = row_count;
    if n <> 2 then
        raise exception 'esperava fixar 2 produtos, fixou %', n;
    end if;
end
$$;

notify pgrst, 'reload schema';
