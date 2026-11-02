-- Bloco C (31/10/2026): conferência de hora em hora.
--
-- Na Black quem atende no WhatsApp é a equipe; o analista só lê a conversa. Duas tabelas:
--   • pedidos_conversa — o pedido FECHADO que o analista extraiu de uma conversa (critério
--     aprovado pelo Luccas em 30/10: aceite do cliente + item com quantidade + confirmação da
--     equipe ou comprovante + sem desistência). A conferência procura a venda do contato.
--   • alertas_operacao — cada alerta da conferência, uma vez só (UNIQUE tipo+ref), com o que
--     saiu e quando. Pedido sem venda vai ao grupo; Meta vai só ao Luccas. Horário 8h–21h SP
--     e resumo da noite moram em packages/shared/src/conferencia.ts.
-- Escrita só pela service_role (Edge Functions); leitura para admin.

CREATE TABLE public.pedidos_conversa (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id      uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  interacao_id    uuid UNIQUE REFERENCES public.interacoes(id) ON DELETE SET NULL,
  message_ids     text[] NOT NULL,
  fechado_em      timestamptz NOT NULL,
  itens           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens) = 'array'),
  forma_pagamento text CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao', 'fiado')),
  entrega         text CHECK (entrega IN ('retirada', 'entrega')),
  total_citado    numeric CHECK (total_citado > 0),
  confirmacao     text NOT NULL CHECK (confirmacao IN ('equipe', 'comprovante', 'nenhuma')),
  faltam_sabores  boolean NOT NULL DEFAULT false,
  trecho          text CHECK (char_length(trecho) <= 150),
  -- 'falhou' = o analista disse "aceitou" mas a leitura do pedido não saiu: alerta mesmo
  -- assim (melhor conferir à toa que deixar um pedido sem venda).
  extracao        text NOT NULL CHECK (extracao IN ('ok', 'falhou')),
  -- A venda que a conferência achou para este pedido (null = ainda não achou).
  venda_id        uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pedidos_conversa_contato ON public.pedidos_conversa (contato_id);
CREATE INDEX idx_pedidos_conversa_venda ON public.pedidos_conversa (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX idx_pedidos_conversa_sem_venda ON public.pedidos_conversa (fechado_em) WHERE venda_id IS NULL;
COMMENT ON TABLE public.pedidos_conversa IS
  'Pedido fechado numa conversa do WhatsApp, lido pelo analista (bloco C, Black 2026). Sem endereço, por regra. A conferência alerta o grupo se não houver venda em 3 h.';

CREATE TABLE public.alertas_operacao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text NOT NULL CHECK (tipo IN ('pedido_sem_venda', 'anuncio_sem_purchase', 'evento_meta')),
  ref         text NOT NULL,
  destino     text NOT NULL CHECK (destino IN ('grupo', 'luccas')),
  vence_em    timestamptz NOT NULL,
  texto       text NOT NULL,
  status      text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'resolvido')),
  enviado_em  timestamptz,
  message_id  text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, ref),
  CHECK ((status = 'enviado') = (enviado_em IS NOT NULL))
);
CREATE INDEX idx_alertas_operacao_pendentes ON public.alertas_operacao (vence_em) WHERE status = 'pendente';
COMMENT ON TABLE public.alertas_operacao IS
  'Alertas da conferência de hora em hora (uma vez por tipo+ref). resolvido = deixou de valer antes de sair (ex.: a venda foi lançada).';

ALTER TABLE public.pedidos_conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_operacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin lê pedidos da conversa" ON public.pedidos_conversa
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY "Admin lê alertas da operação" ON public.alertas_operacao
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
REVOKE ALL ON public.pedidos_conversa, public.alertas_operacao FROM anon;

NOTIFY pgrst, 'reload schema';
