-- Produto novo: Pao de Queijo 1kg - 50gr.
--
-- Nao e lancamento — e pedido errado. O Gilmar comprou uma variacao que a Mont nunca
-- trabalhou, chegaram 10 unidades, e a decisao do diretor foi vender em vez de segurar
-- parado no freezer. Preco R$ 30, igual aos dois irmaos de 1kg (o peso do pacote e o
-- mesmo; so muda o tamanho da unidade).
--
-- Cadastro espelha o padrao dos irmaos: categoria `congelado`, unidade `kg`,
-- estoque_minimo 10, subtitulo no formato "Xgr por unidade", mesma secao da vitrine.
--
-- ⚠️ `custo` = 13,50 e ESTIMATIVA COPIADA DO IRMAO (1kg-25gr), nao numero de nota.
--
-- A coluna e NOT NULL e nenhum dos 25 produtos usa zero como sentinela de "desconhecido"
-- — zero apareceria como margem de 100% nos relatorios, pior que uma estimativa proxima.
-- E o mesmo pacote de 1kg, mesma massa, entao o custo real deve ficar entre os R$ 13,00 e
-- R$ 13,50 dos irmaos. CORRIGIR quando a nota do fornecedor deste pedido aparecer: ate la
-- a margem deste item e aproximada.
--
-- ⚠️ `apelido` NAO e opcional para produto que a secretaria deve conhecer. O casamento
-- "o que o cliente escreveu" -> produto e por sinonimo curado, nao por pedaco do nome:
-- sem apelido ela responde que a Mont nao vende isso.
--
-- ⚠️ CONSEQUENCIA NA CONVERSA: com tres pacotes de 1kg no catalogo, "1 kg de pao de
-- queijo" passa a ter TRES opcoes (25g, 50g, 100g), e "pao de queijo de 50g" — que hoje
-- resolve sozinho no de 2kg — vira pergunta. As duas sao corretas; sao efeito de o
-- catalogo ter crescido, nao defeito.

INSERT INTO public.produtos (
  nome, codigo, preco, custo, unidade, categoria, slug, subtitulo,
  estoque_atual, estoque_minimo, apelido,
  ativo, visivel_catalogo, destaque, eh_combo,
  secao_id, ordem_vitrine
)
SELECT
  'Pão de Queijo 1kg - 50gr',
  'pao_queijo_congelado_1kg_50gr',
  30.00,
  13.50,
  'kg',
  'congelado',
  'pao-de-queijo-1kg-50gr',
  '50gr por unidade',
  10,
  10,
  'pão de queijo, pao de queijo, pdq, congelado',
  true,
  true,
  false,
  false,
  'af1d7d98-5a3f-49a8-b310-e274caf0b24c',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.produtos WHERE codigo = 'pao_queijo_congelado_1kg_50gr'
);
