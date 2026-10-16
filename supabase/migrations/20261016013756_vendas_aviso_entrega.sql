-- Rodada 2, item C (Luccas, 15/10/2026): aviso automático de entrega no grupo #ENTREGAS.
-- Hoje uma entrega deixou de sair porque o aviso não foi enviado.
--
--   • data_entrega_prevista: o dia em que a venda deve ser entregue. Só venda COM esta data
--     entra no automático (as pendentes antigas sem data ficam de fora, de propósito).
--     Não confundir com data_entrega, que é o dia em que a entrega ACONTECEU (preenchida ao
--     marcar entregue; alimenta o extrato do entregador).
--   • aviso_grupo_enviado_em: quando o aviso saiu no grupo. Preenchido = nunca reenvia.
--
-- Dados: Valéria (1b25d669…) e Maria Perdigão (9de0ad9e…) — entrega prevista 16/10, já
-- avisadas à mão pelo Luccas no #ENTREGAS em 15/10; marcadas como avisadas às 19:00 para a
-- automação NÃO reenviar.

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS data_entrega_prevista date,
  ADD COLUMN IF NOT EXISTS aviso_grupo_enviado_em timestamptz;

COMMENT ON COLUMN public.vendas.data_entrega_prevista IS
  'Dia previsto para a entrega. Só venda com esta data entra no aviso automático do grupo #ENTREGAS. (data_entrega = dia em que a entrega aconteceu.)';
COMMENT ON COLUMN public.vendas.aviso_grupo_enviado_em IS
  'Quando o aviso da entrega saiu no grupo #ENTREGAS. Preenchido = a automação não reenvia.';

-- Fila do aviso: vendas pendentes com data prevista e ainda não avisadas.
CREATE INDEX IF NOT EXISTS idx_vendas_aviso_entrega_pendente
  ON public.vendas (data_entrega_prevista)
  WHERE status = 'pendente' AND aviso_grupo_enviado_em IS NULL AND data_entrega_prevista IS NOT NULL;

UPDATE public.vendas
   SET data_entrega_prevista  = DATE '2026-10-16',
       aviso_grupo_enviado_em = TIMESTAMPTZ '2026-10-15 19:00:00-03'
 WHERE id IN ('1b25d669-0450-498b-9c00-c1ece557b347', '9de0ad9e-7e01-4223-afa7-e94dbb450357')
   AND status = 'pendente';

NOTIFY pgrst, 'reload schema';
