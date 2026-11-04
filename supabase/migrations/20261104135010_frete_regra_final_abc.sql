-- Frete, regra final (04/11/2026, decisão do Luccas, calibrada com as entregas reais):
-- 1. ABC, qualquer bairro = R$ 5 pela cidade do CEP (ViaCEP), sem depender da distância;
-- 2. fora do ABC, pela distância de carro: até 21 km R$ 10; até 35 km R$ 15; acima, "a combinar".
-- Loja e catálogo antigo já aplicam regiaoFixa (main 023faaa); loja_criar_pedido aceita o valor
-- da região como frete estimado (20261104133702).
-- Backup antes: supabase/backups/dumps/dump-*-20261104-103301.sql
-- Valor anterior (para desfazer):
--   {"modo": "valor_fixo", "faixas": [{"ateKm": 20, "valorFixo": 5}, {"ateKm": 30, "valorFixo": 10},
--    {"ateKm": 50, "valorFixo": 15}], "origem": {"cep": "09784-410", "lat": -23.7205964,
--    "lng": -46.524444, "label": "Cozinha — Montanhão/SBC"}, "foraDoAlcance": "a_combinar"}

UPDATE public.configuracoes
   SET valor = valor
       || jsonb_build_object(
            'faixas', jsonb_build_array(
                jsonb_build_object('ateKm', 21, 'valorFixo', 10),
                jsonb_build_object('ateKm', 35, 'valorFixo', 15)),
            'regiaoFixa', jsonb_build_object(
                'nome', 'ABC',
                'valor', 5,
                'cidades', jsonb_build_array(
                    'Santo André', 'São Bernardo do Campo', 'São Caetano do Sul', 'Diadema',
                    'Mauá', 'Ribeirão Pires', 'Rio Grande da Serra')))
 WHERE chave = 'frete_config';
