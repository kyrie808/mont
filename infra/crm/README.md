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
- **`DATABASE_SAVE_DATA_HISTORIC=false` + `WEBHOOK_EVENTS_MESSAGES_SET=false`** — no
  pareamento o Baileys faz history sync e despejaria anos de conversa no ingestor. Histórico
  antigo não traz atribuição de anúncio de qualquer forma
  ([issue #975](https://github.com/EvolutionAPI/evolution-api/issues/975)), então só atrapalha.
- **`TELEMETRY_ENABLED=false`** — conversa de cliente não vai pra telemetria de terceiro.

## Passos manuais (uma vez)

1. **n8n**: abrir http://localhost:5678 e criar a conta de dono.
2. **Chave de API do n8n**: Settings → n8n API → Create an API key. Guardar em `infra/crm/.env`
   como `N8N_API_KEY` e registrar no MCP (`n8n-mcp`), que é como o agente cria os workflows.
3. **Parear o WhatsApp**: só na Etapa 3, combinando janela com o Gilmar. Número **principal**,
   como dispositivo vinculado. Aparece no celular dele como **"Mont CRM"** em
   *Aparelhos conectados*. Fase 1 **não envia mensagem nenhuma** — só lê.

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
