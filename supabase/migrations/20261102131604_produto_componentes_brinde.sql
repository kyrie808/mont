-- Marca de brinde no item fixo de um combo (só exibição: tela 03 da loja, "Já incluso").
-- O brinde continua no rateio do preço como os demais componentes (decisão P9) e a mensagem do
-- WhatsApp não muda. Café da Tarde: o doce de leite tradicional 400 g é brinde (decisão de 02/11).
-- Backup antes: dump-*-20261102-101251.sql.

ALTER TABLE public.produto_componentes
    ADD COLUMN brinde boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.produto_componentes.brinde IS
    'Item fixo dado de brinde no combo (só exibição na loja: "de brinde"). Entra no rateio do preço normalmente.';

DO $$
DECLARE
    n int;
BEGIN
    UPDATE public.produto_componentes pc
       SET brinde = true
      FROM public.produtos c, public.produtos p
     WHERE c.id = pc.combo_id
       AND p.id = pc.componente_id
       AND c.codigo = 'combo_black_cafe_da_tarde'
       AND p.codigo = 'doce_leite_tradicional_400g';

    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
        RAISE EXCEPTION 'esperado marcar 1 brinde (Café da Tarde), marquei %', n;
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
