-- E4: liga o analista de conversa (aprovado pelo Luccas em 15/10/2026, depois da
-- simulação final). A cada 15 min o pg_cron chama a Edge Function `whatsapp-analista`
-- (ação `rodar`, até 5 conversas por rodada; Groq gpt-oss-20b). Cada rodada vira uma linha
-- em wa_analista_rodadas.
--
-- Mesmo segredo dos outros crons (vault `meta_capi_cron_secret` → header x-cron-secret).
-- timeout de 150s: a rodada pode levar até ~110s (pausas pelo limite de tokens por minuto
-- do Groq); com o timeout padrão de 5s do pg_net a resposta se perderia.
--
-- Para desligar: SELECT cron.unschedule('whatsapp-analista-15min');

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'whatsapp-analista-15min';

SELECT cron.schedule(
  'whatsapp-analista-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-analista',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'meta_capi_cron_secret')
    ),
    body    := '{"acao":"rodar"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
