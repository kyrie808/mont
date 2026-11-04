-- Limpeza da Parte B (04/11/2026): a loja e o pedido não leem mais loja_vitrine (tudo vem do
-- cadastro do produto: produtos.esgotado, produtos.nome_loja, subtítulo, Destaque, tela Catálogo).
-- Conferido antes: nenhuma função, view, FK, cron ou código usa a tabela.
-- Backup antes: supabase/backups/dumps/dump-*-20261104-043107.sql e as 22 linhas em
-- supabase/backups/20261104_loja_vitrine_removida.csv.
-- Vão junto as policies e o gatilho dela; a função update_atualizado_em fica (outras tabelas usam).
DROP TABLE public.loja_vitrine;
