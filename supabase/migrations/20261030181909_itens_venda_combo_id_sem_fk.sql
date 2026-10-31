-- Correção de 20261030181711: a FK itens_venda.combo_id → produtos criou uma SEGUNDA relação
-- entre itens_venda e produtos, e o PostgREST passa a recusar como ambíguo todo embed
-- `itens_venda(*, produto:produtos(...))` — usado pelo interno, pelo catálogo e pelo app do
-- entregador já publicados. A coluna fica; a integridade vem de quem grava: só a criar_venda
-- preenche combo_id, e só com um combo validado pela combo_itens.
ALTER TABLE public.itens_venda DROP CONSTRAINT itens_venda_combo_id_fkey;
COMMENT ON COLUMN public.itens_venda.combo_id IS
  'Combo de onde a linha veio (os sabores e fixos viram itens próprios, com o preço do combo rateado). NULL = item avulso. Sem FK de propósito: uma segunda FK para produtos tornaria ambíguo o embed itens_venda → produtos no PostgREST. Só a criar_venda grava, com combo validado.';
NOTIFY pgrst, 'reload schema';
