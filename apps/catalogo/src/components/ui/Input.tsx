import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@mont/shared'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, helperText, id, ...props }, ref) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-mont-espresso mb-2 font-body"
                    >
                        {label}
                    </label>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    className={cn(
                        'w-full px-4 py-3 rounded-lg border-2 font-body text-mont-espresso bg-mont-white',
                        'transition-all duration-200',
                        'placeholder:text-mont-warm-gray',
                        'focus:outline-none focus:ring-2 focus:ring-mont-gold focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-mont-surface',
                        error
                            ? 'border-mont-danger focus:ring-mont-danger'
                            : 'border-mont-line hover:border-mont-warm-gray',
                        className
                    )}
                    {...props}
                />

                {error && (
                    <p className="mt-2 text-sm text-mont-danger font-body">
                        {error}
                    </p>
                )}

                {helperText && !error && (
                    <p className="mt-2 text-sm text-mont-warm-gray font-body">
                        {helperText}
                    </p>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

export { Input }
