import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@mont/shared'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center font-body font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mont-gold focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

        const variants = {
            primary: 'bg-mont-gold text-mont-espresso hover:bg-mont-gold-light active:scale-[0.98] shadow-sm hover:shadow-md',
            secondary: 'border-2 border-mont-espresso text-mont-espresso hover:bg-mont-espresso hover:text-mont-cream active:scale-[0.98]',
            ghost: 'text-mont-espresso hover:bg-mont-surface active:scale-[0.98]'
        }

        const sizes = {
            sm: 'px-4 py-2 text-sm rounded-md',
            md: 'px-6 py-3 text-base rounded-lg',
            lg: 'px-8 py-4 text-lg rounded-lg'
        }

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span>{children}</span>
                    </div>
                ) : (
                    children
                )}
            </button>
        )
    }
)

Button.displayName = 'Button'

export { Button }
