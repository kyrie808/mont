import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AuthGuard } from './components/auth/AuthGuard'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { Spinner } from './components/ui'

// Lazy-loaded pages (PERF-001)
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Contatos = lazy(() => import('./pages/Contatos').then(m => ({ default: m.Contatos })))
const ContatoDetalhe = lazy(() => import('./pages/ContatoDetalhe').then(m => ({ default: m.ContatoDetalhe })))
const NovaVenda = lazy(() => import('./pages/NovaVenda').then(m => ({ default: m.NovaVenda })))
const Vendas = lazy(() => import('./pages/Vendas').then(m => ({ default: m.Vendas })))
const VendaDetalhe = lazy(() => import('./pages/VendaDetalhe').then(m => ({ default: m.VendaDetalhe })))
const Ranking = lazy(() => import('./pages/Ranking').then(m => ({ default: m.Ranking })))
const Recompra = lazy(() => import('./pages/Recompra').then(m => ({ default: m.Recompra })))
const Configuracoes = lazy(() => import('./pages/Configuracoes').then(m => ({ default: m.Configuracoes })))
const Produtos = lazy(() => import('./pages/Produtos').then(m => ({ default: m.Produtos })))
const RelatorioFabrica = lazy(() => import('./pages/RelatorioFabrica').then(m => ({ default: m.RelatorioFabrica })))
const Estoque = lazy(() => import('./pages/Estoque').then(m => ({ default: m.Estoque })))
const Entregas = lazy(() => import('./pages/Entregas').then(m => ({ default: m.Entregas })))
const PedidosCompra = lazy(() => import('./pages/PedidosCompra').then(m => ({ default: m.PedidosCompra })))
const Menu = lazy(() => import('./pages/Menu').then(m => ({ default: m.Menu })))
const CatalogoPendentes = lazy(() => import('./pages/CatalogoPendentes').then(m => ({ default: m.CatalogoPendentes })))
const FluxoCaixa = lazy(() => import('./pages/FluxoCaixa').then(m => ({ default: m.FluxoCaixa })))
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const ContasReceber = lazy(() => import('./pages/ContasReceber').then(m => ({ default: m.ContasReceber })))
const ContasAPagar = lazy(() => import('./pages/ContasAPagar').then(m => ({ default: m.ContasAPagar })))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contatos" element={<Contatos />} />
              <Route path="/contatos/:id" element={<ContatoDetalhe />} />
              <Route path="/nova-venda" element={<NovaVenda />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/vendas/:id" element={<VendaDetalhe />} />
              <Route path="/vendas/:id/editar" element={<NovaVenda />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/pedidos-compra" element={<PedidosCompra />} />
              <Route path="/recompra" element={<Recompra />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/relatorio-fabrica" element={<RelatorioFabrica />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/entregas" element={<Entregas />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/catalogo-pendentes" element={<CatalogoPendentes />} />
              <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="/contas-a-receber" element={<ContasReceber />} />
              <Route path="/contas-a-pagar" element={<ContasAPagar />} />

              {/* Redirects */}
              <Route path="/clientes" element={<Navigate to="/contatos" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  )
}

export default App
