drop policy "Authenticated insert interacoes" on public.interacoes;

create policy "Authenticated insert own interacoes"
on public.interacoes
for insert
to authenticated
with check (criado_por = auth.uid() or criado_por is null);

create or replace function public.fn_mover_card_relacionamento(
  p_contato_id uuid,
  p_novo_status public.enum_relacionamento_status,
  p_observacao text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.contatos
  set status_relacionamento = p_novo_status
  where id = p_contato_id;

  if not found then
    raise exception 'Contato % nao encontrado', p_contato_id;
  end if;

  insert into public.interacoes (
    contato_id,
    canal,
    tipo,
    resultado,
    observacao,
    criado_por
  ) values (
    p_contato_id,
    'sistema',
    'movimentacao_kanban',
    p_novo_status::text,
    p_observacao,
    auth.uid()
  );
end;
$$;

comment on column public.interacoes.resultado is 'Valores variam por tipo: para tipo=movimentacao_kanban guarda novo status; para tipo=ligacao guarda outcome (atendeu/caixa_postal/etc).';
