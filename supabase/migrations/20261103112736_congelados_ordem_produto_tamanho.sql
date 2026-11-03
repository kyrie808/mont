-- Ordem dentro de Congelados: por produto, depois tamanho (pedido do Luccas, 03/11/2026).
-- Vale na tela Catálogo, então muda a loja junto. Só DADOS. Backup: dump-*-20261103-082422.sql.
--
-- Palito 1kg, Palito 2kg, Pão de Queijo 1kg 25/50/100gr, 2kg 50/100gr, Chipa 1kg, Chipa 2kg.
-- Antes havia empates (0, 0, 1, 1…) e a ordem saía do desempate por nome.
-- Ids com o nome esperado e a seção: se algo não bater (ou sobrar produto na seção), aborta.

do $$
declare
    n int;
begin
    update public.produtos p
       set ordem_vitrine = v.ordem
      from (values
            ('e39ff2ef-802d-4e33-8d0a-389000781bfb'::uuid, 'Palito de Queijo 1kg',       0),
            ('19ecc895-875f-41bf-9c8d-ed029ca7b23e'::uuid, 'Palito de Queijo 2kg',       1),
            ('2d49b141-a669-4f94-8f81-03d9a918761f'::uuid, 'Pão de Queijo 1kg - 25gr',   2),
            ('d4d66ed2-61d6-4a45-8e65-52eb4235dcd9'::uuid, 'Pão de Queijo 1kg - 50gr',   3),
            ('82bcf423-8152-447d-bd60-90151ff2b5c1'::uuid, 'Pão de Queijo 1kg - 100gr',  4),
            ('112dfdb9-d786-43cd-be5b-f3af36d2b2a4'::uuid, 'Pão de Queijo 2kg - 50gr',   5),
            ('5b4a7fb9-4f29-4627-b952-2744eba3ff90'::uuid, 'Pão de Queijo 2kg - 100gr',  6),
            ('d8095cfc-31b9-497d-993b-060392ef6ecb'::uuid, 'Chipa 1kg',                  7),
            ('6b373c88-723b-4cff-99ca-361ddcaf38a3'::uuid, 'Chipa 2kg',                  8)
           ) as v(id, nome, ordem)
     where p.id = v.id and p.nome = v.nome
       and p.secao_id = 'af1d7d98-5a3f-49a8-b310-e274caf0b24c';
    get diagnostics n = row_count;
    if n <> 9 then
        raise exception 'Congelados: esperava 9 linhas, atualizou %', n;
    end if;
    if exists (select 1 from public.produtos
                where secao_id = 'af1d7d98-5a3f-49a8-b310-e274caf0b24c'
                  and id not in ('e39ff2ef-802d-4e33-8d0a-389000781bfb','19ecc895-875f-41bf-9c8d-ed029ca7b23e',
                                 '2d49b141-a669-4f94-8f81-03d9a918761f','d4d66ed2-61d6-4a45-8e65-52eb4235dcd9',
                                 '82bcf423-8152-447d-bd60-90151ff2b5c1','112dfdb9-d786-43cd-be5b-f3af36d2b2a4',
                                 '5b4a7fb9-4f29-4627-b952-2744eba3ff90','d8095cfc-31b9-497d-993b-060392ef6ecb',
                                 '6b373c88-723b-4cff-99ca-361ddcaf38a3')) then
        raise exception 'Congelados tem produto fora da lista combinada';
    end if;
end $$;
