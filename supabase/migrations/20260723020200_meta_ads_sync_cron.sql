-- Fase 1 (Integração Meta): agenda o sync diário das campanhas de tráfego da Meta.
--
-- ⚠️ GO-LIVE: aplicar SÓ depois de (a) deployar a function `meta-ads-sync` e
-- (b) o Luccas configurar os secrets META_ADS_TOKEN / META_ADS_ACCOUNT_ID.
-- Antes disso a function responde 500 (token ausente) — o cron ficaria batendo à toa.
--
-- Reusa o mesmo segredo de cron do worker CAPI (vault `meta_capi_cron_secret` =
-- env CRON_SECRET, compartilhado pelas duas functions). Roda 6:30, logo após o CAPI (6:00).

select cron.schedule(
  'meta-ads-sync-diario',
  '30 6 * * *',
  $$
  select net.http_post(
    url     := 'https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/meta-ads-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'meta_capi_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
