import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva('', {
  variants: {
    variant: {
      default: 'download-card',
      auth: 'auth-card',
      handshake: 'handshake-card',
      scroll: 'scroll-card',
      options: 'options-panel',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        className={cn(cardVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Card.displayName = 'Card'

export { Card, cardVariants }
