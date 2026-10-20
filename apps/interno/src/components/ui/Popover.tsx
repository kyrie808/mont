import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { cn } from '@mont/shared'

// Popover do design system (Radix): portal no body, foco e ESC do Radix, superfície
// `bg-popover` com borda tokenizada e camada nomeada `z-overlay` (abaixo de modal e toast).

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor
const PopoverClose = PopoverPrimitive.Close

const PopoverContent = React.forwardRef<
    React.ComponentRef<typeof PopoverPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 6, collisionPadding = 12, ...props }, ref) => (
    <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            collisionPadding={collisionPadding}
            className={cn(
                'z-overlay w-80 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-elevated outline-hidden',
                className,
            )}
            {...props}
        />
    </PopoverPrimitive.Portal>
))
PopoverContent.displayName = 'PopoverContent'

export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent }
