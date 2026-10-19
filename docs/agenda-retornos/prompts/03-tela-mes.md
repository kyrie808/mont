# Prompt 3 — Tela do Mês

```text
Crie a tela Agenda no sistema interno, visão do Mês, desktop primeiro. Referência visual: Google Agenda (prints em docs/agenda-retornos/img/gcal-mes.png, gcal-detalhe.png e gcal-criar.png), adaptado ao nosso design system e tema escuro. Planejamento completo em docs/agenda-retornos/README.md, seção Telas.

O QUÊ
1. Rota nova /agenda e item no menu lateral.
2. Cabeçalho: Hoje, anterior, próximo, nome do mês, seletor Mês/Semana/Dia (Semana e Dia podem ficar desabilitados nesta onda), busca por cliente ou título.
3. Lateral: botão Criar, mini-calendário, camadas com checkbox e cor (Lembretes, Vencimentos, Entregas, Contas a pagar), escolha salva no navegador com try/catch.
4. Grade de 7 colunas começando no domingo, hoje destacado, até 3 chips por dia e "+N mais". Vários vencimentos no mesmo dia viram um chip agregado "N vencimentos · R$ X".
5. Faixa de Atrasados acima da grade com contador e valor.
6. Popover de detalhe ao clicar num chip: dados, valor em aberto e ações Marcar como feito, Reagendar (+1 dia, +7 dias, escolher data; soma o contador de reagendamentos), Abrir venda, Abrir cliente, Abrir conversa no WhatsApp, Excluir. Itens de camada só têm Abrir registro e Criar retorno.
7. Criação rápida ao clicar num dia vazio ou em Criar: título, data pré-preenchida, hora opcional, abas de tipo, busca de cliente que lista as vendas em aberto dele para ligar, Salvar e Mais opções.
8. Os dados vêm SOMENTE da função de leitura da onda 1, uma chamada por mês visível.

RESTRIÇÕES
- Reaproveite componentes do design system. Se propuser biblioteca de calendário, justifique contra fazer a grade na mão.
- Nenhum valor calculado na tela que contradiga o banco: o valor em aberto vem da função.
- Ao criar retorno_comercial para cliente com fiado em aberto, mostrar aviso e sugerir tipo cobranca.

CRITÉRIOS DE ACEITE
- Novembro/2026 mostra o chip agregado em 13/11 com o mesmo total do banco.
- Criar, reagendar, marcar feito e excluir refletem na grade sem recarregar a página.
- Marcar a venda como paga em outra aba faz o lembrete ligado sair dos pendentes ao voltar.
- Desligar uma camada esconde os itens dela e a escolha persiste após recarregar.
- Sem erros no console e build passando.
```
