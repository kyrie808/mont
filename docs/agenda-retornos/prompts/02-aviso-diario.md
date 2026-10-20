# Prompt 2 — Aviso diário das 8h

```text
Com a onda 1 aplicada em produção, crie o aviso diário interno da Agenda (planejamento em docs/agenda-retornos/README.md, seção Automações).

O QUÊ
1. Uma ação nova (na edge function existente ou numa nova, conforme o diagnóstico recomendou) que monta o texto do dia usando a função de leitura da onda 1: Atrasados (quantidade, nomes, valor somado), Hoje (lembretes e vencimentos com valor total), Amanhã (só o total de vencimentos).
2. A formatação do texto fica num helper em packages/shared, no mesmo padrão do avisoEntrega.ts, com teste unitário.
3. Um workflow novo no n8n (container mont-crm-n8n), de segunda a sábado às 8h America/Sao_Paulo, que chama essa ação e envia pela Evolution API (instância mont) para o destino configurável (meu número e/ou o grupo Equipe).
4. Se não houver nada no dia, não envia. Nunca envia duas vezes no mesmo dia.

RESTRIÇÕES
- Mensagem APENAS interna. Nenhum cliente recebe nada por essa automação.
- A chave da Evolution API é lida de variável de ambiente e nunca aparece em log ou código.
- Antes de ativar o cron, rode uma vez em modo simulação e me mostre o texto exato.

CRITÉRIOS DE ACEITE
- Simulação mostra os mesmos valores que a função de leitura retorna para hoje.
- Rodar duas vezes no mesmo dia envia uma vez só.
- Dia vazio não envia.
```
