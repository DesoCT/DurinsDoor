import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        className={cn('form-label', className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Label.displayName = 'Label'

export { Label }
