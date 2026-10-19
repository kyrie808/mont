-- Agenda de Retornos — ajustes da revisão da Onda 2 + marca do aviso diário das 8h
-- (docs/agenda-retornos/diagnostico.md, §12 a §15). Depende de 20261019195019_agenda_lembretes.
--
--   1. "Não cobrar": contatos.cobranca_suspensa (+ motivo). As vendas de quem tem a cobrança
--      suspensa saem de vencimentos, atrasados e sem data. A dívida continua no sistema
--      (vendas, A Receber, relatórios) — só sai da agenda de cobrança. Esta migração NÃO
--      marca ninguém (caso real: o Gilmar pediu para nunca cobrar a Maria Joelma Vicente;
--      quem marca é o Claude, depois de aplicada).
--   2. Dono da cobrança = QUALQUER lembrete pendente ligado à venda (antes: só parcela e
--      cobrança). Pendência interna sobre a venda = venda em análise; não aparece ao mesmo
--      tempo como vencimento. O fechamento automático (trg_venda_fecha_lembretes) continua
--      só para parcela e cobrança — não muda aqui.
--   3. agenda_itens e agenda_atrasados devolvem também `responsavel` (do lembrete; NULL nas
--      camadas). Mudar o RETURNS TABLE exige DROP + CREATE; GRANTs e REVOKEs refeitos.
--   4. agenda_avisos_enviados: uma linha por dia de aviso enviado (dia PK). RLS sem policy,
--      só service_role (Edge Function avisos-agenda).
--
-- Testes: supabase/tests/agenda_lembretes.sql e supabase/tests/agenda_avisos_enviados.sql
-- (transação descartada).

-- ── 1. "Não cobrar" ──────────────────────────────────────────────────────────────

ALTER TABLE public.contatos
  ADD COLUMN cobranca_suspensa boolean NOT NULL DEFAULT false,
  ADD COLUMN cobranca_suspensa_motivo text;

COMMENT ON COLUMN public.contatos.cobranca_suspensa IS
  'true = não cobrar: as vendas deste contato saem de vencimentos, atrasados e sem data da Agenda. A dívida continua no sistema.';
COMMENT ON COLUMN public.contatos.cobranca_suspensa_motivo IS
  'Por que a cobrança foi suspensa (quem pediu, quando).';

-- ── 2 e 3. Leituras da Agenda ────────────────────────────────────────────────────
-- Mesmo corpo de 20261019195019_agenda_lembretes, com três mudanças:
--   • o NOT EXISTS do dono da cobrança vale para qualquer lembrete pendente da venda;
--   • vencimento/atraso/sem data ignoram contato com cobranca_suspensa;
--   • coluna nova `responsavel` no fim (as ordenações por posição não mudam).

DROP FUNCTION public.agenda_itens(date, date);
DROP FUNCTION public.agenda_atrasados();

CREATE FUNCTION public.agenda_itens(p_inicio date, p_fim date)
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
  valor            numeric,
  responsavel      text
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
                       THEN v.total - COALESCE(v.valor_pago, 0) END),
         l.responsavel
    FROM public.lembretes l
    CROSS JOIN hoje h
    LEFT JOIN public.contatos c ON c.id = l.contato_id
    LEFT JOIN public.vendas v ON v.id = l.venda_id
   WHERE l.data BETWEEN p_inicio AND p_fim
     AND l.situacao <> 'cancelado'

  UNION ALL
  -- Vencimentos: previsão de pagamento de venda em aberto. Some sozinho quando a venda é paga,
  -- enquanto houver lembrete pendente ligado a ela (qualquer tipo) e se o cliente estiver
  -- com a cobrança suspensa.
  SELECT 'vencimento', v.id, v.data_prevista_pagamento, NULL::time, c.nome, v.observacoes, NULL::text, 'pendente',
         (v.data_prevista_pagamento < h.dia),
         c.id, c.nome, c.telefone, v.id, v.forma_pagamento, v.total - COALESCE(v.valor_pago, 0),
         NULL::text
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    CROSS JOIN hoje h
   WHERE NOT v.pago
     AND v.status <> 'cancelada'
     AND v.forma_pagamento <> 'brinde'
     AND NOT c.cobranca_suspensa
     AND v.data_prevista_pagamento BETWEEN p_inicio AND p_fim
     AND NOT EXISTS (
           -- Lembrete pendente ligado à venda é o dono dela na agenda: um item só.
           SELECT 1 FROM public.lembretes lp
            WHERE lp.venda_id = v.id
              AND lp.situacao = 'pendente')

  UNION ALL
  -- Entregas previstas de venda ainda pendente. Some quando a venda é entregue.
  -- Brinde entra: é uma entrega de verdade, só não é dinheiro (valor 0). Cobrança suspensa
  -- não tira a entrega (entregar não é cobrar).
  SELECT 'entrega', v.id, v.data_entrega_prevista, NULL::time, c.nome, v.observacao_entregador, NULL::text, 'pendente',
         (v.data_entrega_prevista < h.dia),
         c.id, c.nome, c.telefone, v.id, v.forma_pagamento,
         CASE WHEN v.pago OR v.forma_pagamento = 'brinde' THEN 0 ELSE v.total - COALESCE(v.valor_pago, 0) END,
         NULL::text
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
         COALESCE(cp.saldo_devedor, cp.valor_total - cp.valor_pago),
         NULL::text
    FROM public.contas_a_pagar cp
    CROSS JOIN hoje h
   WHERE cp.status <> 'pago'
     AND cp.data_vencimento BETWEEN p_inicio AND p_fim

  UNION ALL
  -- Retomadas do Relacionamento ("me chama semana que vem"), só leitura.
  SELECT 'retomada', u.id, u.retomar_em, NULL::time, c.nome, u.observacao, NULL::text, 'pendente',
         (u.retomar_em < h.dia),
         c.id, c.nome, c.telefone, NULL::uuid, NULL::text, NULL::numeric,
         NULL::text
    FROM ultima_saida u
    JOIN public.contatos c ON c.id = u.contato_id
    CROSS JOIN hoje h
   WHERE u.retomar_em BETWEEN p_inicio AND p_fim
     AND c.arquivado_em IS NULL
     AND c.status_relacionamento::text IN ('contatado', 'em_negociacao', 'follow_up')

  ORDER BY 3, 4 NULLS FIRST, 1, 5
$$;

COMMENT ON FUNCTION public.agenda_itens(date, date) IS
  'Agenda: tudo entre p_inicio e p_fim (inclusive) numa lista só — lembretes (sem os cancelados), vencimentos (sem brinde; sem venda com lembrete pendente; sem cliente com cobrança suspensa), entregas previstas (brinde com valor 0), contas a pagar, retomadas. responsavel só no lembrete. Hoje = Brasília.';

-- Faixa de Atrasados: dois grupos (origem = lembrete | vencimento), mesmo formato de item.
-- Mesmas regras de agenda_itens: venda com lembrete pendente aparece pelo lembrete (no grupo
-- lembrete, se a data dele já passou), não pelo vencimento; cobrança suspensa fica fora.
-- Contas a pagar atrasadas não entram (decisão D9); aparecem no próprio dia em agenda_itens.
CREATE FUNCTION public.agenda_atrasados()
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
  valor            numeric,
  responsavel      text
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
                       THEN v.total - COALESCE(v.valor_pago, 0) END),
         l.responsavel
    FROM public.lembretes l
    CROSS JOIN hoje h
    LEFT JOIN public.contatos c ON c.id = l.contato_id
    LEFT JOIN public.vendas v ON v.id = l.venda_id
   WHERE l.situacao = 'pendente'
     AND l.data < h.dia

  UNION ALL
  SELECT 'vencimento', v.id, v.data_prevista_pagamento, NULL::time, c.nome, v.observacoes, NULL::text, 'pendente', true,
         c.id, c.nome, c.telefone, v.id, v.forma_pagamento, v.total - COALESCE(v.valor_pago, 0),
         NULL::text
    FROM public.vendas v
    JOIN public.contatos c ON c.id = v.contato_id
    CROSS JOIN hoje h
   WHERE NOT v.pago
     AND v.status <> 'cancelada'
     AND v.forma_pagamento <> 'brinde'
     AND NOT c.cobranca_suspensa
     AND v.data_prevista_pagamento < h.dia
     AND NOT EXISTS (
           -- Lembrete pendente ligado à venda é o dono dela na agenda: um item só.
           SELECT 1 FROM public.lembretes lp
            WHERE lp.venda_id = v.id
              AND lp.situacao = 'pendente')

  ORDER BY 1, 3, 4 NULLS FIRST, 5
$$;

COMMENT ON FUNCTION public.agenda_atrasados() IS
  'Faixa de Atrasados da Agenda: lembretes pendentes com data < hoje e vendas em aberto (sem brinde, sem lembrete pendente, sem cliente com cobrança suspensa) com previsão de pagamento < hoje. responsavel só no lembrete. Hoje = Brasília.';

-- "X em aberto sem data": mesma assinatura, então CREATE OR REPLACE basta.
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
     AND NOT c.cobranca_suspensa
     AND v.data_prevista_pagamento IS NULL
     AND NOT EXISTS (
           -- Com lembrete pendente a venda já tem data: a do lembrete (dono da cobrança).
           SELECT 1 FROM public.lembretes lp
            WHERE lp.venda_id = v.id
              AND lp.situacao = 'pendente')
   ORDER BY v.forma_pagamento, v.data
$$;

COMMENT ON FUNCTION public.agenda_sem_data() IS
  'Vendas em aberto (sem brinde, não canceladas, sem lembrete pendente, sem cliente com cobrança suspensa) sem previsão de pagamento. Contagem e quebra por forma_pagamento saem desta lista. dias_em_aberto conta a partir de hoje em Brasília.';

-- Funções nascem executáveis por PUBLIC; anon nunca chama. (DROP + CREATE perdeu os grants
-- de agenda_itens e agenda_atrasados; refeitos aqui, e reafirmados para agenda_sem_data.)
REVOKE EXECUTE ON FUNCTION public.agenda_itens(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.agenda_atrasados() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.agenda_sem_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_itens(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agenda_atrasados() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agenda_sem_data() TO authenticated, service_role;

-- ── 4. Marca do aviso diário das 8h ──────────────────────────────────────────────
-- O W6 (n8n) pede o texto do dia à Edge Function `avisos-agenda` e manda no grupo Equipe.
-- "Nunca envia duas vezes no mesmo dia": marcar_enviado grava com ON CONFLICT DO NOTHING
-- e do_dia não devolve texto para um dia que já tem marca.

CREATE TABLE public.agenda_avisos_enviados (
  -- Dia do aviso no calendário de Brasília.
  dia         date PRIMARY KEY,
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  -- key.id que a Evolution devolve no envio.
  message_id  text,
  -- JID do grupo para onde saiu (constante validada na Edge Function).
  destino     text NOT NULL,
  CONSTRAINT agenda_avisos_enviados_destino_preenchido CHECK (btrim(destino) <> '')
);

COMMENT ON TABLE public.agenda_avisos_enviados IS
  'Aviso diário da Agenda (W6, 8h, grupo Equipe): uma linha por dia já enviado. Só service_role.';

-- RLS ligada e SEM policy: só a service_role (que bypassa RLS) lê e grava.
ALTER TABLE public.agenda_avisos_enviados ENABLE ROW LEVEL SECURITY;

-- Default privilege do Supabase dá tudo a anon e authenticated na criação; aqui ninguém do
-- app toca. service_role mantém o privilégio padrão.
REVOKE ALL ON public.agenda_avisos_enviados FROM anon, authenticated;
