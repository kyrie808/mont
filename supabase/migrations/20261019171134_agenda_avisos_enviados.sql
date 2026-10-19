-- Agenda de Retornos — Onda 2: marca do aviso diário das 8h (docs/agenda-retornos,
-- diagnóstico §12, decisão D14).
--
-- O W6 (n8n) pede o texto do dia à Edge Function `avisos-agenda` e manda no grupo Equipe.
-- "Nunca envia duas vezes no mesmo dia" precisa de uma marca gravada: uma linha por dia,
-- com o dia como chave primária. A ação marcar_enviado grava com ON CONFLICT DO NOTHING —
-- o segundo envio do mesmo dia não regrava o primeiro, e do_dia não devolve texto para um
-- dia que já tem marca.
--
-- RLS ligada e SEM policy: só a service_role (Edge Function) lê e grava. Ninguém do app
-- precisa disto; anon e authenticated ficam sem privilégio nenhum.
--
-- Teste: supabase/tests/agenda_avisos_enviados.sql (transação descartada).

CREATE TABLE public.agenda_avisos_enviados (
  -- Dia do aviso no calendário de Brasília.
  dia         date PRIMARY KEY,
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  -- key.id que a Evolution devolve no envio.
  message_id  text,
  -- JID do grupo para onde saiu (constante validada na Edge Function).
  destino     text NOT NULL,
  CONSTRAINT agenda_avisos_enviados_destino_preenchido CHECK (btrim(destino) <> '')
);

COMMENT ON TABLE public.agenda_avisos_enviados IS
  'Aviso diário da Agenda (W6, 8h, grupo Equipe): uma linha por dia já enviado. Só service_role.';

ALTER TABLE public.agenda_avisos_enviados ENABLE ROW LEVEL SECURITY;

-- Default privilege do Supabase dá tudo a anon e authenticated na criação; aqui ninguém do
-- app toca. service_role bypassa RLS e mantém o privilégio padrão.
REVOKE ALL ON public.agenda_avisos_enviados FROM anon, authenticated;
