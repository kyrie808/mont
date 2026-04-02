import { StoryFilter, type StoryFilterItem } from '../ui'

interface ContactStoryFilterProps {
    items: StoryFilterItem[]
    activeId: string
    onSelect: (id: string) => void
}

export function ContactStoryFilter({ items, activeId, onSelect }: ContactStoryFilterProps) {
    return (
        <StoryFilter
            items={items}
            activeId={activeId}
            onSelect={onSelect}
            size="md"
        />
    )
}
