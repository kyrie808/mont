-- Rollback de 20261106215818_contatos_segmento: remove só os objetos criados por ela.
-- Antes de rodar, voltar o app para a versão que não lê view_contatos_segmento
-- (senão Gestão de Clientes, Ranking e perfil do cliente quebram).
drop view if exists public.view_contatos_segmento;
drop function if exists public.fn_contatos_segmento(date);
notify pgrst, 'reload schema';
