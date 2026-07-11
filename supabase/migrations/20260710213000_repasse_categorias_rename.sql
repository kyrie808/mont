-- Stage 2a-fix — corrige os NOMES das categorias do repasse (nomes definidos pelo
-- Luccas). A migration anterior (20260710210000) criou 'Frete Grátis (cortesia)'
-- e 'Repasse Frete Entregador' (nomes que EU recomendei por engano). Nenhum
-- lançamento referencia ainda; renomeia por UPDATE (preserva os ids).
--
--   Taxa de Entrega            = repasse da taxa de entrega (R$5) ao Maurício.
--   Ajuda de Custo Entregador  = dinheiro de ajuda ao Maurício (ex.: gasolina).
--
-- Backup: dump-{schema,data}-20260710 (stage2a-fix).

UPDATE public.plano_de_contas
   SET nome = 'Taxa de Entrega', codigo = 'TAXA_ENTREGA_ENTREGADOR'
 WHERE codigo = 'REPASSE_ENTREGADOR';

UPDATE public.plano_de_contas
   SET nome = 'Ajuda de Custo Entregador', codigo = 'AJUDA_CUSTO_ENTREGADOR'
 WHERE codigo = 'FRETE_GRATIS';
