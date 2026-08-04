import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavigationDrawer } from './NavigationDrawer'
import { SidebarNav } from './SidebarNav'
import { ToastContainer } from '../ui/Toast'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useVersionGuard } from '@/hooks/useVersionGuard'

export function AppLayout() {
  const { isDrawerOpen, closeDrawer } = useNavigationStore()
  // Puxa build novo quando houver, em momento seguro (nunca no meio de uma venda).
  useVersionGuard()

  return (
    <div className="min-h-dvh bg-background text-foreground font-display antialiased transition-colors">
      <ToastContainer />
      {/* Drawer hambúrguer — usado no mobile (fora do container, sem stacking context intermediário) */}
      <NavigationDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />

      <div className="lg:flex">
        {/* Sidebar persistente — só desktop (≥lg) */}
        <SidebarNav />

        {/* Área de conteúdo: centralizada/estreita no mobile, larga ao lado da sidebar no desktop */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="relative flex min-h-dvh w-full max-w-7xl flex-col overflow-x-hidden shadow-modal pb-20 lg:max-w-none lg:pb-0 lg:shadow-none">
            <Outlet />
          </div>
        </div>
      </div>

      {/* Bottom nav — só mobile */}
      <BottomNav />
    </div>
  )
}
