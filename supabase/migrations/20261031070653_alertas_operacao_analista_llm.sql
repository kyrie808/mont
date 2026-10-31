-- Novo tipo de alerta da conferência: o analista ficou sem LLM (Groq e a reserva Cerebras
-- falharam todas as tentativas). Vai só ao Luccas, no máximo um por hora; as conversas
-- ficam na fila para a próxima rodada.
ALTER TABLE public.alertas_operacao DROP CONSTRAINT alertas_operacao_tipo_check;
ALTER TABLE public.alertas_operacao ADD CONSTRAINT alertas_operacao_tipo_check
  CHECK (tipo IN ('pedido_sem_venda', 'anuncio_sem_purchase', 'evento_meta', 'analista_llm'));
