# PRD — CRM Inteligente Mont (Fase 1: Ingestão + Atribuição + Registro Automático)

**Projeto:** Mont Interno — camada de inteligência de relacionamento
**Autor:** Luccas Ferreira (Kyrie Agency)
**Data:** 07/08/2026
**Status:** MVP — desenvolvimento local
**Stack:** n8n + Evolution API + Supabase (Postgres) + LLM

---

## 1. Contexto

A Mont Distribuidora opera desde 11/12/2025 com vendas via WhatsApp. Três fatos motivam esta construção:

**1.1 — A atribuição de anúncios está cega.**
Rodamos campanhas Meta Ads de Click-to-WhatsApp desde junho/2026. A Meta registrou 66 conversas no período; a contagem manual no aparelho apontou 69. Hoje o Gilmar conta lead **na mão**, um por um, e não há como saber qual anúncio originou qual venda.

**1.2 — A CAPI já existe, mas está incompleta.**
A tabela `meta_eventos` já funciona como fila de Conversions API: 250 eventos enviados com sucesso entre 03/07 e 06/08. Porém **todos com `action_source = 'physical_store'` e `ctwa_clid` nulo**. O encanamento está pronto — falta a chave de atribuição chegar.

**1.3 — O CRM é 100% manual.**
A aba Relacionamento (Kanban) existe e funciona, mas cada ponto de contato precisa ser digitado. Resultado: 810 contatos cadastrados, apenas 140 com alguma interação registrada. A informação das conversas — preferências, objeções, feedbacks — se perde no WhatsApp.

### Fatos de negócio relevantes
- Receita acumulada: R$ 82.951 | Margem bruta média: 41,5% (estável)
- 168 vendas em aberto somando R$ 9.888, das quais R$ 4.868 vencidas há +30 dias
- Campanha ativa converte 11,5% dos leads em clientes (custo por cliente: R$ 34,85)

---

## 2. Objetivo

Construir uma camada automatizada que **lê as conversas do WhatsApp, registra cada ponto de contato na timeline do CRM e enriquece o perfil de cada cliente** — sem trabalho manual e sem trocar o sistema atual.

### Princípio norteador
O **Mont Interno permanece a única fonte da verdade**. O n8n é sistema nervoso (captura e processa); o Supabase é a memória; a IA é interpretação. Não se constrói um segundo CRM.

### Não-objetivos desta fase
- Não substituir o atendimento humano (o Gilmar continua respondendo)
- Não criar bot de resposta automática ao cliente
- Não migrar o Kanban nem alterar a UI existente
- Não adotar WhatsApp Cloud API oficial (avaliado, rejeitado nesta fase — ver §8)

---

## 3. Arquitetura

Três workflows independentes no n8n. A separação é deliberada: um agente único que faz tudo executa tudo mal.

```
WhatsApp (Evolution API)
        │  webhook MESSAGES_UPSERT
        ▼
[W1] Ingestor ─────────► mensagens_whatsapp (log cru)
     (determinístico,          + contatos.ctwa_clid / ad_referral
      SEM LLM)
        │  gatilho: 30min de silêncio na conversa
        ▼
[W2] Analista de Conversa (LLM) ──► interacoes (timeline do CRM)
        │  gatilho: agendado (diário)
        ▼
[W3] Perfilador (LLM) ────────────► contato_insights (perfil enriquecido)
```

### W1 — Ingestor (sem LLM)
Trabalho puramente determinístico. Não usa modelo de linguagem: é mais barato, mais rápido e não erra.

**Responsabilidades:**
1. Receber webhook `MESSAGES_UPSERT` da Evolution API
2. Normalizar telefone para E.164 sem `+` (ex: `5511987654321`)
3. Casar com `contatos.telefone_norm`; se não existir, criar contato novo com `origem` apropriada
4. Gravar a mensagem crua em `mensagens_whatsapp` (sempre — ver §5.3)
5. **Se houver objeto `referral` no payload:** extrair `ctwa_clid` e `source_id`, gravar em `contatos.ctwa_clid`, `contatos.ad_referral` (jsonb completo), `contatos.ctwa_clid_em`, e vincular `contatos.campanha_id`
6. Atualizar `contatos.ultimo_contato`
7. Idempotência: usar `message_id` da Evolution como chave única — webhook repetido não duplica linha

**Ponto crítico:** o `ctwa_clid` chega apenas na **primeira mensagem** de quem veio do anúncio. Se perder, não volta. Por isso o W1 grava tudo antes de qualquer processamento.

### W2 — Analista de Conversa (com LLM)
**Gatilho:** janela de inatividade de 30 minutos após a última mensagem de uma conversa.
**Motivo:** rodar LLM a cada mensagem ("oi", "bom dia") gera custo e ruído. Análise por conversa encerrada produz resultado útil, como um vendedor que anota o resumo depois de desligar.

**Entrada:** todas as mensagens não processadas daquele contato na janela.
**Saída:** um registro em `interacoes` + marcação `processado_em` nas mensagens.

### W3 — Perfilador (com LLM)
**Gatilho:** agendado (diário, fora do horário comercial) ou manual.
**Entrada:** histórico consolidado do contato (mensagens + interações + vendas).
**Saída:** upsert em `contato_insights`.

---

## 4. Contrato de dados — REGRA CRÍTICA

A timeline da aba Relacionamento renderiza a partir de `interacoes` usando um **vocabulário fechado já em produção**. A IA do W2 deve emitir exclusivamente estes valores. Qualquer valor inventado grava no banco mas desaparece dos filtros da tela.

| Campo | Valores permitidos | Observação |
|---|---|---|
| `canal` | `whatsapp` \| `sistema` | Sempre `whatsapp` no W2 |
| `tipo` | `ponto_contato` \| `feedback` \| `movimentacao_kanban` | W2 usa `ponto_contato` ou `feedback` |
| `sentido` | `entrada` \| `saida` | `entrada` = cliente iniciou; `saida` = nós iniciamos |
| `resultado` | `contatado` \| `resolvido` \| `a_contatar` \| `em_negociacao` \| `aceitou` \| `respondeu` \| `null` | Nulo é aceitável |

**Implementação obrigatória:** validar a saída do LLM contra estas listas **antes** do insert (Zod ou equivalente, alinhado ao padrão L-17 do projeto). Saída inválida → log de erro + fallback para `resultado: null`, nunca insert com valor livre.

### Prompt do W2 — formato de saída esperado
```json
{
  "tipo": "ponto_contato",
  "sentido": "entrada",
  "resultado": "em_negociacao",
  "observacao": "Resumo objetivo em até 2 frases, em português, do que foi tratado.",
  "produtos_mencionados": ["pão de queijo 1kg"],
  "houve_feedback": false
}
```

---

## 5. Alterações de schema

> Regra do projeto: diagnosticar antes de executar; **aprovação em checkpoint obrigatória antes de qualquer mudança no banco.** Esta seção é proposta, não migration aplicada.

### 5.1 Nova tabela: `mensagens_whatsapp`
Log cru, uma linha por mensagem.

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `contato_id` | uuid FK → contatos | nullable até casar |
| `telefone_norm` | text | índice |
| `message_id` | text UNIQUE | idempotência |
| `direcao` | text | `entrada` \| `saida` |
| `conteudo` | text | |
| `tipo_midia` | text | `texto`, `audio`, `imagem`, `documento` |
| `referral` | jsonb | payload bruto do anúncio |
| `timestamp` | timestamptz | do WhatsApp, não do insert |
| `processado_em` | timestamptz | null = pendente de análise |
| `criado_em` | timestamptz | default now() |

### 5.2 Nova tabela: `contato_insights`
Dado gerado por IA, **separado** do dado humano. Nunca sobrescreve `contatos.observacoes`.

| Coluna | Tipo |
|---|---|
| `contato_id` | uuid PK FK → contatos |
| `resumo` | text |
| `preferencias` | jsonb |
| `objecoes` | jsonb |
| `produtos_interesse` | jsonb |
| `sentimento` | text (`positivo` \| `neutro` \| `negativo`) |
| `temperatura` | text (`quente` \| `morno` \| `frio`) |
| `modelo` | text |
| `versao_prompt` | text |
| `gerado_em` | timestamptz |

### 5.3 Alteração: `interacoes`
```sql
ALTER TABLE interacoes ADD COLUMN gerado_por_ia boolean NOT NULL DEFAULT false;
```
A UI deve exibir um selo discreto ("registrado automaticamente") quando `true`, para o Gilmar distinguir o que veio da IA do que ele escreveu.

### 5.4 Por que guardar a mensagem crua
Reprocessar é grátis; recuperar o que não foi salvo é impossível. Se o prompt melhorar em 3 meses, dá para reanalisar todo o histórico apenas se ele existir.

### 5.5 RLS
Ambas as tabelas novas seguem o padrão do projeto: RLS habilitado, política de service_role para o n8n, leitura autenticada para a aplicação. O n8n usa **service_role key**, nunca anon key.

---

## 6. Ambiente de desenvolvimento local (custo zero)

Toda a Fase 1 é desenvolvida e validada localmente. VPS e tokens de API só após funcionar.

| Componente | Local (dev) | Produção (depois) |
|---|---|---|
| n8n | Docker, self-hosted | VPS |
| Evolution API | Docker, self-hosted | VPS |
| Banco | `supabase start` (CLI, Postgres local) | Supabase hosted |
| LLM | Ollama local (ex: `llama3.1`, `qwen2.5`) | API via env var |
| Webhook público | túnel local (ngrok/cloudflared) | domínio da VPS |

**Requisito de design:** o provedor de LLM deve ser trocável por variável de ambiente (`LLM_PROVIDER=ollama|anthropic`). O prompt e o parser de saída não mudam — só o endpoint. Isso permite desenvolver de graça e trocar em produção sem refatorar.

**Número de WhatsApp:** usar número secundário dedicado, nunca o número principal de atendimento do Gilmar. A Evolution é baseada em Baileys (não-oficial) e há risco real de bloqueio do número pelo WhatsApp.

**Versão da Evolution:** fixar uma versão testada e não atualizar automaticamente. Há histórico documentado de o objeto `referral` (com `ctwa_clid`) deixar de ser entregue no webhook entre versões — tanto no modo Baileys quanto no modo Cloud API.

---

## 7. Fases e critérios de aceite

### Fase 1A — Validação do referral (fazer PRIMEIRO, ~1h)
Antes de qualquer código: subir n8n + Evolution local, clicar no próprio anúncio ativo, enviar mensagem e inspecionar o payload cru do `MESSAGES_UPSERT` em um nó de debug.

**Aceite:** confirmar visualmente se `ctwa_clid` e/ou `source_id` chegam no payload.
**Se não chegarem:** a Fase 1B ainda vale (mata o registro manual), mas a atribuição precisa de plano B (ver §8).

### Fase 1B — Ingestor (W1)
**Aceite:**
- Mensagem recebida no WhatsApp aparece em `mensagens_whatsapp` em <10s
- Contato existente é casado corretamente por `telefone_norm`
- Contato novo é criado automaticamente
- Webhook duplicado não gera linha duplicada
- Lead vindo de anúncio grava `ctwa_clid`, `ad_referral` e `campanha_id`

### Fase 1C — Analista (W2)
**Aceite:**
- Conversa encerrada gera exatamente 1 registro em `interacoes`
- O registro aparece na timeline da aba Relacionamento sem alteração de UI
- 100% dos valores de `canal`/`tipo`/`sentido`/`resultado` pertencem ao vocabulário fechado
- `gerado_por_ia = true` e selo visível na tela

### Fase 1D — CAPI com atribuição
**Aceite:** novos eventos em `meta_eventos` saem com `ctwa_clid` preenchido e `action_source` adequado ao fluxo de mensagem. Verificar a Qualidade da Correspondência (Event Match Quality) no Gerenciador de Eventos da Meta, usando `test_event_code` antes de produção.

### Fases futuras (fora do MVP)
- W3 Perfilador
- Alertas proativos: lead morno parado, cliente sumido vs. padrão dele
- Régua de cobrança automática dos R$ 4.868 vencidos

---

## 8. Decisões e riscos

| Decisão | Motivo |
|---|---|
| Não clonar CRM pronto (ex: DeskcommCRM) | Criaria duas fontes de verdade sobre o mesmo cliente. Estudar o código como referência, sim; adotar, não. |
| Evolution API em vez de Cloud API oficial | A Cloud API assume o número e impede o atendimento manual no app — o Gilmar responde na mão. Trade-off aceito: menos garantia de referral, mais risco de ban. |
| Ingestor sem LLM | Determinismo, custo zero, sem alucinação em dado estrutural. |
| IA por conversa, não por mensagem | Custo e qualidade do resumo. |
| Insights em tabela separada | IA nunca sobrescreve o que o humano escreveu. |

### Riscos
| Risco | Mitigação |
|---|---|
| Ban do número pelo WhatsApp | Número secundário dedicado; volume de envio baixo |
| `referral` não vir no payload | Fase 1A valida antes de construir; plano B = Cloud API em número separado só para anúncios |
| Quebra entre versões da Evolution | Fixar versão; não atualizar sem reteste do referral |
| LLM emitir valor fora do vocabulário | Validação de schema antes do insert, com fallback |
| Dado de conversa de cliente armazenado | Definir política de retenção e aviso de privacidade (LGPD) antes de produção |

### Governança
A IA **sugere**, o humano **confirma**. Registro automático entra na timeline com selo de origem e pode ser editado ou removido pelo Gilmar. Automação que decide sozinha erra em silêncio.

---

## 9. Referência rápida — tabelas existentes relevantes

| Tabela | Uso nesta fase |
|---|---|
| `contatos` (810) | Já possui `ctwa_clid`, `ad_referral`, `ctwa_clid_em`, `telefone_norm`, `campanha_id`, `fonte` — **campos prontos, hoje vazios** |
| `interacoes` (212) | Timeline do CRM; destino do W2 |
| `meta_eventos` (250) | Fila CAPI já operante; passa a receber `ctwa_clid` |
| `campanhas` (5) | Vínculo do lead com a campanha de origem |
| `contato_campanhas` (121) | Relação N:N contato ↔ campanha |
| `vendas` (1558) | Fecha o ciclo: lead → cliente → valor para a CAPI |
