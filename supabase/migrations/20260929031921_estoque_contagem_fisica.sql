-- Primeira contagem fisica de estoque da Mont, feita pelo diretor em 28/09/2026.
--
-- Ate agora `estoque_atual` era baseline nunca contado: chipa em -243, palito em -426,
-- massa em -325. Numero negativo nao e "acabou", e "ninguem nunca contou" — e por isso a
-- secretaria de IA foi proibida de falar de estoque com cliente.
--
-- Com contagem real, o numero passa a significar alguma coisa: produto com estoque zero ou
-- negativo deixa de ser SUGERIDO por iniciativa dela (mas continua sendo aceito se o
-- cliente pedir pelo nome — estoque nunca recusa venda, so deixa de oferecer).
--
-- Valores ANTERIORES, para reverter sem garimpar o dump:
--   Chipa 1kg                    -243
--   Chipa 2kg                     -21
--   Palito de Queijo 1kg         -426
--   Palito de Queijo 2kg          -30
--   Pao de Queijo 2kg - 50gr      -27
--   Pao de Queijo 2kg - 100gr     -22   (e visivel_catalogo = false)
--   Massa Pao de Queijo 1kg      -325
--   Massa Pao de Queijo 4kg      -228

UPDATE public.produtos SET estoque_atual =  9 WHERE nome = 'Chipa 1kg';
UPDATE public.produtos SET estoque_atual = 10 WHERE nome = 'Chipa 2kg';
UPDATE public.produtos SET estoque_atual = 36 WHERE nome = 'Palito de Queijo 1kg';
UPDATE public.produtos SET estoque_atual =  4 WHERE nome = 'Palito de Queijo 2kg';
UPDATE public.produtos SET estoque_atual = 17 WHERE nome = 'Pão de Queijo 2kg - 50gr';
UPDATE public.produtos SET estoque_atual = 13 WHERE nome = 'Massa Pão de Queijo 1kg';
UPDATE public.produtos SET estoque_atual = 20 WHERE nome = 'Massa Pão de Queijo 4kg';

-- O 2kg-100gr VOLTA A SER VENDIDO.
--
-- Estava com visivel_catalogo = false, que neste projeto significa "nao vendemos mais". O
-- diretor contou 9 unidades dele, entao voltou para a linha. Ganha os sinonimos do cliente
-- junto: sem apelido a secretaria responde que a Mont nao vende esse produto, porque o
-- casamento e por sinonimo curado e nao por pedaco do nome. O apelido dele hoje e o codigo
-- interno antigo ('C'), que nenhum cliente escreveria.
--
-- ⚠️ CONSEQUENCIA NA CONVERSA: com dois produtos de 2kg no catalogo, "2 kg de pao de
-- queijo" deixa de resolver sozinho e passa a virar pergunta ("de 50g ou 100g?"). Isso e o
-- comportamento correto — antes so nao perguntava porque so existia uma opcao de 2kg.
UPDATE public.produtos
   SET estoque_atual = 9,
       visivel_catalogo = true,
       apelido = 'pão de queijo, pao de queijo, pdq, congelado'
 WHERE nome = 'Pão de Queijo 2kg - 100gr';

-- NAO contados nesta rodada, de proposito — ficam como estao:
--   Pao de Queijo 1kg - 100gr    (segue em 4; o diretor nao contou)
--   Pao de Queijo 1kg - 25gr     (segue em -103; ver abaixo)
--
-- Pendencia registrada: a contagem trouxe uma linha "pao de queijo 2kg 25gr = 8", e esse
-- produto NAO EXISTE no catalogo. O que existe e o 1kg-25gr. Pode ser erro de digitacao no
-- peso do pacote, ou produto novo ainda nao cadastrado. O diretor vai conferir. Ate la o
-- 1kg-25gr segue negativo e a secretaria nao vai sugeri-lo.
