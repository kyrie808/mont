-- Telefone canônico de WhatsApp — a chave que casa a mensagem com o contato.
--
-- PROBLEMA: o JID que a Evolution entrega vem em E.164 sem o `+` (13 dígitos:
-- `5511910049290`), mas 783 dos 810 contatos estão gravados com 11 dígitos
-- (`11910049290`). `telefone_norm` é coluna gerada que só remove não-dígitos, então
-- casar a mensagem por ela falharia em 100% dos contatos existentes — e o ingestor
-- criaria uma duplicata pra cada cliente da base, logo depois da deduplicação que
-- fundiu 7 pares (813→806) em 02/08.
--
-- SOLUÇÃO: uma forma canônica única (`55` + DDD + 9 dígitos), derivada por função
-- IMMUTABLE e materializada em coluna gerada — mesmo padrão de `telefone_norm`.
--
-- Validado contra os 810 contatos ANTES de aplicar: 799 canonizam, 799 distintos
-- (zero colisão), todos com 13 dígitos. Os 11 que viram NULL são 9 placeholders
-- (`999999924`, `0000000000` = a própria Mont, `1122334455`…) e 2 telefones FIXOS
-- reais (DDD 11 + assinante começando em `4`). Fixo não existe no WhatsApp: NULL
-- está correto — esses contatos simplesmente nunca casam por essa chave.

CREATE OR REPLACE FUNCTION public.fn_telefone_wa(p_telefone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO ''
AS $$
  WITH d AS (
    SELECT regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') AS dig
  ), n AS (
    SELECT CASE
             WHEN length(dig) IN (12, 13) AND left(dig, 2) = '55' THEN substr(dig, 3)
             ELSE dig
           END AS nac
    FROM d
  )
  SELECT CASE
    WHEN length(nac) = 11
     AND left(nac, 2) ~ '^(1[1-9]|[2-9][0-9])$'
     AND substr(nac, 3, 1) = '9'
      THEN '55' || nac
    WHEN length(nac) = 10
     AND left(nac, 2) ~ '^(1[1-9]|[2-9][0-9])$'
     AND substr(nac, 3, 1) IN ('6', '7', '8', '9')
      THEN '55' || left(nac, 2) || '9' || substr(nac, 3)
    ELSE NULL
  END
  FROM n;
$$;

COMMENT ON FUNCTION public.fn_telefone_wa(text) IS
  'Telefone BR -> forma canonica de WhatsApp (55 + DDD + 9 digitos), ou NULL se nao for celular valido. Usada na coluna gerada contatos.telefone_wa.';

ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS telefone_wa text
  GENERATED ALWAYS AS (public.fn_telefone_wa(telefone)) STORED;

COMMENT ON COLUMN public.contatos.telefone_wa IS
  'Chave de casamento com o WhatsApp (JID sem @s.whatsapp.net). Derivada de telefone - nunca escrever direto.';

CREATE UNIQUE INDEX IF NOT EXISTS contatos_telefone_wa_key
  ON public.contatos (telefone_wa) WHERE telefone_wa IS NOT NULL;

NOTIFY pgrst, 'reload schema';
