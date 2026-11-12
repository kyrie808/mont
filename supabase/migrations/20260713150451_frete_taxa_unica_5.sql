-- Frete: taxa única de R$5 até 30 km (decisão do Gilmar, 13/07).
-- Achata todas as faixas para um valor fechado de R$5 e amplia o raio de 15→30 km.
-- Mantém modo 'valor_fixo' (código do catálogo já entende) e a origem (cozinha Montanhão/SBC).
-- Dentro de 30 km de rota = R$5; acima = "a combinar" pelo WhatsApp. Retirada = grátis.
--
-- ROLLBACK (faixas anteriores, 15/06):
-- UPDATE public.configuracoes SET valor = '{
--   "modo":"valor_fixo",
--   "origem":{"lat":-23.7205964,"lng":-46.524444,"label":"Cozinha — Montanhão/SBC","cep":"09784-410"},
--   "faixas":[{"ateKm":3,"valorFixo":5},{"ateKm":5,"valorFixo":9},{"ateKm":8,"valorFixo":14},{"ateKm":10,"valorFixo":18},{"ateKm":15,"valorFixo":25}],
--   "foraDoAlcance":"a_combinar"
-- }'::jsonb WHERE chave = 'frete_config';

UPDATE public.configuracoes
SET valor = '{
    "modo": "valor_fixo",
    "origem": { "lat": -23.7205964, "lng": -46.524444, "label": "Cozinha — Montanhão/SBC", "cep": "09784-410" },
    "faixas": [
        { "ateKm": 30, "valorFixo": 5 }
    ],
    "foraDoAlcance": "a_combinar"
}'::jsonb
WHERE chave = 'frete_config';
