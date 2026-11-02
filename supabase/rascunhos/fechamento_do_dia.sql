-- Fechamento do dia — os dados de UM dia de Brasília (00h00–23h59), em JSON.
-- Rascunho: vira a função public.fechamento_do_dia(p_dia date) depois do OK nos exemplos.
-- O texto da mensagem mora em packages/shared/src/conferencia.ts (textoFechamento).
--
-- "Hoje" = vendas.data = o dia (a data da venda, que o formulário preenche com hoje).
-- Vendas canceladas não contam. Brinde fica fora do placar (não é venda).
with lim as (
  select d::date as dia,
         (d::date::timestamp at time zone 'America/Sao_Paulo') as ini,
         ((d::date + 1)::timestamp at time zone 'America/Sao_Paulo') as fim
    from (select :'dia'::date as d) x
),
vh as (
  select v.id, v.contato_id, v.criado_em, v.total, v.taxa_entrega, v.status, v.pago, v.forma_pagamento,
         v.data_entrega_prevista, v.entregador_id, c.nome, c.ctwa_clid,
         coalesce(nullif(trim(c.logradouro), ''), nullif(trim(c.endereco), '')) as endereco
    from public.vendas v join public.contatos c on c.id = v.contato_id, lim
   where v.data = lim.dia and v.status <> 'cancelada'
),
problemas as (
  select vh.*, array_remove(array[
           case when vh.forma_pagamento = 'venda' and not vh.pago then 'sem forma de pagamento' end,
           case when vh.status = 'pendente' and vh.data_entrega_prevista is null then 'sem data de entrega' end,
           case when vh.status = 'pendente' and vh.endereco is null then 'sem endereço' end,
           case when vh.total = 0 and vh.forma_pagamento <> 'brinde' then 'total zerado' end
         ], null) as faltas
    from vh
),
aceitos as (
  select i.contato_id, c.nome, i.data as em, i.observacao
    from public.interacoes i join public.contatos c on c.id = i.contato_id, lim
   where i.gerado_por_ia and i.resultado = 'aceitou' and i.data >= lim.ini and i.data < lim.fim
     and not exists (
       select 1 from public.vendas v
        where v.contato_id = i.contato_id and v.status <> 'cancelada'
          -- Venda do contato lançada no dia (antes ou depois do registro do analista, que só
          -- sai depois de 30 min de silêncio) resolve.
          and v.criado_em >= lim.ini and v.criado_em < lim.fim + interval '3 hours')
),
duplas as (
  select a.contato_id, a.nome, a.id as a_id, b.id as b_id, a.total as a_total, b.total as b_total, a.criado_em as a_em, b.criado_em as b_em
    from vh a join vh b on b.contato_id = a.contato_id and b.criado_em > a.criado_em
   where abs(a.total - b.total) <= greatest(5, 0.1 * greatest(a.total, b.total))
),
amanha as (
  select v.id, coalesce(nullif(trim(c.bairro), ''), 'sem bairro') as bairro, c.nome
    from public.vendas v join public.contatos c on c.id = v.contato_id, lim
   where v.status = 'pendente' and v.data_entrega_prevista = lim.dia + 1
),
separar as (
  select p.nome as produto, sum(iv.quantidade) as qtd
    from amanha a join public.itens_venda iv on iv.venda_id = a.id join public.produtos p on p.id = iv.produto_id
   group by p.nome
),
reservado as (
  select iv.produto_id, sum(iv.quantidade) as qtd
    from public.vendas v join public.itens_venda iv on iv.venda_id = v.id
   where v.status = 'pendente'
   group by iv.produto_id
),
faltam as (
  select p.nome, p.estoque_atual as estoque, r.qtd as reservado, r.qtd - p.estoque_atual as falta
    from public.produtos p join reservado r on r.produto_id = p.id
   where p.ativo and p.categoria = 'doces' and p.estoque_atual - r.qtd < 0
)
select jsonb_build_object(
  'dia', (select dia from lim),
  'aceitos_sem_venda', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'em', em, 'observacao', observacao) order by em) from aceitos), '[]'),
  'vendas_com_falta', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'total', total, 'faltas', faltas, 'em', criado_em) order by criado_em) from problemas where cardinality(faltas) > 0), '[]'),
  'duplicadas', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'a_total', a_total, 'b_total', b_total, 'a_em', a_em, 'b_em', b_em) order by a_em) from duplas), '[]'),
  'entregas_amanha', coalesce((select jsonb_agg(jsonb_build_object('bairro', bairro, 'clientes', clientes) order by bairro) from (select bairro, jsonb_agg(nome order by nome) as clientes from amanha group by bairro) b), '[]'),
  'separar', coalesce((select jsonb_agg(jsonb_build_object('produto', produto, 'qtd', qtd) order by qtd desc, produto) from separar), '[]'),
  'falta_doces', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'estoque', estoque, 'reservado', reservado, 'falta', falta) order by falta desc) from faltam), '[]'),
  'placar', (select jsonb_build_object(
      'vendas', count(*) filter (where forma_pagamento <> 'brinde'),
      'faturamento', coalesce(sum(total - coalesce(taxa_entrega, 0)) filter (where forma_pagamento <> 'brinde'), 0),
      'de_anuncio', count(*) filter (where forma_pagamento <> 'brinde' and ctwa_clid is not null)) from vh)
) as fechamento;
