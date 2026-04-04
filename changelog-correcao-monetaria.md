# Changelog: Correção Monetária (Centavos para Reais)

Este documento registra todas as alterações realizadas no monorepo para migrar o sistema legado de centavos (onde valores eram armazenados como inteiros multiplicados por 100) para o padrão numérico direto em reais (`numeric`).

## 1. Banco de Dados

### Tabelas Alteradas (Sufixos removidos e convertidas para numeric)
- `cat_pedidos` (colunas atualizadas: `subtotal`, `frete`, `total`)
- `cat_itens_pedido` (colunas atualizadas: `preco_unitario`, `total`)

### Views Recriadas
- `vw_admin_dashboard`
- `vw_catalogo_produtos`
- `view_fluxo_resumo`
*(As views agora tratam valores diretos sem multiplicar ou dividir por 100)*

### Funções / RPCs Alteradas
- `criar_pedido`: Assinatura substituída visando aceitar e persistir parâmetros numéricos em Reais, removendo a lógica `/100` e divisões obsoletas.

### Triggers Alterados
- `fn_sync_cat_pedido_to_venda`: Agora realiza cópia de 1 pra 1 entre o sistema do Catálogo (`cat_pedidos` / `cat_itens_pedido`) e Vendas Interno (`vendas` / `itens_venda`) diretamente em reais.

## 2. Código da Aplicação (Frontend/API)

### Lista de arquivos modificados na Sprint
- `apps/catalogo/src/app/(public)/carrinho/page.tsx`
- `apps/catalogo/src/app/admin/(protected)/pedidos/page.tsx`
- `apps/catalogo/src/app/api/admin/pedidos/route.ts`
- `apps/catalogo/src/lib/utils/format.ts`
- `apps/interno/src/components/features/contatos/detalhe/CatalogOrdersHistory.tsx`
- `apps/interno/src/hooks/useCatalogoPendentes.ts`
- `apps/interno/src/services/mappers.ts`
- `apps/interno/src/types/database.ts`
- `apps/interno/src/types/domain.ts`
- `packages/shared/src/formatters.ts`

## 3. Revisão Final e Limpeza de Código
- Foram removidos todos os usos de `fromCents` nos utilitários compartilhados de compatação de moeda.
- Todos os arquivos com referências ou strings mortas de `preco_unitario_centavos` ou `total_centavos` foram sanados.
- Build executado com sucesso e passando de forma "zerada" nos linters e compilação do TypeScript `tsc -b`.
