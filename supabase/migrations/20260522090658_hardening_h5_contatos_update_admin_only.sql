-- H-5: Restringir UPDATE em contatos a administradores apenas
-- Finding: H3 (audit-map) — "Authenticated update access" USING(true)/WITH CHECK(true) permite
-- que qualquer usuario autenticado atualize qualquer contato sem restricao.
-- Fix: substituir USING(true)/WITH CHECK(true) por (SELECT public.is_admin()).
-- Subselect evita re-avaliacao por linha (mesma otimizacao aplicada em H-3).

ALTER POLICY "Authenticated update access" ON public.contatos
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
