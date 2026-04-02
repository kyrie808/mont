import * as React from "react"
import { cn } from '@mont/shared'

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, helperText, id, required, ...props }, ref) => {
        const generatedId = React.useId()
        const inputId = id || generatedId
        const errorId = `${inputId}-error`

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        {label}
                        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                    </label>
                )}
                <input
                    type={type}
                    className={cn(
                        "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-destructive focus-visible:ring-destructive",
                        className
                    )}
                    ref={ref}
                    id={inputId}
                    required={required}
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={error ? true : undefined}
                    {...props}
                />
                {error && (
                    <p id={errorId} className="mt-1 text-sm text-destructive" role="alert">{error}</p>
                )}
                {helperText && !error && (
                    <p className="mt-1 text-sm text-muted-foreground">{helperText}</p>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
