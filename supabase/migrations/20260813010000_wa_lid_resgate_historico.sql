-- Resgate do histórico: ponte LID → telefone.
--
-- PROBLEMA: o WhatsApp migrou para LID (Linked Identifier). Na carga de histórico do
-- pareamento, `remoteJid` vem como `269466768244766@lid` — um id opaco, sem telefone.
-- Das 6.352 mensagens sincronizadas em 10/08/2026: 6.098 em `@lid`, 254 em grupos,
-- ZERO com telefone. O ingestor descartou todas (corretamente — não dava pra saber de
-- quem eram), e 408 conversas desde 19/12/2025 ficaram órfãs.
--
-- Na mensagem AO VIVO o telefone vem normal. O problema é só do histórico.
--
-- POR QUE NÃO DÁ PRA RESOLVER NA EVOLUTION v2.3.7:
--   • o `lidMapping` do Baileys não é persistido (o `creds` tem 3 KB, sem rastro);
--   • o Redis está vazio (CACHE_REDIS_SAVE_INSTANCES=false);
--   • `/chat/whatsappNumbers` tem BUG: devolve `"lid":"lid"`, o nome do campo em vez
--     do valor. Subir de versão resolveria, mas o pin protege a captura do referral.
--
-- A PONTE: quando chega mensagem ao vivo (com telefone), o chat correspondente na
-- Evolution fica com `updatedAt` no mesmo segundo. Correlacionando os dois, o LID sai.
-- Validado contra as 3 conversas reais existentes: 3/3, cada uma com candidato ÚNICO.
--
-- A propriedade boa é que isso se auto-cura: cada cliente que volta a escrever
-- desbloqueia o próprio histórico. Não precisa de operação em massa nem de upgrade.

CREATE TABLE IF NOT EXISTS public.wa_lid_map (
  lid          text PRIMARY KEY,
  telefone_wa  text NOT NULL,
  -- Como o par foi descoberto. Hoje só 'correlacao_temporal'; se a Evolution um dia
  -- consertar o endpoint, entra 'evolution_api' e dá pra comparar a confiabilidade.
  metodo       text NOT NULL DEFAULT 'correlacao_temporal',
  resolvido_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wa_lid_map IS
  'Ponte LID -> telefone canonico, descoberta por correlacao temporal entre a mensagem ao vivo e o updatedAt do chat na Evolution.';

CREATE INDEX IF NOT EXISTS idx_wa_lid_map_telefone ON public.wa_lid_map (telefone_wa);

ALTER TABLE public.wa_lid_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler wa_lid_map"
  ON public.wa_lid_map FOR SELECT TO authenticated USING (public.is_admin());

-- ── mensagens_whatsapp: marca de origem ───────────────────────────────────────

ALTER TABLE public.mensagens_whatsapp
  ADD COLUMN IF NOT EXISTS lid       text,
  ADD COLUMN IF NOT EXISTS historico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mensagens_whatsapp.lid IS
  'LID de origem, quando a mensagem veio do resgate de historico.';
COMMENT ON COLUMN public.mensagens_whatsapp.historico IS
  'true = resgatada do passado, ANTES do pareamento. NUNCA vira interacao.';

CREATE INDEX IF NOT EXISTS idx_msg_wa_lid ON public.mensagens_whatsapp (lid) WHERE lid IS NOT NULL;

-- ⚠️ A REGRA MAIS IMPORTANTE DESTA MIGRATION.
--
-- Mensagem histórica alimenta perfil e contexto, mas NUNCA vira `interacao`. O motivo
-- é o trigger `fn_contato_assistido_status`: todo INSERT de `ponto_contato` reescreve
-- `contatos.status_relacionamento`, e a `view_relacionamento_kanban` deriva cadência
-- de follow-up dessas linhas. Deixar o W2 analisar 6 mil conversas de dezembro jogaria
-- uma avalanche no Kanban do Gilmar — clientes "em conversa" por papo de 8 meses atrás.
--
-- Em vez de confiar que o W2 lembre de filtrar, o índice que ele varre passa a EXCLUIR
-- histórico. A regra vira estrutural: o que não está no índice não é achado.
DROP INDEX IF EXISTS public.idx_msg_wa_pendentes;
CREATE INDEX idx_msg_wa_pendentes
  ON public.mensagens_whatsapp (enviada_em)
  WHERE processado_em IS NULL AND NOT historico;

COMMENT ON INDEX public.idx_msg_wa_pendentes IS
  'Fila do analista W2. Exclui historico DE PROPOSITO: passado nao move Kanban.';

NOTIFY pgrst, 'reload schema';
