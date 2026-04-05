-- Seed data mínimo para testes de integração
-- Executado automaticamente pelo `supabase db reset`

-- Produtos de teste
INSERT INTO "public"."produtos" (nome, codigo, preco, custo, unidade, visivel_catalogo, slug, categoria)
VALUES
    ('Pão de Queijo 1kg', 'PDQ001', 25.00, 13.00, 'kg', true, 'pao-de-queijo-1kg', 'pao_de_queijo'),
    ('Biscoito de Polvilho 500g', 'BPV001', 15.00, 7.50, 'un', true, 'biscoito-polvilho-500g', 'biscoito');

-- Conta padrão (necessária para fluxo financeiro)
INSERT INTO "public"."contas" (nome, tipo, saldo_inicial, saldo_atual)
VALUES
    ('Caixa Teste', 'dinheiro', 0, 0),
    ('Banco Teste', 'banco', 0, 0);

-- Plano de contas mínimo (se necessário para lançamentos)
INSERT INTO "public"."plano_de_contas" (nome, tipo, categoria, codigo)
VALUES
    ('Recebimento de Venda', 'receita', 'variavel', 'RECEBIMENTO_VENDA'),
    ('Custo de Mercadoria', 'despesa', 'variavel', 'CMV');
