import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs'
import type { StoryFilterItem } from '../ui'

interface ContatosFilterTabsProps {
    items: StoryFilterItem[]
    activeId: string
    onSelect: (id: string) => void
}

/**
 * Versão desktop dos filtros de contato: segmented control (primitivo Tabs, tokenizado),
 * substituindo o carrossel de stories no `≥lg`. Mobile mantém o `ContactStoryFilter`.
 */
export function ContatosFilterTabs({ items, activeId, onSelect }: ContatosFilterTabsProps) {
    return (
        <Tabs value={activeId} onValueChange={onSelect}>
            <TabsList>
                {items.map((item) => {
                    const Icon = item.icon
                    return (
                        <TabsTrigger key={item.id} value={item.id}>
                            <Icon className="size-4" />
                            <span>{item.label}</span>
                            {item.count !== undefined && (
                                <span className="ml-1 rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                                    {item.count}
                                </span>
                            )}
                        </TabsTrigger>
                    )
                })}
            </TabsList>
        </Tabs>
    )
}
