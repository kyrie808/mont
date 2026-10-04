-- `retomado_em`: quando a Marcia puxou o cliente que montou pedido e parou de responder.
--
-- O abandono passa a ter DUAS etapas. Antes, 30 minutos de silencio marcavam o rascunho
-- como `abandonado` e avisavam a equipe — o cliente nunca ouvia nada, e a equipe recebia
-- um ⏳ para um pedido que talvez so precisasse de "quer que eu feche?".
--
--   rascunho parado 30 min  ->  MARCIA manda mensagem ao cliente  (retomado_em := now())
--   ainda parado + 30 min   ->  ⏳ no grupo da equipe              (status := 'abandonado')
--   cliente respondeu       ->  nada; ela conduz
--   humano falou            ->  nada, em nenhuma das duas etapas
--
-- ⚠️ POR QUE NAO EXISTE UMA SEGUNDA COLUNA DE RELOGIO: o trigger
-- `trg_wa_pedido_atualizado_em` (BEFORE UPDATE) carimba `atualizado_em := now()` em
-- QUALQUER update desta tabela, sobrescrevendo valor forcado. Entao o proprio UPDATE que
-- seta `retomado_em` bumpa `atualizado_em`, e o relogio da Etapa 2 passa a contar da
-- retomada de graca. A Etapa 1 e `retomado_em IS NULL`; a Etapa 2 e
-- `retomado_em IS NOT NULL`. O indice (status, atualizado_em DESC) que ja existe serve as
-- duas, e nenhum indice novo e necessario.
--
-- Efeito colateral aceito: se o cliente responder sem MUDAR o pedido (ex. "vou pensar"),
-- `atualizado_em` nao bumpa e a Etapa 2 dispara 30 min depois. Isso e desejavel — cliente
-- engajado que nao fechou e exatamente o caso que vale contar para a equipe. O guard de
-- `humanoAssumiu` continua valendo nas duas etapas.

ALTER TABLE public.wa_pedido
  ADD COLUMN IF NOT EXISTS retomado_em timestamptz;

COMMENT ON COLUMN public.wa_pedido.retomado_em IS
  'Quando a agente puxou o cliente (etapa 1 do abandono). NULL = ainda nao puxou.';

NOTIFY pgrst, 'reload schema';
