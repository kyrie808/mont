-- Limpeza da Parte A da paridade (03/11/2026), depois do merge 7a6506a no ar.
-- As colunas antigas da vitrine (seção em texto e ordem própria) só serviam à versão anterior da
-- loja; a loja publicada agora usa a seção e a ordem do cadastro (secao_id / ordem_loja opcionais).
-- Ninguém mais as lê: loja_criar_pedido não usa, e o código só referencia secao_id/ordem_loja.
-- Backup antes: supabase/backups/dumps/dump-*-20261103-010256.sql

ALTER TABLE public.loja_vitrine DROP COLUMN secao;   -- leva junto o CHECK loja_vitrine_secao_check
ALTER TABLE public.loja_vitrine DROP COLUMN ordem;

NOTIFY pgrst, 'reload schema';
