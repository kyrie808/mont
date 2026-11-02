-- TEMPORÁRIA (3ª vez): campanha de PRÉVIA para os prints do brinde, da escolha de 1 e do Dupla Zero,
-- com a Black real pausada. Aprovada pelo Luccas em 02/11; apagada no fim do mesmo trabalho pela
-- migração loja_remove_campanha_previa_local_ajustes.
--
-- Por que não aparece em lugar nenhum de verdade: está ativa, mas com datas de NOVEMBRO DE 2025.
--   • Loja em produção: filtra pela data de agora (LOJA_AGORA é ignorado em produção).
--   • Banco (campanha_vigente / precos_vigentes / Nova Venda / loja_criar_pedido): exigem a data vigente.
-- Só o computador local, com LOJA_AGORA dentro de nov/2025, mostra esta campanha.
-- Preços: cópia exata dos da Black 2026 (nada novo é inventado).
-- Backup antes: dump-*-20261102-101925.sql.

DO $$
DECLARE
    v_previa constant uuid := 'b1ac0000-0000-4000-8000-000000000001';
    v_black  constant uuid := 'b53b76fb-4bda-4669-8be2-81f07f8098b6';
    n int;
BEGIN
    INSERT INTO public.loja_campanhas (id, nome, inicio, fim, ativa)
    VALUES (v_previa, 'PRÉVIA LOCAL (apagar) — Black da Mont', '2025-11-03 03:00:00+00', '2025-12-01 02:59:59+00', true);

    INSERT INTO public.loja_precos (campanha_id, produto_id, preco_pix, preco_credito_1x, preco_debito, preco_credito_2x, ancora)
    SELECT v_previa, produto_id, preco_pix, preco_credito_1x, preco_debito, preco_credito_2x, ancora
      FROM public.loja_precos
     WHERE campanha_id = v_black;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
        RAISE EXCEPTION 'a Black 2026 não tem preços para copiar';
    END IF;

    -- Garantia: a prévia não vale agora (nem na loja, nem na Nova Venda).
    IF public.campanha_vigente(now()) IS NOT DISTINCT FROM v_previa THEN
        RAISE EXCEPTION 'a prévia ficou vigente; abortando';
    END IF;
END
$$;
