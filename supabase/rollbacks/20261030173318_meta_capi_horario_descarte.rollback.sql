-- Rollback de meta_capi_horario_descarte. Volta o cron diário e o status sem `descartado`.
-- Os eventos descartados voltam a `erro` (com 5 tentativas, como estavam antes).
SELECT cron.unschedule('meta-capi-flush-horario');
SELECT cron.schedule(
  'meta-capi-flush-diario',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url     := 'https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/meta-capi-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'meta_capi_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $cron$
);

UPDATE public.meta_eventos SET status = 'erro', tentativas = 5 WHERE status = 'descartado';
ALTER TABLE public.meta_eventos DROP CONSTRAINT meta_eventos_descartado_tem_motivo_check;
ALTER TABLE public.meta_eventos DROP CONSTRAINT meta_eventos_status_check;
ALTER TABLE public.meta_eventos ADD CONSTRAINT meta_eventos_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'enviado'::text, 'erro'::text]));
ALTER TABLE public.meta_eventos DROP COLUMN motivo_descarte;
