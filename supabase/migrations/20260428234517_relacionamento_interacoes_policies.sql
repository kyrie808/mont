create policy "Authenticated read interacoes"
on public.interacoes
for select
to authenticated
using (true);

create policy "Authenticated insert interacoes"
on public.interacoes
for insert
to authenticated
with check (true);

create policy "Admin manage interacoes"
on public.interacoes
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
