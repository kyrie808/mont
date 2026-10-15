-- Arquiva o contato "Luccas teste" (número do Luccas, usado para testar a secretária e o
-- CRM). Ele não é cliente: não pode aparecer no kanban de Relacionamento nem no funil.
--
-- Não existe campo "interno/teste" em contatos. `arquivado_em` é o que o kanban
-- (view_relacionamento_kanban) e o funil (rpt_relacionamento_funil) já usam para tirar
-- alguém da tela. Limite conhecido: arquivar NÃO tira o contato das contagens por origem.
--
-- Busca pelo telefone + nome (não pelo id gerado) e aborta se não achar exatamente um.

DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.contatos
     SET arquivado_em = now()
   WHERE telefone_wa = '5511934417085'
     AND nome = 'Luccas teste'
     AND arquivado_em IS NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'esperado 1 contato "Luccas teste" para arquivar, achei %', n;
  END IF;
END
$$;
