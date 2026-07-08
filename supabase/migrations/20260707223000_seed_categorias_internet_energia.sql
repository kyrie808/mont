-- Seed de categorias de despesa FIXAS: "Internet" e "Energia / Luz".
-- Contas de consumo mensais que não existiam no plano_de_contas (só havia "Celular").
-- Aditivo e idempotente (WHERE NOT EXISTS) — não toca linhas existentes.
-- automatica=false → aparecem nos seletores de categoria; codigo null (como Celular/Embalagens).

INSERT INTO public.plano_de_contas (nome, tipo, categoria, ativo, automatica)
SELECT v.nome, 'despesa', 'fixa', true, false
FROM (VALUES ('Internet'), ('Energia / Luz')) AS v(nome)
WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_de_contas p
    WHERE p.nome = v.nome AND p.tipo = 'despesa'
);
