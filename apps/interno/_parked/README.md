# _parked — Features Parqueadas

Features movidas aqui em Maio/2026 como parte do projeto Brownfield Parking.

**Regras:**
- Código preservado intacto — schema DB, RPCs e views permanecem em produção
- Não editar sem decisão explícita de retomada
- Fase 4 adicionará cadeados UX (sidebar/menu) para ocultar as rotas

## Features parqueadas

| Feature | Pasta | Rota (ativa, sem UX) |
|---------|-------|----------------------|
| Entregas | `entregas/` | `/entregas` |
| Relacionamento | `relacionamento/` | `/relacionamento` |
| Fluxo de Caixa | `fluxo-caixa/` | `/fluxo-caixa` |
| Contas a Receber | `contas-receber/` | `/contas-a-receber` |
| Contas a Pagar | `contas-a-pagar/` | `/contas-a-pagar` |
| Relatório Fábrica | `relatorio-fabrica/` | `/relatorio-fabrica` |
| Plano de Contas | `plano-de-contas/` | (sem rota em App.tsx) |

## Dependências compartilhadas que FICARAM em src/

- `services/cashFlowService.ts` — usado por `PaymentSidebar`, `PurchaseOrderPaymentModal` e `AlertasFinanceiroWidget`
- `hooks/useIndicacoes.ts` — usado por `ContatoDetalhe` e `LoyaltyJourney`
- `hooks/useTopIndicadores.ts` — usado por `TopIndicadoresWidget`
- `hooks/useRecompra.ts` — usado por `AlertasRecompraWidget`
