import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectOption {
    value: string
    label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
    error?: string
    options: SelectOption[]
    placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
        const selectId = id || label?.toLowerCase().replace(/\s/g, '-')

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    id={selectId}
                    className={`
            w-full border rounded-lg px-4 py-3
            focus:ring-2 focus:border-transparent
            transition-all duration-200 bg-white
            ${error
                            ? 'border-danger-500 focus:ring-danger-500'
                            : 'border-gray-300 focus:ring-primary-500'
                        }
            ${className}
          `}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p className="mt-1 text-sm text-danger-500">{error}</p>
                )}
            </div>
        )
    }
)

Select.displayName = 'Select'
