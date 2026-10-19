# Prompt 1 — Banco de dados

```text
Com base no diagnóstico aprovado (docs/agenda-retornos/diagnostico.md) e no planejamento (docs/agenda-retornos/README.md), crie a camada de banco da Agenda.

O QUÊ
1. Tabela nova de lembretes com: título, descrição, data, hora opcional (sem hora = dia inteiro), tipo (parcela, cobranca, pendencia_interna, retorno_comercial, outro), contato opcional, venda opcional, responsável opcional, situação (pendente, feito, cancelado), concluído em / por, motivo da conclusão (manual, venda_paga, venda_cancelada), contador de reagendamentos, origem (manual, automacao, claude) e as colunas de auditoria no padrão das outras tabelas.
2. Regra no banco: quando uma venda passa a paga, todos os lembretes PENDENTES de tipo parcela ou cobranca ligados a ela viram feito com motivo venda_paga. Quando a venda é cancelada, viram cancelado com motivo venda_cancelada.
3. Uma função de leitura que recebe data início e data fim e devolve UMA lista única com: lembretes do período; vencimentos (vendas não pagas e não canceladas com previsão de pagamento no período, com valor em aberto = total - valor pago); entregas previstas pendentes; vencimentos de contas a pagar em aberto. Cada item com: origem, id, data, hora, título, contato (id e nome), venda_id, valor, situação e tipo.
4. Uma segunda leitura para a faixa de atrasados: lembretes pendentes com data anterior a hoje (fuso America/Sao_Paulo).
5. RLS e permissões no mesmo padrão das demais tabelas do sistema interno. Índices para busca por data e situação.

POR QUÊ
Hoje retornos com clientes ficam em observações de texto e lembretes externos e se perdem. O banco precisa ser a fonte única, e lembrete de cobrança nunca pode continuar aberto depois que o cliente pagou.

RESTRIÇÕES
- Não existe staging: NÃO aplique a migração. Gere o SQL em arquivo de migração para eu revisar e testar no SQL Editor.
- Não altere nem quebre a trigger atual de pagamentos_venda; a regra nova reage à mudança de vendas.pago.
- Nada de UUID fixo no código.
- Inclua um bloco de teste dentro de BEGIN ... ROLLBACK que prove cada critério abaixo sem deixar resíduo.

CRITÉRIOS DE ACEITE
- Inserir um lembrete tipo parcela ligado a uma venda não paga e registrar pagamento que quite a venda: o lembrete fica feito, motivo venda_paga.
- Lembrete tipo pendencia_interna ligado à mesma venda NÃO é fechado.
- Pagamento parcial (venda continua não paga) NÃO fecha nada.
- A função de leitura para 2026-11-01 a 2026-11-30 devolve os vencimentos de 13/11 com o mesmo total que um SELECT direto em vendas.
- Venda cancelada não aparece como vencimento.
- SELECT após cada DDL confirmando o efeito.
```
