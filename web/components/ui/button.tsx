import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-cinzel text-sm tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]',
  {
    variants: {
      variant: {
        portal: 'btn-portal',
        silver: 'btn-silver',
        elvish: 'btn-elvish',
        ghost: 'bg-transparent border-none text-dim hover:text-parchment',
      },
      size: {
        default: '',
        sm: 'text-xs py-1.5 px-3',
        lg: 'text-base py-3 px-6',
        full: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'portal',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  rune?: string
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, rune, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {rune && <span className="btn-rune">{rune}</span>}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
