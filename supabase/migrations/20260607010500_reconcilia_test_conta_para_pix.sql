-- Reconcilia vendas reais que caíram no __TEST__Conta (d1485f56) por causa do bug do
-- dropdown de pagamento (PaymentSidebar listava conta inativa e a selecionava como default).
-- Move os lançamentos pro 'Pix' (ceed4504) e deleta o __TEST__Conta.
--
-- O trigger tr_lancamentos_saldo (AFTER UPDATE) reajusta os saldos automaticamente:
-- __TEST__Conta drena pra 0, Pix recebe +3625. NÃO editamos saldo_atual na mão (Regra #3).
--
-- Composição (por pagamentos_venda.metodo): pix 53 / dinheiro 6 / cartão 3 = R$3.625.
-- Destino físico real é desconhecido (resolvido no zero-day) — consolidar no Pix é o passo intermediário.
-- Backup: dump-*-20260607-010331 + supabase/backups/dumps/restore-test-conta-transplante-20260607.sql

update public.lancamentos
set conta_id = 'ceed4504-2408-4646-96b4-a8d89068c3e0'  -- Pix
where conta_id = 'd1485f56-e8f5-4a3e-84bb-cb104ba7a695';  -- __TEST__Conta

delete from public.contas
where id = 'd1485f56-e8f5-4a3e-84bb-cb104ba7a695';  -- __TEST__Conta (agora sem referências)
