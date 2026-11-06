-- Segmento, termômetro e resumo de compras por contato, calculados no banco.
--
-- Motivo (06/11/2026): Gestão de Clientes listava `contatos` inteira e contava no navegador.
-- O PostgREST devolve no máximo 1000 linhas por requisição (max_rows), então "Todos" travava
-- em 1000 com 1013+ contatos, os contadores de segmento saíam baixos e o termômetro lia a
-- `view_relacionamento_kanban` (1006 linhas) cortada. Agora a lista pagina no servidor e os
-- contadores são contagens no banco sobre esta view.
--
-- Só cria objetos novos. Nada existente é alterado.
--
-- REGRAS ESPELHADAS (mudar uma = mudar a outra; a suíte de paridade compara as duas):
--   segmento      = classificarContato     (apps/interno/src/utils/segmentoCliente.ts)
--   temperatura   = temperaturaCliente     (apps/interno/src/utils/temperaturaCliente.ts)
--                   sobre as métricas da view_relacionamento_kanban
--   origem_rotulo = origemBadge(...).label (apps/interno/src/utils/origemContato.ts)
--   precisa_revisao = precisaRevisao       (apps/interno/src/utils/filaRevisao.ts)
--
-- Data de referência: o dia de São Paulo, não o do servidor (UTC). Com CURRENT_DATE, entre
-- 21h e 00h o contato mudaria de faixa um dia antes. A função recebe a data para a suíte de
-- paridade comparar app × banco no mesmo dia.

create function public.fn_contatos_segmento(p_hoje date)
returns table (
    contato_id        uuid,
    nome              text,
    tipo              text,
    criado_em         timestamptz,
    nome_norm         text,
    apelido_norm      text,
    telefone_norm     text,
    indicado_por_id   uuid,
    arquivado_em      timestamptz,
    origem_rotulo     text,
    segmento          text,
    precisa_revisao   boolean,
    total_compras     bigint,
    total_gasto       numeric,
    ultima_compra     date,
    total_pedidos     integer,
    intervalo_medio   numeric,
    dias_sem_compra   integer,
    atraso            integer,
    sumido            boolean,
    temperatura       text,
    temperatura_ordem integer
)
language sql
stable
security invoker
set search_path = ''
as $$
    with cfg as (
        -- mesmo default da view_relacionamento_kanban
        select coalesce(max((c.valor ->> 'multiplicador_sumido')::numeric), 1.5) as multiplicador_sumido
        from public.configuracoes c
        where c.chave = 'relacionamento'
    ),
    compras as (
        -- "comprou" = venda ENTREGUE não-brinde, paga ou não (regra de contato_compras_resumo
        -- e da view_relacionamento_kanban; `<> 'brinde'` também deixa de fora forma nula, igual a elas)
        select
            v.contato_id,
            count(v.id)                                            as total_compras,
            coalesce(sum(v.total - coalesce(v.taxa_entrega, 0)), 0) as total_gasto,
            max(v.data)                                            as ultima_compra,
            min(v.data)                                            as primeira_compra,
            count(distinct v.data)::integer                        as total_pedidos
        from public.vendas v
        where v.status = 'entregue' and v.forma_pagamento <> 'brinde'
        group by v.contato_id
    ),
    base as (
        select
            c.*,
            coalesce(cp.total_compras, 0)  as cp_total_compras,
            coalesce(cp.total_gasto, 0)    as cp_total_gasto,
            cp.ultima_compra               as cp_ultima_compra,
            cp.primeira_compra             as cp_primeira_compra,
            -- Ritmo só para contato não arquivado: a view_relacionamento_kanban filtra
            -- arquivados, e sem linha nela o termômetro do app é "novo".
            case when c.arquivado_em is null then coalesce(cp.total_pedidos, 0) end as rt_total_pedidos
        from public.contatos c
        left join compras cp on cp.contato_id = c.id
    ),
    metricas as (
        select
            b.*,
            case when b.rt_total_pedidos is not null then p_hoje - b.cp_ultima_compra end as rt_dias_sem_compra,
            case when b.rt_total_pedidos >= 2
                 then (b.cp_ultima_compra - b.cp_primeira_compra)::numeric / (b.rt_total_pedidos - 1) end as rt_intervalo_medio,
            case when b.rt_total_pedidos >= 2
                 then b.cp_ultima_compra + ((b.cp_ultima_compra - b.cp_primeira_compra) / (b.rt_total_pedidos - 1)) end as rt_proxima
        from base b
    ),
    ritmo as (
        select
            m.*,
            p_hoje - m.rt_proxima as rt_atraso,
            case when m.rt_total_pedidos is null then null
                 when m.rt_proxima is not null
                      and (p_hoje - m.rt_proxima)::numeric >= round(m.rt_intervalo_medio * cfg.multiplicador_sumido)
                 then true else false end as rt_sumido
        from metricas m
        cross join cfg
    ),
    final as (
        select
            r.*,
            case
                when r.rt_total_pedidos is null or r.rt_total_pedidos < 2
                     or r.rt_atraso is null or r.rt_intervalo_medio is null then 'novo'
                when r.rt_sumido  then 'frio'
                when r.rt_atraso < 0 then 'quente'
                else 'morno'
            end as temp
        from ritmo r
    )
    select
        f.id,
        f.nome,
        f.tipo,
        f.criado_em,
        f.nome_norm,
        f.apelido_norm,
        f.telefone_norm,
        f.indicado_por_id,
        f.arquivado_em,
        case f.origem
            when 'anuncio' then
                case f.fonte
                    when 'meta_ads'   then 'Meta Ads'
                    when 'google_ads' then 'Google Ads'
                    when 'tiktok_ads' then 'TikTok Ads'
                    else 'Anúncio'
                end
            when 'indicacao' then 'Indicação'
            when 'catalogo'  then 'Catálogo'
            when 'facebook'  then 'Facebook'
            when 'direto'    then 'Direto'
            when 'whatsapp'  then 'WhatsApp'
            else case when coalesce(f.origem, '') = '' then '—'
                      else upper(left(f.origem, 1)) || substr(f.origem, 2) end
        end,
        -- Cascata de classificarContato: Fornecedor → Lead → Inativo (>90d) → VIP (≥7 ou ≥R$500) → Cliente
        case
            when f.tipo = 'FORNECEDOR' or f.status = 'fornecedor' then 'fornecedor'
            when f.cp_total_compras = 0 then 'lead'
            when f.cp_ultima_compra is not null and p_hoje - f.cp_ultima_compra > 90 then 'inativo'
            when f.cp_total_compras >= 7 or f.cp_total_gasto >= 500 then 'vip'
            else 'cliente'
        end,
        coalesce(f.origem_cadastro = 'whatsapp' and f.revisado_em is null, false),
        f.cp_total_compras,
        f.cp_total_gasto,
        f.cp_ultima_compra,
        f.rt_total_pedidos,
        f.rt_intervalo_medio,
        f.rt_dias_sem_compra,
        f.rt_atraso,
        f.rt_sumido,
        f.temp,
        -- ordem da coluna Temperatura no app: frio → morno → quente → novo
        case f.temp when 'frio' then 0 when 'morno' then 1 when 'quente' then 2 else 3 end
    from final f
$$;

comment on function public.fn_contatos_segmento(date) is
    'Segmento/termômetro/resumo por contato na data p_hoje. Espelha classificarContato, temperaturaCliente e origemBadge do interno (suíte: supabase/tests/contatos_segmento_paridade.mjs).';

create view public.view_contatos_segmento
with (security_invoker = true) as
select *
from public.fn_contatos_segmento((now() at time zone 'America/Sao_Paulo')::date);

comment on view public.view_contatos_segmento is
    'Gestão de Clientes: um contato por linha com segmento, termômetro e compras no dia de São Paulo. Lista paginada e contadores leem daqui.';

-- Só o app logado usa. RLS das tabelas de origem vale (security invoker).
revoke all on function public.fn_contatos_segmento(date) from public, anon;
grant execute on function public.fn_contatos_segmento(date) to authenticated, service_role;
revoke all on public.view_contatos_segmento from anon;
grant select on public.view_contatos_segmento to authenticated, service_role;

notify pgrst, 'reload schema';
