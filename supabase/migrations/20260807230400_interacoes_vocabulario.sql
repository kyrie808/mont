-- Vocabulário fechado de `interacoes` — enforced no banco, não só na aplicação.
--
-- O PRD assumia que este vocabulário já era fechado. Não era: `interacoes` só tinha
-- CHECK em `sentido`; `tipo`, `canal` e `resultado` eram texto livre. Valor inventado
-- gravava normal e depois sumia dos filtros da tela — erro silencioso.
--
-- Isso deixa de ser aceitável agora que uma IA escreve nesta tabela. Um LLM que
-- alucine um `resultado` não pode conseguir gravar.
--
-- ⚠️ `resultado` significa coisas DIFERENTES por `tipo` — é o erro que o §4 do PRD
-- comete ao listar tudo numa lista só:
--   • ponto_contato       → resposta do cliente (respondeu/aceitou/recusou)
--   • movimentacao_kanban → coluna de destino do card (a_contatar/contatado/…)
--   • feedback            → não tem resultado
-- Um `em_negociacao` num ponto_contato não é "quase certo": é categoria errada, e a
-- view_relacionamento_kanban lê essas linhas pra calcular cadência de follow-up.
--
-- Validado ANTES de aplicar: 0 dos 212 registros existentes violam.
-- `tipo IS NOT NULL` entra na própria constraint — CHECK com NULL passa por padrão,
-- e um tipo nulo furaria o vocabulário inteiro.

ALTER TABLE public.interacoes
  ADD CONSTRAINT interacoes_vocabulario_check CHECK (
    tipo IS NOT NULL
    AND tipo IN ('ponto_contato', 'feedback', 'movimentacao_kanban')
    AND (canal IS NULL OR canal IN ('whatsapp', 'sistema', 'instagram', 'google', 'outro'))
    AND (
      CASE tipo
        WHEN 'ponto_contato' THEN
          resultado IS NULL OR resultado IN ('respondeu', 'aceitou', 'recusou')
        WHEN 'feedback' THEN
          resultado IS NULL
        WHEN 'movimentacao_kanban' THEN
          resultado IS NULL OR resultado IN (
            'a_contatar', 'contatado', 'em_negociacao', 'resolvido',
            'follow_up', 'sem_retorno', 'recusou'
          )
      END
    )
  );

COMMENT ON CONSTRAINT interacoes_vocabulario_check ON public.interacoes IS
  'Vocabulário fechado da timeline. `resultado` é validado conforme o `tipo` — os conjuntos não se misturam.';

NOTIFY pgrst, 'reload schema';
