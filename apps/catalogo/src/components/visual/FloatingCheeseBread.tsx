import React, { forwardRef } from 'react'
import { cn } from '@mont/shared'

interface FloatingCheeseBreadProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    className?: string
    style?: React.CSSProperties
}

export const FloatingCheeseBread = forwardRef<HTMLDivElement, FloatingCheeseBreadProps>(
    ({ size = 'md', className, style }, ref) => {
        const sizeClasses = {
            sm: 'w-10 h-10',    // 40px
            md: 'w-16 h-16',    // 64px
            lg: 'w-24 h-24',    // 96px
            xl: 'w-[140px] h-[140px]', // 140px
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'rounded-full relative shadow-lg isolate',
                    // Radial Gradient: #FACC42 → #F5B731 → #E8A020
                    'bg-[radial-gradient(circle_at_30%_30%,#FACC42,#F5B731,#E8A020)]',
                    // Shadow: 0 20px 60px rgba(61, 43, 34, 0.3)
                    'shadow-[0_20px_60px_rgba(61,43,34,0.3)]',
                    sizeClasses[size],
                    className
                )}
                style={{ ...style, willChange: 'transform' }}
                aria-hidden="true"
            >
                {/* Texture overlay (simple SVG pattern) */}
                <div
                    className="absolute inset-0 rounded-full opacity-30 select-none pointer-events-none mix-blend-multiply"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1h2v2H1V1z' fill='%23B45309' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                    }}
                ></div>

                {/* Highlight shine */}
                <div className="absolute top-[15%] left-[15%] w-[25%] h-[25%] rounded-full bg-white opacity-20 blur-sm pointer-events-none mix-blend-overlay"></div>
            </div>
        )
    })

FloatingCheeseBread.displayName = 'FloatingCheeseBread'
