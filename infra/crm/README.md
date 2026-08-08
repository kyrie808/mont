# Infra local — CRM Inteligente (Fase 1)

Sobe **n8n + Evolution API (Baileys) + Postgres + Redis** em Docker, na máquina do dev.
É o encanamento que lê o WhatsApp e alimenta o Supabase de produção.

O **Mont Interno continua sendo a fonte da verdade** — nada aqui vira um segundo CRM.
O n8n é sistema nervoso, o Supabase é a memória.

## Subir

```bash
cp infra/crm/.env.example infra/crm/.env    # e preencher os segredos
docker compose -f infra/crm/docker-compose.yml up -d
```

| Serviço | Endereço | Observação |
|---|---|---|
| Evolution API | http://localhost:8080 | manager em `/manager`; header `apikey: $EVOLUTION_API_KEY` |
| n8n | http://localhost:5678 | |
| Postgres | `127.0.0.1:5433` | porta 5433 pra não colidir com o Supabase CLI |

Tudo escuta só em `127.0.0.1` — nada exposto na rede.

## Por que não tem túnel público

O PRD previa ngrok/cloudflared, herdado do desenho de VPS. **Não é preciso**:

- WhatsApp → Evolution é conexão **de saída** (Baileys é websocket cliente).
- Evolution → n8n trafega **dentro da rede do Docker** (`http://n8n:5678`).
- n8n → Supabase é HTTPS **de saída**.

Nada precisa entrar. Um túnel só adicionaria superfície de ataque.

## ⚠️ Versões fixas — não subir sem reteste

`evoapicloud/evolution-api:v2.3.7` e `n8nio/n8n:2.33.7` estão **pinadas de propósito**.
Há histórico documentado de o objeto `referral` (que carrega o `ctwa_clid` dos anúncios)
sumir do webhook entre versões da Evolution. Trocar a tag exige repetir o portão 1A.

Escolhas verificadas nesta versão:

- **`evoapicloud`, não `atendai`** — o `atendai` parou na v2.2.3 (fev/2025); o mantido é o
  `evoapicloud` (evolution-foundation), v2.3.7 é a última estável numerada.
- **Modo Baileys, nunca Cloud API** — em modo Cloud API a Evolution **descarta o `referral`**
  ([issue #2645](https://github.com/evolution-foundation/evolution-api/issues/2645), aberta).
- **Env externo vence o `.env` embutido** — a imagem traz um `/evolution/.env` de 13KB, e a
  [issue #1474](https://github.com/EvolutionAPI/evolution-api/issues/1474) relata que ele
  sobrepõe as variáveis do compose. **Testado nesta versão: não sobrepõe** (o `dotenv.config()`
  não sobrescreve `process.env` já definido). Confirmação rápida: o `clientName` em `GET /`
  responde `mont_crm`, que só existe no nosso compose.
- **`DATABASE_URL` *e* `DATABASE_CONNECTION_URI`** — o `deploy_database.sh` usa a primeira
  (Prisma), a aplicação usa a segunda. Faltando uma, ou a migration ou o app quebra.
- **`DATABASE_SAVE_DATA_HISTORIC=true` + `WEBHOOK_EVENTS_MESSAGES_SET=true`** — queremos o
  histórico. Dois motivos: (a) o CRM precisa de conversa passada pra ter o que perfilar;
  (b) é a única chance de **atribuição retroativa** — o history sync entrega o proto da
  mensagem com `contextInfo`, então uma conversa antiga vinda de anúncio pode carregar o
  `externalAdReply`. É diferente do `/chat/findMessages`, que não devolve esses campos
  ([issue #975](https://github.com/EvolutionAPI/evolution-api/issues/975)).
  ⚠️ `MESSAGES_SET` chega em **lote** — o ingestor trata N mensagens por request.
  Ao criar a instância, passar `syncFullHistory: true` pra puxar a janela cheia.
- **`TELEMETRY_ENABLED=false`** — conversa de cliente não vai pra telemetria de terceiro.

## Evolution API (Node) ou Evolution Go?

Os dois são da **Evolution Foundation** e os dois estão vivos. Não é um substituindo o outro —
são dois motores irmãos. Estado em 07/08/2026:

| | evolution-api (Node/**Baileys**) | evolution-go (Go/**whatsmeow**) |
|---|---|---|
| Criado | jun/2023 | **mar/2026** |
| Último push | 14/07/2026 | 03/07/2026 |
| Stars | 9.235 | 602 |
| Issues abertas | 177 | 93 |
| Commits no `main` | anos de história | **19** |

O Go é mais novo, mais leve e mais rápido — e o `whatsmeow` é uma base melhor que o Baileys.
Para esta fase, mesmo assim, **ficamos no Node**:

1. **A atribuição é o projeto inteiro.** O `whatsmeow` tem `ContextInfo_ExternalAdReplyInfo`
   no protobuf, mas não há evidência de que o evolution-go **exponha** isso no webhook — e
   esse é exatamente o tipo de bug que o Node tem documentado (#2645, #975). Trocar um risco
   conhecido por um risco não medido, na única coisa que não pode falhar, é mau negócio.
2. **93 issues abertas em 4 meses de vida** com 19 commits no main: ainda está assentando.
3. **Performance não é o nosso gargalo.** São dezenas de mensagens por dia, não milhares.

Reavaliar depois que o portão 1A passar. Se o referral do Node se provar quebrado, o Go entra
como plano C — ao lado do patch no `dist/main.js` da #2645.

## Passos manuais (uma vez)

1. ~~**n8n**: criar a conta de dono~~ — feito.
2. ~~**Chave de API do n8n**~~ — feito; está em `infra/crm/.env` e registrada no MCP `n8n-mcp`.
3. **Parear o WhatsApp**: só na Etapa 3, combinando janela com o Gilmar. Número **principal**,
   como dispositivo vinculado, com `syncFullHistory: true` na criação da instância. Aparece
   no celular dele como **"Mont CRM"** em *Aparelhos conectados*.
   Fase 1 **não envia mensagem nenhuma** — só lê.

## O ingestor (W1)

Edge Function `whatsapp-ingestor` (código em `supabase/functions/whatsapp-ingestor/`).
O n8n recebe o webhook da Evolution e repassa o corpo cru para:

```
POST https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-ingestor
     x-ingestor-secret: <INGESTOR_SECRET de infra/crm/.env>
```

Autentica por segredo compartilhado, não por JWT (`--no-verify-jwt`): é o padrão de
receptor de webhook e evita distribuir a anon key pro n8n. O segredo tem 32 bytes.

### Modo sombra vs ativo

Controlado pelo secret `INGESTOR_MODO` (**default `sombra`**; qualquer valor diferente
de `ativo` é tratado como sombra):

| | `sombra` | `ativo` |
|---|---|---|
| grava `mensagens_whatsapp` | sim | sim |
| casa/cria `contatos` | **não** | sim |
| captura `ctwa_clid` no contato | **não** | sim |
| dispara CAPI / move Kanban | **não** | sim |

Trocar: `npx supabase secrets set INGESTOR_MODO=ativo` (leva ~10s pra valer).

**Rodar em sombra primeiro não é excesso de cuidado** — é o que resolve o portão 1A.
A função fica no número real capturando payload cru até cair um clique de anúncio de
verdade, e enquanto isso a base de 810 contatos não corre risco nenhum. Só depois de
olhar o que caiu em `mensagens_whatsapp` é que faz sentido virar `ativo`.

Consulta que decide o portão:

```sql
select message_id, telefone_wa, referral, enviada_em
from mensagens_whatsapp where referral is not null order by enviada_em desc;
```

### Verificação já feita (07/08, contra produção)

| Caso | Resultado |
|---|---|
| POST sem o segredo | HTTP 401 |
| Mensagem normal | `gravadas: 1` |
| Mesma mensagem de novo | `gravadas: 0` (idempotente por `message_id`) |
| Lote de histórico com 1 grupo | `recebidas: 3, gravadas: 2, ignoradas: 1` |
| Mensagem de anúncio | `com_referral: 1`, clid e `sourceId` no jsonb |
| Sombra não encosta em nada | contatos 810→810, eventos 250→250, interações 212→212 |
| **Modo ativo, lead de anúncio** | contato criado com `ctwa_clid`; `meta_eventos` com **`action_source='business_messaging'`** e clid preenchido — contra os 250 eventos antigos, todos `physical_store` com clid nulo |

Dados sintéticos do teste removidos; base restaurada ao baseline.

## Community nodes do n8n: não precisamos (ainda)

O `n8n-nodes-evolution-api` / `n8n-nodes-evolution-go` servem pra **enviar** mensagem e
gerenciar instância. Na Fase 1 o n8n só recebe webhook (nó nativo), chama a Edge Function
(HTTP Request) e conversa com Supabase/LLM — nada disso precisa de node de terceiro.
Gerenciamento de instância e QR sai por HTTP puro contra a Evolution.
Reavaliar na Fase 2, quando entrar envio.

## Comandos

```bash
docker compose -f infra/crm/docker-compose.yml ps        # estado
docker compose -f infra/crm/docker-compose.yml logs -f evolution
docker compose -f infra/crm/docker-compose.yml down      # para (dados persistem)
docker compose -f infra/crm/docker-compose.yml down -v   # ⚠️ APAGA a sessão do WhatsApp
```

`down -v` destrói o volume `evolution_instances` e obriga a parear o número de novo —
pedindo o celular do Gilmar outra vez. Pensar duas vezes.

## Segredos

`infra/crm/.env` é **gitignored** (Regra de Ouro #7). Nunca commitar valores reais.
O `N8N_ENCRYPTION_KEY` não pode mudar depois de criado: ele decifra as credenciais salvas
no n8n, e trocá-lo inutiliza todas de uma vez.
