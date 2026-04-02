import { create } from 'zustand'

interface NavigationStore {
    isDrawerOpen: boolean
    openDrawer: () => void
    closeDrawer: () => void
}

export const useNavigationStore = create<NavigationStore>((set) => ({
    isDrawerOpen: false,
    openDrawer: () => set({ isDrawerOpen: true }),
    closeDrawer: () => set({ isDrawerOpen: false }),
}))
