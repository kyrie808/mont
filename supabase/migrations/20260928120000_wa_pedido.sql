-- Pedido que a secretária monta com o cliente, como DADO e não como frase.
--
-- Até 26/09/2026 o pedido era um texto que o próprio modelo escrevia. Três defeitos em
-- produção saíram disso: somar o pedido da véspera ("4 kg" a partir de 2 kg), gravar
-- antes de o cliente confirmar, e anotar "500 g de chipa" — embalagem que não existe.
-- Quatro tentativas de proibir por prompt falharam.
--
-- A garantia agora é a FK: item sem produto real não entra, nem que o modelo queira.

CREATE TABLE IF NOT EXISTS public.wa_pedido (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id    uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  telefone_wa   text NOT NULL,
  status        text NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho','confirmado','abandonado')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  confirmado_em timestamptz,
  interacao_id  uuid REFERENCES public.interacoes(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.wa_pedido IS
  'Pedido em construcao na conversa da secretaria de IA. Nao e venda: quem fecha e humano.';

-- No maximo UM rascunho por contato. Sem isto, duas execucoes simultaneas do W3 (o
-- debounce ja produziu isso em campo) criam dois rascunhos paralelos do mesmo cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_pedido_aberto
  ON public.wa_pedido (contato_id) WHERE status = 'rascunho';

CREATE INDEX IF NOT EXISTS idx_wa_pedido_status
  ON public.wa_pedido (status, atualizado_em DESC);

CREATE TABLE IF NOT EXISTS public.wa_pedido_item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES public.wa_pedido(id) ON DELETE CASCADE,
  produto_id      uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade      integer NOT NULL CHECK (quantidade > 0),
  preco_unitario  numeric NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.wa_pedido_item.preco_unitario IS
  'Preco que a agente FALOU para o cliente. Nao re-consultar: e promessa feita.';

-- Um produto aparece uma vez por pedido. "mais 1 kg de chipa" e alteracao de quantidade,
-- nunca segunda linha — acaba a ambiguidade "somar ou substituir" que gerou o 4 kg.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_pedido_item
  ON public.wa_pedido_item (pedido_id, produto_id);

-- Escrita: so service_role (a Edge Function). Leitura: admin, para auditoria.
ALTER TABLE public.wa_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_pedido_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ler wa_pedido" ON public.wa_pedido;
CREATE POLICY "Admins podem ler wa_pedido"
  ON public.wa_pedido FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins podem ler wa_pedido_item" ON public.wa_pedido_item;
CREATE POLICY "Admins podem ler wa_pedido_item"
  ON public.wa_pedido_item FOR SELECT TO authenticated USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
