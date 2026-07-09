import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'sky' | 'outline'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-primary-100 text-primary-800',
  sky: 'bg-sky-100 text-sky-800',
  outline: 'bg-white text-gray-700 border border-gray-300',
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
