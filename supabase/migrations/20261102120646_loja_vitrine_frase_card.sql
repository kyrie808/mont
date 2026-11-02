-- Loja: frase curta sob o nome no card (tela 01), escrita pela Mont. Uma linha, sem corte na tela.
-- Substitui a 1ª linha da descrição, que o Luccas recusou em 02/11. Vazio = sem frase (doces).
-- Backup antes: dump-*-20261102-090335.sql.

ALTER TABLE public.loja_vitrine
    ADD COLUMN frase_card text
    CONSTRAINT loja_vitrine_frase_card_uma_linha
        CHECK (frase_card IS NULL OR (frase_card !~ '[\r\n]' AND length(btrim(frase_card)) BETWEEN 1 AND 80));

COMMENT ON COLUMN public.loja_vitrine.frase_card IS
    'Frase curta sob o nome no card da loja (uma linha, até 80 caracteres). NULL = sem frase.';

DO $$
DECLARE
    n int;
BEGIN
    UPDATE public.loja_vitrine v
       SET frase_card = f.frase
      FROM public.produtos p,
           (VALUES ('balde_pao_queijo_4kg', 'Queijo Canastra de verdade. Rende pra família toda.'),
                   ('balde_pao_queijo_1kg', 'Pra experimentar ou pro café da semana.')) AS f(codigo, frase)
     WHERE p.id = v.produto_id
       AND p.codigo = f.codigo;

    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 2 THEN
        RAISE EXCEPTION 'esperado gravar a frase de 2 massas, gravei %', n;
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
