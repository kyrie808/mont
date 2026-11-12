-- Faixas de frete alinhadas ao que a Mont cobra de verdade.
--
-- A configuracao tinha UMA faixa: "ate 30 km = R$ 5". Isso SUBCOBRAVA: o diretor cobra
-- R$ 10 de endereco em Sao Paulo capital, e qualquer endereco entre ~19 e 30 km estava
-- saindo por R$ 5 no site e na boca da secretaria.
--
-- Os cortes nao foram chutados. O diretor deu enderecos reais de cada preco e a rota foi
-- medida pelo mesmo motor que o sistema usa em producao (OpenRouteService, rota de carro,
-- nunca linha reta), a partir da cozinha no Montanhao/SBC:
--
--   Santo Andre centro       R$  5     9,6 km
--   Riacho Grande (SBC)      R$  5    11,6 km
--   Diadema centro           R$  5    13,9 km
--   Sao Caetano centro       R$  5    18,7 km
--   Vila Moraes / Sacomao    R$ 10    20,1 km
--   Colonia / Parelheiros    R$ 15    43,1 km
--
-- ⚠️ O corte dos 20 km e APERTADO de propósito e o diretor escolheu assim sabendo: Sao
-- Caetano (R$ 5) esta a 18,7 e a Vila Moraes (R$ 10) a 20,1 — 1,4 km separando duas
-- faixas. Imprecisao de geocodificacao nessa borda vira preco errado. Se aparecer
-- reclamacao de cliente da divisa, e aqui que se olha.
--
-- Curiosidade que justifica medir rota e nao linha reta: a Colonia PARECE perto da
-- cozinha no mapa, mas as vias de Parelheiros dao a volta e sao 43 km de estrada.
--
-- Valor ANTERIOR, para reverter:
--   {"modo":"valor_fixo","faixas":[{"ateKm":30,"valorFixo":5}],
--    "origem":{...},"foraDoAlcance":"a_combinar"}

UPDATE public.configuracoes
   SET valor = jsonb_set(
         valor,
         '{faixas}',
         '[{"ateKm":20,"valorFixo":5},{"ateKm":30,"valorFixo":10},{"ateKm":50,"valorFixo":15}]'::jsonb
       )
 WHERE chave = 'frete_config';
