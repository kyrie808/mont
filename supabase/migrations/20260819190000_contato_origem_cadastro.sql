-- Selo de origem do cadastro + a marca de "um humano já olhou isto".
--
-- PROBLEMA (19/08/2026): o Gilmar levou um 409 ao cadastrar a "Najla". O número já
-- era do contato "♡ Cadonhoto ♡", que a secretária de WhatsApp criou sozinha dois dias
-- antes com o push name do aparelho. Ele não tinha como saber: nada em `contatos`
-- distingue o que ele digitou do que a IA capturou.
--
-- Por que não dá pra usar o que já existe:
--   · `created_by IS NULL` pega 356 contatos — a base velha inteira desde dez/2025 —
--     dos quais só 7 vieram da secretária. Não é filtro, é ruído.
--   · `origem` responde outra pergunta ("como o cliente te achou": direto/indicação/
--     anúncio/catálogo). É ortogonal: a Najla é `origem='indicacao'` E entrou pela porta
--     do WhatsApp. Sobrecarregar essa coluna corromperia o ROAS, que lê ela.

-- ── 1. O selo ────────────────────────────────────────────────────────────────
--
-- DEFAULT 'manual' é escolha consciente: uma porta automática NOVA que esqueça de
-- declarar entra como "manual" caladinho. A alternativa (NOT NULL sem default) falharia
-- alto, mas um deploy fora de ordem da RPC `criar_pedido` quebraria o checkout do
-- catálogo — que é receita entrando. Preferido o lado que não derruba venda.

ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS origem_cadastro text NOT NULL DEFAULT 'manual';

ALTER TABLE public.contatos
  DROP CONSTRAINT IF EXISTS contatos_origem_cadastro_check;

ALTER TABLE public.contatos
  ADD CONSTRAINT contatos_origem_cadastro_check
  CHECK (origem_cadastro IN ('manual', 'whatsapp', 'catalogo'));

COMMENT ON COLUMN public.contatos.origem_cadastro IS
  'Por qual PORTA o cadastro entrou: manual (digitado no interno), whatsapp (secretária capturou), catalogo (site). Ortogonal a `origem`, que diz como o cliente chegou até a Mont.';

-- ── 2. Backfill ──────────────────────────────────────────────────────────────
--
-- Conferido na prod antes de aplicar: 815 manual + 17 catálogo + 7 whatsapp = 839.
-- Nenhum dos dois UPDATEs menciona a coluna `origem`, então os gatilhos
-- `trg_contato_entrada_anuncio` e `trg_enfileirar_lead_meta` (ambos `UPDATE OF origem`)
-- não disparam — nada é enfileirado pra CAPI da Meta por causa deste backfill.

UPDATE public.contatos
   SET origem_cadastro = 'catalogo'
 WHERE created_by IS NULL
   AND origem = 'catalogo';

-- A secretária entrou no ar em 12/08/2026. Antes disso, `created_by IS NULL` é a base
-- velha importada — que foi digitada por humano na migração, então 'manual' não mente.
UPDATE public.contatos
   SET origem_cadastro = 'whatsapp'
 WHERE created_by IS NULL
   AND origem <> 'catalogo'
   AND criado_em >= '2026-08-12';

-- ── 3. A marca de revisão, que faz a fila esvaziar ───────────────────────────
--
-- Carimbada no instante em que um humano salva o contato pela primeira vez.
--
-- Por que NÃO serve reusar `updated_by`, que já existe: o `whatsapp-ingestor` atualiza
-- `ultimo_contato` a cada mensagem nova rodando como service role, e o gatilho
-- `handle_audit_fields` regrava `updated_by = auth.uid()` — que ali é NULL. O Gilmar
-- arrumaria a Najla hoje e ela voltaria pra fila amanhã, na primeira mensagem dela.
--
-- `COALESCE(OLD.…)` primeiro torna a marca monotônica: uma vez carimbada, nem o cliente
-- mandando a coluna no payload consegue "des-revisar" o contato.

ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz;

COMMENT ON COLUMN public.contatos.revisado_em IS
  'Quando um humano salvou este contato pela primeira vez. NULL = ninguém conferiu ainda. Só anda pra frente — derivada por gatilho, nunca escrever direto.';

CREATE OR REPLACE FUNCTION public.fn_contato_revisado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  NEW.revisado_em := COALESCE(
    OLD.revisado_em,
    CASE WHEN auth.uid() IS NOT NULL THEN now() END
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_contato_revisado() IS
  'Carimba `revisado_em` na primeira vez que um humano autenticado atualiza o contato. Serviço/cron (auth.uid() nulo) não carimba.';

DROP TRIGGER IF EXISTS tr_contatos_revisado ON public.contatos;

CREATE TRIGGER tr_contatos_revisado
  BEFORE UPDATE ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_contato_revisado();

-- ── 4. Índice da fila ────────────────────────────────────────────────────────
-- Parcial: a fila é sempre um punhado de linhas dentro de 839. O índice acompanha
-- exatamente a pergunta que o chip "Novos da IA" faz.

CREATE INDEX IF NOT EXISTS contatos_fila_revisao_idx
  ON public.contatos (criado_em DESC)
  WHERE origem_cadastro <> 'manual' AND revisado_em IS NULL;

NOTIFY pgrst, 'reload schema';
