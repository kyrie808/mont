create type public.enum_relacionamento_status as enum (
  'a_contatar',
  'contatado',
  'em_negociacao',
  'resolvido'
);

create type public.enum_relacionamento_aba as enum (
  'reativacao',
  'recompra',
  'cobranca'
);

alter table public.contatos
  add column arquivado_em timestamptz null,
  add column status_relacionamento public.enum_relacionamento_status not null default 'a_contatar';

create table public.interacoes (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references public.contatos(id) on delete cascade,
  data timestamptz not null default now(),
  canal text,
  tipo text,
  resultado text,
  observacao text,
  criado_por uuid references auth.users(id)
);

alter table public.interacoes enable row level security;

create index idx_interacoes_contato_data on public.interacoes (contato_id, data desc);
create index idx_interacoes_criado_por on public.interacoes (criado_por);

create or replace view public.view_relacionamento_kanban as
with config as (
  select
    coalesce((valor->>'b2c')::int, 15) as ciclo_b2c,
    coalesce((valor->>'b2b')::int, 7) as ciclo_b2b
  from public.configuracoes
  where chave = 'ciclo_recompra'
  limit 1
),
ultima_compra as (
  select
    v.contato_id,
    max(v.data) as ultima_compra_data
  from public.vendas v
  where v.status = 'entregue'
    and v.forma_pagamento <> 'brinde'
  group by v.contato_id
),
fiado_aberto as (
  select
    v.contato_id,
    bool_or(
      v.status = 'entregue'
      and v.forma_pagamento = 'fiado'
      and v.pago = false
    ) as tem_fiado_aberto
  from public.vendas v
  group by v.contato_id
)
select
  c.id as contato_id,
  c.nome,
  c.telefone,
  c.status_relacionamento,
  c.arquivado_em,
  (
    case
      when coalesce(fa.tem_fiado_aberto, false) then 'cobranca'::public.enum_relacionamento_aba
      when (
        current_date
        - coalesce(
            uc.ultima_compra_data,
            c.ultimo_contato::date,
            c.criado_em::date
          )
      ) > (
        case
          when c.tipo = 'B2B'
            then coalesce((select ciclo_b2b from config), 7)
          else
            coalesce((select ciclo_b2c from config), 15)
        end
      ) then 'reativacao'::public.enum_relacionamento_aba
      else 'recompra'::public.enum_relacionamento_aba
    end
  ) as aba_atual
from public.contatos c
left join ultima_compra uc on uc.contato_id = c.id
left join fiado_aberto fa on fa.contato_id = c.id;
