import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavigationDrawer } from './NavigationDrawer'
import { PwaUpdateToast } from '../ui/PwaUpdateToast'
import { ToastContainer } from '../ui/Toast'
import { useNavigationStore } from '@/stores/useNavigationStore'

export function AppLayout() {
  const { isDrawerOpen, closeDrawer } = useNavigationStore()

  return (
    <div className="min-h-dvh bg-background text-foreground font-display antialiased transition-colors">
      <PwaUpdateToast />
      <ToastContainer />
      {/* NavigationDrawer renderizado aqui — fora do max-w-7xl, sem stacking context intermediário */}
      <NavigationDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
      <div className="flex justify-center">
        <div className="relative flex min-h-dvh w-full max-w-7xl flex-col overflow-x-hidden shadow-modal pb-20">
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
