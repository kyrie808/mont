-- Frete: troca o modelo de cobrança para VALOR FIXO por faixa (decisão do Gilmar, 15/06).
-- Antes era por km (modo 'progressivo'). O código do catálogo passa a entender o modo
-- 'valor_fixo' (faixa.valorFixo = R$ fechado da faixa). A config segue editável na aba
-- Frete do interno (toggle Valor fixo / Por km). Distâncias são de ROTA real (ORS).
--
-- ⚠️ Aplicar DEPOIS do deploy do código novo (que entende 'valor_fixo'); o código antigo
-- não entende esse modo. Código novo + config antiga (por km) continua funcionando.
--
-- ROLLBACK (valor anterior, por km):
-- UPDATE public.configuracoes SET valor = '{
--   "modo":"progressivo",
--   "origem":{"lat":-23.7205964,"lng":-46.524444,"label":"Cozinha — Montanhão/SBC","cep":"09784-410"},
--   "faixas":[{"ateKm":4,"valorPorKm":2},{"ateKm":8,"valorPorKm":4},{"ateKm":12,"valorPorKm":6.5}],
--   "foraDoAlcance":"a_combinar"
-- }'::jsonb WHERE chave = 'frete_config';

UPDATE public.configuracoes
SET valor = '{
    "modo": "valor_fixo",
    "origem": { "lat": -23.7205964, "lng": -46.524444, "label": "Cozinha — Montanhão/SBC", "cep": "09784-410" },
    "faixas": [
        { "ateKm": 3, "valorFixo": 5 },
        { "ateKm": 5, "valorFixo": 9 },
        { "ateKm": 8, "valorFixo": 14 },
        { "ateKm": 10, "valorFixo": 18 },
        { "ateKm": 15, "valorFixo": 25 }
    ],
    "foraDoAlcance": "a_combinar"
}'::jsonb
WHERE chave = 'frete_config';
