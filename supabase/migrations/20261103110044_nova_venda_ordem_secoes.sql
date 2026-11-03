-- Nova Venda agrupada pelas seções da tela Catálogo (pedido do Gilmar, 03/11/2026).
-- Só DADOS (nada de schema). Backup antes: dump-*-20261103-075659.sql.
--
-- 1. Ordem das seções: a massa primeiro → Combos, Resfriados, Congelados, Doces.
--    (Combos continua em 0 e oculto na loja; na Nova Venda só aparece com campanha.)
-- 2. Os 5 combos da Black na seção Combos (4 estavam sem seção e cairiam em "Outros").
--    Ordem por preço: Dupla Zero, Trio Mineiro, Par Mineiro, Café da Tarde, Mesa Cheia.
-- 3. "Pão de Queijo 2kg - 100gr" (sem seção) entra em Congelados, no fim da seção.
--
-- Os ids vêm junto com o nome esperado: se algum não bater, aborta tudo.

do $$
declare
    n int;
begin
    -- 1. Seções
    update public.cat_secoes s
       set ordem = v.ordem, updated_at = now()
      from (values
            ('0bcb3668-8ad0-4623-a751-32c87cbc4eaa'::uuid, 'Combos',     0),
            ('f3126be4-7ad3-40fa-b4ca-6b1fec0406ad'::uuid, 'Resfriados', 1),
            ('af1d7d98-5a3f-49a8-b310-e274caf0b24c'::uuid, 'Congelados', 2),
            ('6aca7e95-9544-47ac-bd81-da8fc961eefe'::uuid, 'Doces',      3)
           ) as v(id, nome, ordem)
     where s.id = v.id and s.nome = v.nome;
    get diagnostics n = row_count;
    if n <> 4 then
        raise exception 'Seções: esperava 4 linhas, atualizou %', n;
    end if;

    -- 2. Combos da Black → seção Combos
    update public.produtos p
       set secao_id = '0bcb3668-8ad0-4623-a751-32c87cbc4eaa', ordem_vitrine = v.ordem
      from (values
            ('d371c052-8152-49b0-9ce7-ca27f1c3d2ed'::uuid, 'Dupla Zero (Black)',    0),
            ('d1ea5fd3-9f63-4a1e-9894-1194aa78c6c5'::uuid, 'Trio Mineiro (Black)',  1),
            ('5eab3cf4-b21f-46e8-a6da-a63eea0c09c4'::uuid, 'Par Mineiro (Black)',   2),
            ('fb5c4652-0bbc-46c3-88d0-de14e80e6a15'::uuid, 'Café da Tarde (Black)', 3),
            ('1d9b45f3-8834-4840-b218-8eb90227c500'::uuid, 'Mesa Cheia (Black)',    4)
           ) as v(id, nome, ordem)
     where p.id = v.id and p.nome = v.nome and p.eh_combo;
    get diagnostics n = row_count;
    if n <> 5 then
        raise exception 'Combos: esperava 5 linhas, atualizou %', n;
    end if;

    -- 3. Pão de Queijo 2kg - 100gr → Congelados, depois do último da seção
    update public.produtos
       set secao_id = 'af1d7d98-5a3f-49a8-b310-e274caf0b24c',
           ordem_vitrine = (select coalesce(max(ordem_vitrine), -1) + 1
                              from public.produtos
                             where secao_id = 'af1d7d98-5a3f-49a8-b310-e274caf0b24c')
     where id = '5b4a7fb9-4f29-4627-b952-2744eba3ff90'
       and nome = 'Pão de Queijo 2kg - 100gr'
       and secao_id is null;
    get diagnostics n = row_count;
    if n <> 1 then
        raise exception 'Pão de Queijo 2kg - 100gr: esperava 1 linha, atualizou %', n;
    end if;
end $$;
