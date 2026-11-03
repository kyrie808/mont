-- Doces: "Doce de Leite com Geleia de Café 680g" logo depois do "com Geleia de Ameixa 680g"
-- (pedido do Luccas, 03/11/2026). O resto da seção fica como está (por tamanho: 680g, depois
-- 400g); quem vinha depois da Ameixa só desce uma posição. Vale na tela Catálogo e na loja.
-- Só DADOS. Backup: dump-*-20261103-083324.sql.
-- Ids com o nome esperado e a seção: se algo não bater (ou sobrar produto na seção), aborta.

do $$
declare
    n int;
begin
    update public.produtos p
       set ordem_vitrine = v.ordem
      from (values
            ('026f67b0-8574-408b-823b-d93fa526de21'::uuid, 'Doce de Leite Tradicional 680g',           1),
            ('6df32aa5-9932-418c-b920-e35b8160e1d7'::uuid, 'Doce de Leite com Coco 680g',              2),
            ('a3a3be4e-6dac-46b8-b6f5-537e1ec8db84'::uuid, 'Doce de Leite com Geleia de Ameixa 680g',  3),
            ('b9b1575f-03c5-4397-ab1a-31d3f23b26c2'::uuid, 'Doce de Leite com Geleia de Café 680g',    4),
            ('870e4563-de3b-4d68-bdf7-2c839ac862e7'::uuid, 'Cocada Cremosa 680g',                      5),
            ('9820a42a-6459-4967-9fa6-a8edf5740f4b'::uuid, 'Cocada Cremosa com Maracujá 680g',         6),
            ('97f4680c-bdb7-4d24-9c94-449ca0b2ada4'::uuid, 'Doce de Milho 680g',                       7),
            ('658a747e-7e1e-4f43-90ea-db8c9b04e654'::uuid, 'Geleia de Morango 680g',                   8),
            ('d57053d0-4686-4488-9c47-5a5ca23b07ea'::uuid, 'Geleia de Goiaba 680g',                    9),
            ('1d83ab4f-0cbb-42e3-8eaf-aab4ec41a75f'::uuid, 'Geleia de Frutas Vermelhas 680g',         10),
            ('f63e92fb-6918-4e3a-8af0-7aa5e2b6b978'::uuid, 'Doce de Leite Tradicional 400g',          11),
            ('67c49a99-1144-4e54-9591-43354c36cd15'::uuid, 'Doce de Leite com Coco 400g',             12),
            ('cbf5c4e0-0b3c-43f5-bec5-131d6f350d77'::uuid, 'Ambrosia 400g',                           13),
            ('511187d4-079d-40a6-b7b4-ca55ffec0e4b'::uuid, 'Doce de Abóbora com Coco 400g',           14),
            ('c93e59d2-7678-4057-bcba-4629d1c46310'::uuid, 'Doce de Leite Zero 400g',                 15),
            ('fd133482-7777-4b46-911b-1c404ecd6161'::uuid, 'Brigadeiro de Colher Zero 400g',          16)
           ) as v(id, nome, ordem)
     where p.id = v.id and p.nome = v.nome
       and p.secao_id = '6aca7e95-9544-47ac-bd81-da8fc961eefe';
    get diagnostics n = row_count;
    if n <> 16 then
        raise exception 'Doces: esperava 16 linhas, atualizou %', n;
    end if;
    if (select count(*) from public.produtos where secao_id = '6aca7e95-9544-47ac-bd81-da8fc961eefe') <> 16 then
        raise exception 'Doces tem produto fora da lista combinada';
    end if;
end $$;
