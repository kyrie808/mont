# meta-capi-worker — envio de eventos offline (Purchase) para a Meta CAPI

Flush diário da outbox `meta_eventos` → Meta Conversions API. Escopo v1: **Purchase por
match de telefone/hash**. Blueprint: `blueprint-eventos-offline-capi-mont.md` §4–§7.

## Ordem de rollout (não pular)

### 1. Backup + aplicar migrations (schema/dados = Regra de Ouro #3)
```powershell
.\supabase\scripts\dump-prod.ps1          # backup ANTES
npx supabase db push                       # aplica 20260702120000 + 20260702120500
```
Migrations:
- `20260702120000_meta_capi_schema.sql` — colunas CTWA em `contatos` + tabela `meta_eventos` (outbox, `event_id` UNIQUE) + índices + RLS.
- `20260702120500_meta_capi_enfileira_purchase.sql` — trigger de enfileiramento em `vendas`.

### 2. Regenerar tipos
```bash
npx supabase gen types typescript --project-id herlvujykltxnwqmwmyx > packages/shared/src/database.ts
pnpm --filter interno exec tsc --noEmit    # deve ficar verde
```

### 3. Rodar o TDD do trigger (contra produção, conta-teste — janela livre do Gilmar)
```bash
pnpm --filter interno exec vitest run metaEventos.integration
```
Cobre: entregue→enfileira, brinde/catalogo/pendente→não, fiado→sim, idempotência.

### 4. Secrets da função (server-side, NUNCA no banco/cliente)
```bash
npx supabase secrets set META_CAPI_ACCESS_TOKEN="<token do Events Manager>"
npx supabase secrets set META_DATASET_ID="1689731802148035"
npx supabase secrets set CRON_SECRET="<gerar aleatório forte>"
# Modo teste (etapa 5): setar; depois REMOVER para produção.
npx supabase secrets set META_TEST_EVENT_CODE="TEST12345"
```

### 5. Deploy + validação em Test Events (painel > build verde)
```bash
npx supabase functions deploy meta-capi-worker
# Dispara manualmente:
curl -X POST "https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/meta-capi-worker" \
  -H "x-cron-secret: <CRON_SECRET>"
```
Conferir em **Events Manager → Test Events** que os Purchase chegam com match quality e
valor certos. Só então:
```bash
npx supabase secrets unset META_TEST_EVENT_CODE
```

### 6. Ligar o cron diário (só depois da validação)
`pg_cron` + `pg_net` estão disponíveis no projeto (não instalados ainda) e o `supabase_vault`
já está ativo. Rodar UMA vez no SQL editor (embute URL + lê o segredo do Vault — por isso
não é migration versionada, pra não vazar segredo no git):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda o CRON_SECRET no Vault (mesmo valor setado no secret da função).
select vault.create_secret('<CRON_SECRET>', 'meta_capi_cron_secret');

-- Agenda 1x/dia às 06:00 UTC (03:00 BRT).
select cron.schedule(
  'meta-capi-flush-diario',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/meta-capi-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'meta_capi_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

## Notas de arquitetura
- **Trigger é o único choke point:** interno é SPA client-only; há vários caminhos de escrita
  em `vendas`. Só no banco capturamos todos (inclusive RPC `criar_pedido` e sync cat_pedido↔venda).
- **Dedup catálogo:** vendas `origem='catalogo'` são EXCLUÍDas — o Pixel do navegador do
  catálogo já dispara Purchase. Enfileirar aqui contaria em dobro.
- **Retry:** erro → `status='erro'`, `tentativas++`; o worker reprocessa enquanto `tentativas < 5`.
- **Normalização/hash:** fonte única em `packages/shared/src/metaNormalize.ts` (testada por unit).
- **CTWA:** colunas `ctwa_clid`/`ad_referral` criadas mas sem uso (não há gateway neste monorepo).
  Trilho de coexistence/Cloud API é fora de escopo v1.
