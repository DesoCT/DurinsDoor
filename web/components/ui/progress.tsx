import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indeterminate?: boolean
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => {
    return (
      <div className={cn('progress-bar-track', className)} ref={ref} {...props}>
        <div
          className="progress-bar-fill"
          style={{
            width: indeterminate ? '100%' : `${Math.min(100, Math.max(0, value))}%`,
            animation: indeterminate ? 'progressGlow 1.5s ease-in-out infinite' : undefined,
          }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
