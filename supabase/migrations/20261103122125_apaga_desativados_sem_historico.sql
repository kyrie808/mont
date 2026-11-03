-- Apaga 10 produtos DESATIVADOS sem nenhum histórico (pedido do Luccas, 03/11/2026).
-- Backup: dump-*-20261103-091705.sql + CSVs supabase/backups/20261103_produtos_desativados_apagados_*.csv
-- (produtos, produto_componentes, sis_imagens_produto, cat_imagens_produto).
--
-- Ficam só desativados (não apagados):
--   - os 6 com venda (Kit Mãezona, kit Baldão, #Titular/#Time Completo/#Seleção Refri,
--     Combo Balde 4kg + Palito 1kg): o histórico aponta para eles;
--   - Coca Cola 2,5L e Guaraná 2.5L: são componentes dos combos Refri que têm venda
--     (produto_componentes.componente_id é RESTRICT, e tirá-los mudaria esses combos).
--
-- Vão junto, por ON DELETE CASCADE: composição dos combos apagados, imagens (sis/cat),
-- vitrine e grupos de sabor (estes dois vazios para os 10). Os arquivos no Storage ficam.
-- Antes de apagar, confere de novo cada ligação; qualquer uma → aborta tudo.

do $$
declare
    combos uuid[] := array[
        '27734895-dfe7-45e8-bf29-4ea9db16103c',  -- #Seleção - Cerveja
        '4316fef9-852e-4690-b8c8-5d98187c9d72',  -- #Time Completo - Cerveja
        'f55fb570-6127-421c-855f-de40db982c2f',  -- #Titular - Cerveja
        'bcda8c0d-7b46-4176-92dc-8f44f7786ffa',  -- Kit Top — Geleia de Frutas Vermelhas (Black)
        'e8fa7086-d64c-41ec-8829-e013b9ab923d',  -- Kit Top — Geleia de Goiaba (Black)
        'aa615fa9-4785-4bdd-8c1f-402b59cc6df8',  -- Kit Top — Geleia de Morango (Black)
        '1ced78ab-1fa1-4c69-b383-9c7811bf8632'   -- Combo Balde 4kg + Pão de Queijo 1kg
    ]::uuid[];
    avulsos uuid[] := array[
        '5acb6319-d1b1-4e15-8c79-edf0568f9d7e',  -- Budwaiser 269ml
        '0db3dd67-ce57-4850-8a8e-3136c9ecaf7a',  -- Original 269ml
        'f14d7140-d2cb-49db-96d6-85e483912c17'   -- Skol 269ml
    ]::uuid[];
    todos uuid[];
    n int;
begin
    todos := combos || avulsos;

    select count(*) into n from public.produtos where id = any(todos) and not ativo;
    if n <> 10 then raise exception 'Esperava 10 produtos desativados, achei %', n; end if;

    if exists (select 1 from public.itens_venda where produto_id = any(todos) or combo_id = any(todos)) then
        raise exception 'Tem venda (itens_venda)'; end if;
    if exists (select 1 from public.cat_itens_pedido where produto_id = any(todos) or combo_id = any(todos)) then
        raise exception 'Tem pedido do catálogo (cat_itens_pedido)'; end if;
    if exists (select 1 from public.wa_pedido_item where produto_id = any(todos)) then
        raise exception 'Tem pedido do WhatsApp (wa_pedido_item)'; end if;
    if exists (select 1 from public.purchase_order_items where product_id = any(todos)) then
        raise exception 'Tem compra (purchase_order_items)'; end if;
    if exists (select 1 from public.loja_precos where produto_id = any(todos)) then
        raise exception 'Tem preço de campanha (loja_precos)'; end if;
    if exists (select 1 from public.combo_grupo_opcoes where produto_id = any(todos)) then
        raise exception 'É opção de sabor (combo_grupo_opcoes)'; end if;
    -- Componente só pode ser de combo que também está sendo apagado.
    if exists (select 1 from public.produto_componentes where componente_id = any(todos) and not (combo_id = any(combos))) then
        raise exception 'É componente de combo que fica (produto_componentes)'; end if;

    -- Combos primeiro (cascata leva a composição); depois os avulsos, já sem referência.
    delete from public.produtos where id = any(combos);
    get diagnostics n = row_count;
    if n <> 7 then raise exception 'Combos: esperava 7, apagou %', n; end if;

    delete from public.produtos where id = any(avulsos);
    get diagnostics n = row_count;
    if n <> 3 then raise exception 'Avulsos: esperava 3, apagou %', n; end if;
end $$;
