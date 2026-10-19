# Prompt 0 — Diagnóstico (não altera nada)

```text
Leia primeiro o planejamento completo em docs/agenda-retornos/README.md (e as imagens em docs/agenda-retornos/img/).

CONTEXTO
Vamos criar um módulo "Agenda" no sistema interno da Mont (Next.js + Supabase, projeto herlvujykltxnwqmwmyx). Será uma tela no estilo Google Agenda (visão Mês/Semana/Dia) que mostra, no dia certo: (a) lembretes novos criados à mão, ligados a cliente e/ou venda; (b) camadas somente-leitura com datas que já existem no sistema: vencimentos de fiado (previsão de pagamento das vendas não pagas), entregas previstas e vencimentos de contas a pagar. Haverá também um aviso diário interno no WhatsApp via n8n, no mesmo molde do workflow de avisos de entrega.

TAREFA: SOMENTE DIAGNÓSTICO. NÃO altere nenhum arquivo e NÃO execute SQL de escrita.

Levante e me devolva um relatório com caminhos de arquivo explícitos:
1. Estrutura do repositório (apps, packages) e onde ficam rotas/páginas do sistema interno e o menu lateral.
2. Design system: tokens, componentes base, padrão Portal, como popovers/modais são feitos, tema escuro (ver também docs/DESIGN_SYSTEM.md).
3. Como as telas buscam e gravam dados (cliente Supabase, hooks, cache) e como erros/toasts são tratados.
4. Biblioteca de datas em uso e se já existe algum componente de calendário ou date picker.
5. Padrão das tabelas: colunas de auditoria (criado_em, created_by, updated_by), políticas RLS, pasta e convenção de migrações (ver também docs/DATABASE_ARCHITECTURE.md).
6. Como vendas.pago e vendas.valor_pago são atualizados hoje (trigger em pagamentos_venda) e onde uma regra de "venda paga fecha lembretes" deve se encaixar sem conflitar.
7. Colunas reais usadas para: previsão de pagamento, entrega prevista, status da venda, cancelamento, e o vencimento das parcelas em Contas a Pagar.
8. A edge function avisos-entrega e o arquivo packages/shared/src/avisoEntrega.ts: como o texto é montado e como o n8n chama a função.
9. Riscos e conflitos que você enxergar.

ENTREGÁVEL: o relatório + uma proposta de plano para 4 ondas (1 banco, 2 aviso diário, 3 tela do mês, 4 acabamento), dizendo quais arquivos cada onda cria ou altera. Salve o relatório em docs/agenda-retornos/diagnostico.md. Aguarde minha aprovação.
```
