-- Recorrência VARIÁVEL: marca um template de despesa fixa cujo valor muda mês a mês
-- (ex: luz R$300/R$210). O `valor` do template passa a ser tratado como ESTIMATIVA;
-- a ocorrência gerada carrega essa estimativa e o usuário ajusta o valor real quando a
-- conta chega (via EditDespesaModal — o valor da ocorrência é gravado uma vez pelo
-- gerador e nunca sobrescrito, pois gerar_despesas_recorrentes só faz INSERT ... ON
-- CONFLICT DO NOTHING).
--
-- Aditiva e reversível (DROP COLUMN). A RPC gerar_despesas_recorrentes NÃO muda:
-- segue inserindo `valor` como valor_total da ocorrência. `variavel` é metadado de UX.

ALTER TABLE public.despesas_recorrentes
    ADD COLUMN IF NOT EXISTS variavel boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.despesas_recorrentes.variavel IS
    'Se true, o `valor` é apenas estimativa: a ocorrência mensal é gerada com esse valor e o usuário ajusta o valor real na conta a pagar quando a fatura chega.';
