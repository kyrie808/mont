-- Renomeia a conta "Pix" para "InfinityPay - Mont" (mesma conta/saldo — só rótulo).
-- Contas são referenciadas por id (lancamentos/pagamentos), não por nome → seguro.
-- tipo permanece 'pix' (a conta continua recebendo pix).

UPDATE public.contas
SET nome = 'InfinityPay - Mont'
WHERE nome = 'Pix' AND tipo = 'pix';
