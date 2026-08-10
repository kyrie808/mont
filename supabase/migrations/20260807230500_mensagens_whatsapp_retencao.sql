-- Retenção de conversa (LGPD).
--
-- `mensagens_whatsapp` guarda conteúdo de conversa de cliente — o dado mais sensível
-- do sistema. Guardar pra sempre não tem justificativa de negócio e é passivo puro.
--
-- Depois de 12 meses o conteúdo é apagado, mas a LINHA fica: os metadados de
-- atribuição (`referral`, `telefone_wa`, `direcao`, `enviada_em`) sustentam o histórico
-- de ROAS e não são conteúdo de conversa. `payload` também vai embora — é o webhook
-- cru, que contém o texto.
--
-- Anonimiza em vez de deletar de propósito: apagar a linha quebraria a contagem de
-- pontos de contato do histórico, e o que a LGPD pede é a minimização do dado
-- pessoal, não a destruição do fato de que houve conversa.

CREATE OR REPLACE FUNCTION public.fn_purgar_conteudo_whatsapp(p_meses int DEFAULT 12)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_afetadas int;
BEGIN
  UPDATE public.mensagens_whatsapp
     SET conteudo = NULL,
         payload  = jsonb_build_object('purgado_em', now(), 'motivo', 'retencao_12m')
   WHERE enviada_em < now() - make_interval(months => p_meses)
     AND (conteudo IS NOT NULL OR payload ? 'data');

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  RETURN v_afetadas;
END;
$$;

COMMENT ON FUNCTION public.fn_purgar_conteudo_whatsapp(int) IS
  'Apaga conteudo e payload de mensagens com mais de N meses, preservando metadados de atribuicao. Roda por cron.';

-- SECURITY DEFINER só pro cron. Ninguém chama isso pela API.
REVOKE EXECUTE ON FUNCTION public.fn_purgar_conteudo_whatsapp(int) FROM PUBLIC, anon, authenticated;

-- Dia 1 de cada mês, 4h da manhã.
SELECT cron.schedule(
  'purgar-conteudo-whatsapp-mensal',
  '0 4 1 * *',
  $cron$ SELECT public.fn_purgar_conteudo_whatsapp(12); $cron$
);

NOTIFY pgrst, 'reload schema';
