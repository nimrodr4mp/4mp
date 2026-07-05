import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
type ButtonVariant = 'default' | 'outline' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize
  variant?: ButtonVariant
  loading?: boolean
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'text-xs px-2 py-1 gap-1',
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-600',
  outline:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-primary-600',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-primary-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = 'md', variant = 'default', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
