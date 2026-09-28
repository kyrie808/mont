-- Valores anteriores de `apelido` nos 9 produtos que esta migration toca:
--   Chipa 1kg                   X
--   Chipa 2kg                   X
--   Palito de Queijo 1kg        P
--   Palito de Queijo 2kg        P
--   Pao de Queijo 1kg - 25gr    C
--   Pao de Queijo 1kg - 100gr   C
--   Pao de Queijo 2kg - 50gr    C
--   Massa Pao de Queijo 1kg     B
--   Massa Pao de Queijo 4kg     B

-- `produtos.apelido` muda de significado.
--
-- Guardava codigos de uma letra (X, P, C, B) para o ProductNicknamesModal do modulo de
-- pedidos de compra, que o diretor confirmou nao usar mais. Passa a guardar os SINONIMOS
-- do cliente, separados por virgula — e o cliente nunca escreve "Massa Pao de Queijo 1kg",
-- escreve "baldinho".
--
-- Por que sinonimo curado e nao busca por pedaco do nome: "pao de queijo" aparece em cinco
-- produtos, dois deles massa CRUA. Substring devolveria os cinco e a agente perguntaria se
-- ele quer pronto ou cru numa conversa em que ele claramente quis o pronto.
--
-- ATENCAO: produto novo cadastrado SEM apelido some do vocabulario da agente sem erro
-- nenhum — ela responde que a Mont nao vende aquilo. Ver a secao de riscos da spec.

UPDATE public.produtos SET apelido = 'pão de queijo, pao de queijo, pdq, congelado'
 WHERE nome IN ('Pão de Queijo 1kg - 25gr', 'Pão de Queijo 1kg - 100gr', 'Pão de Queijo 2kg - 50gr');

UPDATE public.produtos SET apelido = 'baldinho, massa, massa crua, resfriado'
 WHERE nome = 'Massa Pão de Queijo 1kg';

UPDATE public.produtos SET apelido = 'balde, baldão, massa, resfriado'
 WHERE nome = 'Massa Pão de Queijo 4kg';

UPDATE public.produtos SET apelido = 'chipa, chipinha'
 WHERE nome IN ('Chipa 1kg', 'Chipa 2kg');

UPDATE public.produtos SET apelido = 'palito, palito de queijo'
 WHERE nome IN ('Palito de Queijo 1kg', 'Palito de Queijo 2kg');

COMMENT ON COLUMN public.produtos.apelido IS
  'Sinonimos do cliente, separados por virgula. Usado pela secretaria de IA para resolver o que o cliente escreveu em produto real.';
