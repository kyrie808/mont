import * as React from 'react'
import { cn } from '@mont/shared'

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex w-full rounded-2xl bg-muted p-1 gap-1',
        className
      )}
    >
      {children}
    </div>
  )
}

function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs')

  const isActive = ctx.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3',
        'text-xs font-black uppercase tracking-wider transition-all',
        isActive
          ? 'bg-card text-foreground shadow-card'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export { Tabs, TabsList, TabsTrigger }
