-- Agenda de Retornos — Onda 1: banco (planejamento em docs/agenda-retornos/README.md,
-- diagnóstico e decisões em docs/agenda-retornos/diagnostico.md, seções 10 e 12).
--
-- Hoje os retornos com cliente vivem em observação de venda, previsão de pagamento e
-- lembrete externo, e ninguém é avisado. Aqui o banco vira a fonte única:
--
--   1. Tabela `lembretes`: o que foi combinado à mão (ou gravado pelo Claude), no dia certo,
--      ligado a cliente e/ou venda.
--   2. Venda paga fecha sozinha os lembretes de cobrança e parcela dela; venda cancelada
--      cancela. Estorno e descancelamento reabrem SÓ o que esta regra fechou (simetria, a
--      mesma lição do estoque de 26/07). Ninguém cobra quem já pagou.
--   3. Leituras da Agenda (tela e aviso das 8h leem as MESMAS funções, nada é copiado):
--        agenda_itens(inicio, fim) → lembretes + vencimentos + entregas + contas a pagar
--                                    + retomadas do Relacionamento, numa lista só
--        agenda_atrasados()        → lembretes pendentes vencidos + vencimentos atrasados
--        agenda_sem_data()         → vendas em aberto sem previsão de pagamento
--
-- Fuso: o banco roda em UTC. "Hoje" é SEMPRE (now() AT TIME ZONE 'America/Sao_Paulo')::date,
-- fixado aqui dentro, para não depender do ALTER DATABASE ainda pendente (fix/fuso-brasilia).
-- Brinde (pago=false, entregue) nunca é dinheiro a receber: fica fora de vencimentos,
-- atrasados e sem data. Mas é uma entrega de verdade: entra na camada entrega, com valor 0.
-- Uma dívida, um item: venda com lembrete PENDENTE de parcela/cobrança sai da camada
-- vencimento — o lembrete passa a ser o dono da cobrança (ex.: Ana Maria, previsão 07/11 e
-- duas parcelas de R$ 32,50 em 07/11 e 07/12). Feito o último, o vencimento volta, se a
-- venda continuar em aberto.
-- Valores em REAIS (numeric), como o resto do banco.
--
-- Teste: supabase/tests/agenda_lembretes.sql (transação descartada, nada persiste).
-- NÃO altera o trigger de pagamentos_venda: a regra nova reage à mudança de vendas.pago/status,
-- então pega todos os caminhos (pagamento, quitar, marcar pago à mão, cancelar, sync do
-- catálogo, recebido pelo entregador).

-- ── 1. Tabela ────────────────────────────────────────────────────────────────────

CREATE TABLE public.lembretes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            text NOT NULL,
  descricao         text,
  -- Sem hora = dia inteiro, como no Google Agenda.
  data              date NOT NULL,
  hora              time,
  tipo              text NOT NULL,
  -- SET NULL: excluir venda/contato não pode falhar por causa de um lembrete
  -- (vendaService.deleteVenda apaga a venda direto). O lembrete fica, sem o vínculo.
  contato_id        uuid REFERENCES public.contatos (id) ON DELETE SET NULL,
  venda_id          uuid REFERENCES public.vendas (id) ON DELETE SET NULL,
  -- Valor combinado da parcela/cobrança. NULL = a Agenda mostra o em aberto da venda.
  valor             numeric(10,2),
  -- Texto e não FK: o sistema tem um login de admin só, auth.uid() não diz quem é quem.
  responsavel       text,
  situacao          text NOT NULL DEFAULT 'pendente',
  -- Preenchidos pelo trigger fn_lembretes_regras na conclusão; zerados ao reabrir.
  concluido_em      timestamptz,
  concluido_por     uuid,
  motivo_conclusao  text,
  -- Controlado pelo banco: soma 1 cada vez que a data de um lembrete pendente muda.
  vezes_reagendado  integer NOT NULL DEFAULT 0,
  origem            text NOT NULL DEFAULT 'manual',
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_by        uuid,

  CONSTRAINT lembretes_titulo_preenchido CHECK (btrim(titulo) <> ''),
  CONSTRAINT lembretes_tipo_check CHECK (
    tipo IN ('parcela', 'cobranca', 'pendencia_interna', 'retorno_comercial', 'outro')),
  CONSTRAINT lembretes_responsavel_check CHECK (
    responsavel IS NULL OR responsavel IN ('luccas', 'gilmar', 'equipe')),
  CONSTRAINT lembretes_situacao_check CHECK (situacao IN ('pendente', 'feito', 'cancelado')),
  CONSTRAINT lembretes_motivo_check CHECK (
    motivo_conclusao IS NULL OR motivo_conclusao IN ('manual', 'venda_paga', 'venda_cancelada')),
  CONSTRAINT lembretes_origem_check CHECK (origem IN ('manual', 'automacao', 'claude')),
  CONSTRAINT lembretes_vezes_reagendado_check CHECK (vezes_reagendado >= 0),
  CONSTRAINT lembretes_valor_positivo CHECK (valor IS NULL OR valor > 0),
  -- Pendente não tem conclusão; feito/cancelado sempre têm quando e por quê.
  -- (concluido_por pode ser NULL: conclusão feita pelo Claude via SQL não tem auth.uid().)
  CONSTRAINT lembretes_conclusao_coerente CHECK (
    (situacao = 'pendente' AND concluido_em IS NULL AND concluido_por IS NULL AND motivo_conclusao IS NULL)
    OR (situacao <> 'pendente' AND concluido_em IS NOT NULL AND motivo_conclusao IS NOT NULL)),
  -- venda_paga só fecha como feito; venda_cancelada só como cancelado.
  CONSTRAINT lembretes_motivo_coerente CHECK (
    motivo_conclusao IS NULL
    OR motivo_conclusao = 'manual'
    OR (motivo_conclusao = 'venda_paga' AND situacao = 'feito')
    OR (motivo_conclusao = 'venda_cancelada' AND situacao = 'cancelado'))
);

COMMENT ON TABLE public.lembretes IS
  'Agenda de Retornos: combinados com cliente e pendências internas, no dia certo. Datas que o sistema já tem (vencimento, entrega, conta a pagar, retomada) NÃO são copiadas para cá — são lidas por agenda_itens().';
COMMENT ON COLUMN public.lembretes.hora IS 'NULL = dia inteiro.';
COMMENT ON COLUMN public.lembretes.tipo IS
  'parcela | cobranca (fecham sozinhos quando a venda é paga) | pendencia_interna | retorno_comercial (combinado fora do WhatsApp; os do WhatsApp vêm de interacoes.retomar_em) | outro';
COMMENT ON COLUMN public.lembretes.valor IS
  'Valor combinado da parcela (ex.: R$ 32,50 de uma venda de R$ 65). NULL = agenda_itens mostra o em aberto da venda.';
COMMENT ON COLUMN public.lembretes.responsavel IS 'luccas | gilmar | equipe. Texto porque o sistema tem um login de admin só.';
COMMENT ON COLUMN public.lembretes.motivo_conclusao IS
  'manual | venda_paga | venda_cancelada. Os dois últimos são gravados pelo trigger trg_venda_fecha_lembretes, e só esses ele reabre.';
COMMENT ON COLUMN public.lembretes.vezes_reagendado IS 'Soma 1 a cada mudança de data de um lembrete pendente (trigger). Mostra o retorno que fica sendo empurrado.';
COMMENT ON COLUMN public.lembretes.origem IS 'manual (tela) | automacao | claude (gravado direto no banco pelo Claude; created_by fica NULL).';

CREATE INDEX idx_lembretes_data ON public.lembretes (data);
CREATE INDEX idx_lembretes_pendentes_data ON public.lembretes (data) WHERE situacao = 'pendente';
CREATE INDEX idx_lembretes_venda ON public.lembretes (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX idx_lembretes_contato ON public.lembretes (contato_id) WHERE contato_id IS NOT NULL;

-- ── 2. Regras do próprio lembrete ────────────────────────────────────────────────

CREATE TRIGGER tr_lembretes_audit
  BEFORE INSERT OR UPDATE ON public.lembretes
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_fields();

-- Na linha, antes de gravar:
--   • venda ligada → o cliente é o da venda (preenche se vazio; recusa se for outro cliente);
--   • parcela/cobrança não nasce nem é religada (venda_id ou tipo mudando) numa venda já paga
--     ou cancelada — seria cobrança que nunca fecha. Pendência interna e outros tipos podem.
--     Reabrir não passa por aqui: o trigger da venda só reabre quando ela volta a ficar em aberto;
--   • mudar a data de um pendente soma 1 em vezes_reagendado (a tela não controla o contador);
--   • concluir (feito/cancelado) carimba quando e quem, motivo 'manual' se ninguém disse outro;
--   • reabrir (pendente) apaga a conclusão.
CREATE OR REPLACE FUNCTION public.fn_lembretes_regras()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_venda record;
  v_religou boolean;
BEGIN
  IF NEW.venda_id IS NOT NULL AND (
       TG_OP = 'INSERT'
       OR NEW.venda_id IS DISTINCT FROM OLD.venda_id
       OR NEW.contato_id IS DISTINCT FROM OLD.contato_id
       OR NEW.tipo IS DISTINCT FROM OLD.tipo) THEN
    SELECT v.contato_id, v.pago, v.status INTO v_venda FROM public.vendas v WHERE v.id = NEW.venda_id;

    IF NEW.contato_id IS NULL THEN
      NEW.contato_id := v_venda.contato_id;
    ELSIF NEW.contato_id IS DISTINCT FROM v_venda.contato_id THEN
      RAISE EXCEPTION 'Lembrete ligado a uma venda de outro cliente'
        USING ERRCODE = '23514';
    END IF;

    v_religou := TG_OP = 'INSERT'
                 OR NEW.venda_id IS DISTINCT FROM OLD.venda_id
                 OR NEW.tipo IS DISTINCT FROM OLD.tipo;
    IF v_religou AND NEW.tipo IN ('parcela', 'cobranca') THEN
      IF v_venda.status = 'cancelada' THEN
        RAISE EXCEPTION 'Essa venda está cancelada'
          USING ERRCODE = '23514', HINT = 'Parcela e cobrança só podem ser ligadas a venda em aberto.';
      ELSIF v_venda.pago THEN
        RAISE EXCEPTION 'Essa venda já está paga'
          USING ERRCODE = '23514', HINT = 'Parcela e cobrança só podem ser ligadas a venda em aberto.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.vezes_reagendado := 0;
  ELSE
    NEW.vezes_reagendado := OLD.vezes_reagendado
      + CASE WHEN OLD.situacao = 'pendente' AND NEW.data IS DISTINCT FROM OLD.data THEN 1 ELSE 0 END;
  END IF;

  IF NEW.situacao = 'pendente' THEN
    NEW.concluido_em := NULL;
    NEW.concluido_por := NULL;
    NEW.motivo_conclusao := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.concluido_em := now();
    NEW.concluido_por := auth.uid();
    NEW.motivo_conclusao := COALESCE(NEW.motivo_conclusao, 'manual');
  ELSIF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    NEW.concluido_em := now();
    NEW.concluido_por := auth.uid();
    -- Motivo que veio no próprio UPDATE (o trigger da venda manda venda_paga/venda_cancelada)
    -- vale; senão é conclusão manual.
    IF NEW.motivo_conclusao IS NOT DISTINCT FROM OLD.motivo_conclusao THEN
      NEW.motivo_conclusao := 'manual';
    END IF;
  ELSE
    -- Já concluído e continua concluído: a conclusão não muda.
    NEW.concluido_em := OLD.concluido_em;
    NEW.concluido_por := OLD.concluido_por;
    NEW.motivo_conclusao := OLD.motivo_conclusao;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lembretes_regras
  BEFORE INSERT OR UPDATE ON public.lembretes
  FOR EACH ROW EXECUTE FUNCTION public.fn_lembretes_regras();

-- ── 3. Venda paga fecha; cancelada cancela; estorno e descancelamento reabrem ──────
--
-- Reage a vendas.pago e vendas.status. O trigger_update_venda_pagamento (pagamentos_venda)
-- fica como está: quando ele recalcula pago, este dispara em seguida.
-- Só tipos parcela e cobranca: pendência interna, retorno comercial e "outro" ligados à
-- venda são trabalho que continua existindo (ex.: "devolver o dinheiro da venda cancelada").
--
-- Ordem (importa quando status e pago mudam no mesmo UPDATE, como em cancelVenda):
--   1. descancelou       → reabre os que o cancelamento fechou
--   2. estornou (pago true→false, venda não cancelada) → reabre os que o pagamento fechou
--   3. cancelou          → pendentes viram cancelado / venda_cancelada
--   4. está paga e não cancelada, e acabou de pagar ou de descancelar
--                        → pendentes viram feito / venda_paga
-- Venda paga e depois cancelada (cancelVenda zera pago): os fechados como venda_paga ficam
-- feitos — eles foram pagos de fato; o passo 2 não roda em venda cancelada.
CREATE OR REPLACE FUNCTION public.fn_venda_fecha_lembretes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_cancelou    boolean := NEW.status = 'cancelada' AND OLD.status <> 'cancelada';
  v_descancelou boolean := OLD.status = 'cancelada' AND NEW.status <> 'cancelada';
  v_pagou       boolean := NEW.pago AND NOT OLD.pago;
  v_estornou    boolean := OLD.pago AND NOT NEW.pago;
BEGIN
  IF v_descancelou THEN
    UPDATE public.lembretes
       SET situacao = 'pendente'
     WHERE venda_id = NEW.id
       AND situacao = 'cancelado'
       AND motivo_conclusao = 'venda_cancelada';
  END IF;

  IF v_estornou AND NEW.status <> 'cancelada' THEN
    UPDATE public.lembretes
       SET situacao = 'pendente'
     WHERE venda_id = NEW.id
       AND situacao = 'feito'
       AND motivo_conclusao = 'venda_paga';
  END IF;

  IF v_cancelou THEN
    UPDATE public.lembretes
       SET situacao = 'cancelado', motivo_conclusao = 'venda_cancelada'
     WHERE venda_id = NEW.id
       AND situacao = 'pendente'
       AND tipo IN ('parcela', 'cobranca');
  END IF;

  IF NEW.pago AND NEW.status <> 'cancelada' AND (v_pagou OR v_descancelou) THEN
    UPDATE public.lembretes
       SET situacao = 'feito', motivo_conclusao = 'venda_paga'
     WHERE venda_id = NEW.id
       AND situacao = 'pendente'
       AND tipo IN ('parcela', 'cobranca');
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_venda_fecha_lembretes
  AFTER UPDATE OF pago, status ON public.vendas
  FOR EACH ROW
  WHEN (OLD.pago IS DISTINCT FROM NEW.pago OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_venda_fecha_lembretes();

-- ── 4. RLS e permissões ───────────────────────────────────────────────────────────
-- Mesmo padrão de metas_mensais: só admin. Há usuários autenticados que não são admin
-- (entregador). O Claude grava via SQL direto (role postgres), fora do RLS.

ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY lembretes_select_admin ON public.lembretes
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY lembretes_insert_admin ON public.lembretes
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY lembretes_update_admin ON public.lembretes
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY lembretes_delete_admin ON public.lembretes
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- Default privilege do Supabase dá tudo a anon na criação; anon nunca toca nisto.
REVOKE ALL ON public.lembretes FROM anon;

-- ── 5. Leituras da Agenda ─────────────────────────────────────────────────────────
-- SECURITY INVOKER (padrão): o RLS de quem chama vale. Admin vê tudo; não-admin recebe
-- lista vazia (vendas, contatos, contas_a_pagar e lembretes são só-admin, e toda linha
-- de cliente passa por JOIN em contatos). A Edge Function do aviso (Onda 2) chama como
-- service_role.
--
-- Formato único de item:
--   origem           lembrete | vencimento | entrega | conta_pagar | retomada
--   id               id do registro original (lembretes / vendas / contas_a_pagar / interacoes)
--   data, hora       hora só existe em lembrete; NULL = dia inteiro
--   titulo           lembrete: o título · venda e retomada: nome do cliente · conta: credor — descrição
--   descricao        lembrete: descrição · venda: observações · conta: observação · retomada: nota da interação
--   tipo             tipo do lembrete; NULL nas camadas
--   situacao         lembrete: pendente/feito · camadas: sempre 'pendente' (em aberto por definição)
--   atrasado         pendente com data < hoje (Brasília) — calculado aqui, a tela não recalcula
--   contato_*        cliente (id, nome, telefone para o WhatsApp)
--   venda_id, forma_pagamento
--   valor            em aberto (total − valor_pago) nas vendas; 0 na entrega de brinde; saldo
--                    devedor na conta a pagar; no lembrete, o valor combinado (lembretes.valor)
--                    ou, sem ele, o em aberto da venda ligada; senão NULL

CREATE OR REPLACE FUNCTION public.agenda_itens(p_inicio date, p_fim date)
RETURNS TABLE (
  origem           text,
  id               uuid,
  data             date,
  hora             time,
  titulo           text,
  descricao        text,
  tipo             text,
  situacao         text,
  atrasado         boolean,
  contato_id       uuid,
  contato_nome     text,
  contato_telefone text,
  venda_id         uuid,
  forma_pagamento  text,
  valor            numeric
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  WITH hoje AS (
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS dia
  ),
  -- Retomadas: o mesmo critério da cadência em view_relacionamento_kanban. Vale o
  -- retomar_em da ÚLTIMA saída/adiamento depois da última resposta do cliente (ou
  -- movimentação manual do card). Respondeu depois → a retomada some.
  respostas AS (
    SELECT i.contato_id, max(i.data) AS reset_at
      FROM public.interacoes i
     WHERE (i.tipo = 'ponto_contato'
            AND i.resultado IS DISTINCT FROM 'adiou'
            AND (i.sentido = 'entrada' OR i.resultado IN ('respondeu', 'aceitou', 'recusou')))
        OR i.tipo = 'movimentacao_kanban'
     GROUP BY i.contato_id
  ),
  ultima_saida AS (
    SELECT DISTINCT ON (i.contato_id) i.id, i.contato_id, i.retomar_em, i.observacao
      FROM public.interacoes i
      LEFT JOIN respostas r ON r.contato_id = i.contato_id
     WHERE i.tipo = 'ponto_contato'
       AND ((i.sentido = 'saida' AND i.resultado IS NULL) OR i.resultado = 'adiou')
       AND (r.reset_at IS NULL OR i.data > r.reset_at)
     ORDER BY i.contato_id, i.data DESC
  )
  SELECT 'lembrete'::text, l.id, l.data, l.hora, l.titulo, l.descricao, l.tipo, l.situacao,
         (l.situacao = 'pendente' AND l.data < h.dia),
         l.contato_id, c.nome, c.telefone, l.venda_id, v.forma_pagamento,
         COALESCE(l.valor,
                  CASE WHEN v.id IS NOT NULL AND NOT v.pago AND v.status <> 'cancelada' AND v.forma_pagamento <> 'brinde'
                       THEN v.total - COALESCE(v.valor_pago, 0) END)
    FROM public.lembretes l
    CROSS JOIN hoje h
    LEFT JOIN public.contatos c ON c.id = l.contato_id
    LEFT JOIN public.vendas v ON v.id = l.venda_id
   WHERE l.data BETWEEN p_inicio AND p_fim
     AND l.situacao <> 'cancelado'

  UNION ALL
  -- Vencimentos: previsão de pagamento de venda em aberto. Some sozinho quando a venda é paga,
  -- e enquanto houver lembrete pendente de parcela/cobrança ligado a ela.
  SELECT 'vencimento', v.id, v.data_prevista_pagamento, NULL::time, c.nome, v.observacoes, NULL::text, 'pendente',
         (v.data_prevista_pagamento < h.dia),
         c.id, c.nome, c.telefone, v.id, v.forma_pagamento, v.total - COALESCE(v.valor_pago, 0)
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    CROSS JOIN hoje h
   WHERE NOT v.pago
     AND v.status <> 'cancelada'
     AND v.forma_pagamento <> 'brinde'
     AND v.data_prevista_pagamento BETWEEN p_inicio AND p_fim
     AND NOT EXISTS (
           -- O lembrete pendente de parcela/cobrança é o dono desta dívida: um item só.
           SELECT 1 FROM public.lembretes lp
            WHERE lp.venda_id = v.id
              AND lp.situacao = 'pendente'
              AND lp.tipo IN ('parcela', 'cobranca'))

  UNION ALL
  -- Entregas previstas de venda ainda pendente. Some quando a venda é entregue.
  -- Brinde entra: é uma entrega de verdade, só não é dinheiro (valor 0).
  SELECT 'entrega', v.id, v.data_entrega_prevista, NULL::time, c.nome, v.observacao_entregador, NULL::text, 'pendente',
         (v.data_entrega_prevista < h.dia),
         c.id, c.nome, c.telefone, v.id, v.forma_pagamento,
         CASE WHEN v.pago OR v.forma_pagamento = 'brinde' THEN 0 ELSE v.total - COALESCE(v.valor_pago, 0) END
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    CROSS JOIN hoje h
   WHERE v.status = 'pendente'
     AND v.data_entrega_prevista BETWEEN p_inicio AND p_fim

  UNION ALL
  -- Contas a pagar em aberto (cada parcela é uma linha). Some quando é paga.
  SELECT 'conta_pagar', cp.id, cp.data_vencimento, NULL::time,
         -- A descrição das parceladas já diz "Parcela N/M" (criar_obrigacao_parcelada).
         concat(cp.credor, ' — ', cp.descricao),
         cp.observacao, NULL::text, 'pendente',
         (cp.data_vencimento < h.dia),
         NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text,
         COALESCE(cp.saldo_devedor, cp.valor_total - cp.valor_pago)
    FROM public.contas_a_pagar cp
    CROSS JOIN hoje h
   WHERE cp.status <> 'pago'
     AND cp.data_vencimento BETWEEN p_inicio AND p_fim

  UNION ALL
  -- Retomadas do Relacionamento ("me chama semana que vem"), só leitura.
  SELECT 'retomada', u.id, u.retomar_em, NULL::time, c.nome, u.observacao, NULL::text, 'pendente',
         (u.retomar_em < h.dia),
         c.id, c.nome, c.telefone, NULL::uuid, NULL::text, NULL::numeric
    FROM ultima_saida u
    JOIN public.contatos c ON c.id = u.contato_id
    CROSS JOIN hoje h
   WHERE u.retomar_em BETWEEN p_inicio AND p_fim
     AND c.arquivado_em IS NULL
     AND c.status_relacionamento::text IN ('contatado', 'em_negociacao', 'follow_up')

  ORDER BY 3, 4 NULLS FIRST, 1, 5
$$;

COMMENT ON FUNCTION public.agenda_itens(date, date) IS
  'Agenda: tudo entre p_inicio e p_fim (inclusive) numa lista só — lembretes (sem os cancelados), vencimentos (sem brinde; sem a venda que tem lembrete pendente de parcela/cobrança), entregas previstas (brinde com valor 0), contas a pagar, retomadas. Hoje = Brasília.';

-- Faixa de Atrasados: dois grupos (origem = lembrete | vencimento), mesmo formato de item.
-- A mesma regra de dono da cobrança de agenda_itens: venda com parcela/cobrança pendente
-- aparece pelo lembrete (no grupo lembrete, se a data dele já passou), não pelo vencimento.
-- Contas a pagar atrasadas não entram (decisão D9: lembretes + vencimentos); elas aparecem
-- no próprio dia, com atrasado = true, em agenda_itens.
CREATE OR REPLACE FUNCTION public.agenda_atrasados()
RETURNS TABLE (
  origem           text,
  id               uuid,
  data             date,
  hora             time,
  titulo           text,
  descricao        text,
  tipo             text,
  situacao         text,
  atrasado         boolean,
  contato_id       uuid,
  contato_nome     text,
  contato_telefone text,
  venda_id         uuid,
  forma_pagamento  text,
  valor            numeric
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  WITH hoje AS (
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS dia
  )
  SELECT 'lembrete'::text, l.id, l.data, l.hora, l.titulo, l.descricao, l.tipo, l.situacao, true,
         l.contato_id, c.nome, c.telefone, l.venda_id, v.forma_pagamento,
         COALESCE(l.valor,
                  CASE WHEN v.id IS NOT NULL AND NOT v.pago AND v.status <> 'cancelada' AND v.forma_pagamento <> 'brinde'
                       THEN v.total - COALESCE(v.valor_pago, 0) END)
    FROM public.lembretes l
    CROSS JOIN hoje h
    LEFT JOIN public.contatos c ON c.id = l.contato_id
    LEFT JOIN public.vendas v ON v.id = l.venda_id
   WHERE l.situacao = 'pendente'
     AND l.data < h.dia

  UNION ALL
  SELECT 'vencimento', v.id, v.data_prevista_pagamento, NULL::time, c.nome, v.observacoes, NULL::text, 'pendente', true,
         c.id, c.nome, c.telefone, v.id, v.forma_pagamento, v.total - COALESCE(v.valor_pago, 0)
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    CROSS JOIN hoje h
   WHERE NOT v.pago
     AND v.status <> 'cancelada'
     AND v.forma_pagamento <> 'brinde'
     AND v.data_prevista_pagamento < h.dia
     AND NOT EXISTS (
           -- O lembrete pendente de parcela/cobrança é o dono desta dívida: um item só.
           SELECT 1 FROM public.lembretes lp
            WHERE lp.venda_id = v.id
              AND lp.situacao = 'pendente'
              AND lp.tipo IN ('parcela', 'cobranca'))

  ORDER BY 1, 3, 4 NULLS FIRST, 5
$$;

COMMENT ON FUNCTION public.agenda_atrasados() IS
  'Faixa de Atrasados da Agenda: lembretes pendentes com data < hoje e vendas em aberto (sem brinde, sem lembrete pendente de parcela/cobrança) com previsão de pagamento < hoje. Hoje = Brasília.';

-- "X em aberto sem data": vendas não pagas, não canceladas, sem brinde, sem previsão de
-- pagamento e sem lembrete pendente de parcela/cobrança — hoje não aparecem em lugar nenhum. A tela conta e quebra por forma_pagamento
-- (decisão D8: todo não-brinde, não só fiado) e abre esta lista para preencher a data.
CREATE OR REPLACE FUNCTION public.agenda_sem_data()
RETURNS TABLE (
  venda_id          uuid,
  data_venda        date,
  dias_em_aberto    integer,
  contato_id        uuid,
  contato_nome      text,
  contato_telefone  text,
  forma_pagamento   text,
  status            text,
  valor             numeric
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  WITH hoje AS (
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS dia
  )
  SELECT v.id, v.data, (h.dia - v.data), c.id, c.nome, c.telefone, v.forma_pagamento, v.status,
         v.total - COALESCE(v.valor_pago, 0)
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    CROSS JOIN hoje h
   WHERE NOT v.pago
     AND v.status <> 'cancelada'
     AND v.forma_pagamento <> 'brinde'
     AND v.data_prevista_pagamento IS NULL
     AND NOT EXISTS (
           -- Com parcela/cobrança pendente a venda já tem data: a do lembrete (dono da cobrança).
           SELECT 1 FROM public.lembretes lp
            WHERE lp.venda_id = v.id
              AND lp.situacao = 'pendente'
              AND lp.tipo IN ('parcela', 'cobranca'))
   ORDER BY v.forma_pagamento, v.data
$$;

COMMENT ON FUNCTION public.agenda_sem_data() IS
  'Vendas em aberto (sem brinde, não canceladas, sem lembrete pendente de parcela/cobrança) sem previsão de pagamento. Contagem e quebra por forma_pagamento saem desta lista. dias_em_aberto conta a partir de hoje em Brasília.';

-- Funções nascem executáveis por PUBLIC; anon nunca chama.
REVOKE EXECUTE ON FUNCTION public.agenda_itens(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.agenda_atrasados() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.agenda_sem_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_itens(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agenda_atrasados() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agenda_sem_data() TO authenticated, service_role;
