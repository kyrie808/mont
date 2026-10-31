-- Meta CAPI: envio de hora em hora + status `descartado` para evento fora da janela de 7 dias.
--
-- Por quê: 3 Purchase ficaram em `erro` com 5 tentativas gastas (100 / subcode 2804003,
-- "evento com mais de 7 dias"). São vendas de 03/06, 05/06 e 12/07 marcadas como
-- entregues só em 18-20/10; o gatilho usa a data da venda como horário do evento. Mandar
-- com a data de hoje declararia à Meta uma compra que não aconteceu hoje, então não há
-- reenvio possível: o evento sai da conta de erro, com o motivo, sem ser apagado.
-- Daqui em diante o worker descarta sozinho, sem chamar a API, o que passar da janela.

-- 1. Status novo + motivo obrigatório quando descartado.
ALTER TABLE public.meta_eventos ADD COLUMN motivo_descarte text;

ALTER TABLE public.meta_eventos DROP CONSTRAINT meta_eventos_status_check;
ALTER TABLE public.meta_eventos ADD CONSTRAINT meta_eventos_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'enviado'::text, 'erro'::text, 'descartado'::text]));

ALTER TABLE public.meta_eventos ADD CONSTRAINT meta_eventos_descartado_tem_motivo_check
  CHECK ((status = 'descartado') = (motivo_descarte IS NOT NULL));

COMMENT ON COLUMN public.meta_eventos.motivo_descarte IS
  'Por que o evento não vai à Meta. Obrigatório quando status = descartado (ex.: fora_da_janela_7d).';

-- 2. Os 3 eventos de out/2026: só os que estão em erro pelo subcode 2804003.
UPDATE public.meta_eventos
   SET status = 'descartado',
       motivo_descarte = 'fora_da_janela_7d'
 WHERE status = 'erro'
   AND resposta_meta -> 'error' ->> 'error_subcode' = '2804003'
   AND event_id IN (
     'venda_082444db-9b68-4f65-9714-0489167a1a7d',
     'venda_6d27255c-ceb1-4453-9069-d911901c5bbf',
     'venda_e48b0daf-aaaa-4b7b-94fa-573849475b60'
   );

-- 3. Cron: de diário (03:00 BRT) para de hora em hora, permanente (decisão do Luccas, 30/10).
--    Mesmo comando; só muda o nome e o agendamento.
SELECT cron.unschedule('meta-capi-flush-diario');

SELECT cron.schedule(
  'meta-capi-flush-horario',
  '0 * * * *',
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
