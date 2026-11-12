-- Frete por distância (catálogo): config única em configuracoes (chave 'frete_config'),
-- lida pelo servidor do catálogo (/api/frete e /api/pedidos) e editável na aba Frete das
-- Configurações do interno. Aditiva e idempotente (ON CONFLICT DO NOTHING preserva edições).
-- Modo progressivo: cada trecho de km é cobrado pela taxa da sua faixa.
-- Origem = cozinha (CEP 09784-410, Rua João XXIII 39, Montanhão/SBC).

INSERT INTO public.configuracoes (chave, valor)
VALUES (
    'frete_config',
    '{
        "modo": "progressivo",
        "origem": { "lat": -23.7205964, "lng": -46.524444, "label": "Cozinha — Montanhão/SBC", "cep": "09784-410" },
        "faixas": [
            { "ateKm": 4, "valorPorKm": 2.0 },
            { "ateKm": 8, "valorPorKm": 4.0 },
            { "ateKm": 12, "valorPorKm": 6.5 }
        ],
        "foraDoAlcance": "a_combinar"
    }'::jsonb
)
ON CONFLICT (chave) DO NOTHING;
