-- Apaga a campanha de PRÉVIA criada por 20261102122027_loja_campanha_previa_local (só serviu para
-- os prints locais do A4 e da tela 03). Os preços dela caem junto (FK ON DELETE CASCADE).
-- Antes de apagar, confere que ela nunca foi usada: nenhum pedido ou venda com preço de tabela
-- desde a criação, e que não está vigente agora.
-- Backup antes: dump-*-20261102-092640.sql.

DO $$
DECLARE
    v_previa constant uuid := 'b1ac0000-0000-4000-8000-000000000001';
    n int;
BEGIN
    IF public.campanha_vigente(now()) IS NOT DISTINCT FROM v_previa THEN
        RAISE EXCEPTION 'a prévia está vigente; conferir antes de apagar';
    END IF;

    DELETE FROM public.loja_campanhas
     WHERE id = v_previa
       AND nome LIKE 'PRÉVIA LOCAL%'
       AND fim < now();
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
        RAISE EXCEPTION 'esperado apagar 1 campanha de prévia, apaguei %', n;
    END IF;

    IF EXISTS (SELECT 1 FROM public.loja_precos WHERE campanha_id = v_previa) THEN
        RAISE EXCEPTION 'sobraram preços da prévia';
    END IF;
END
$$;
