-- O metodo que realmente resolve o LID e o `key.remoteJidAlt` da Evolution — que e
-- ela AFIRMANDO o vinculo, nao inferencia nossa por timestamp. O default anterior
-- ('correlacao_temporal') descrevia o plano, nao o que foi implementado, e essa coluna
-- existe justamente para dizer o quanto o par e confiavel.
ALTER TABLE public.wa_lid_map ALTER COLUMN metodo SET DEFAULT 'remote_jid_alt';

UPDATE public.wa_lid_map SET metodo = 'remote_jid_alt' WHERE metodo = 'correlacao_temporal';

COMMENT ON COLUMN public.wa_lid_map.metodo IS
  'Como o par foi descoberto. remote_jid_alt = a Evolution afirmou o vinculo (confiavel).';
