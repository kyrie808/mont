import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
  layoutId: string
} | null>(null)

function Tabs({ value, onValueChange, children, className }: TabsProps) {
  // layoutId único por instância → o realce não "vaza" entre dois Tabs na mesma página
  const layoutId = React.useId()
  return (
    <TabsContext.Provider value={{ value, onValueChange, layoutId }}>
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
        'flex w-full items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground',
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
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2',
        'text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {isActive && (
        <motion.span
          aria-hidden="true"
          layoutId={ctx.layoutId}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute inset-0 z-0 rounded-md bg-background shadow-sm border border-transparent dark:border-input"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {children}
      </span>
    </button>
  )
}

export { Tabs, TabsList, TabsTrigger }
