import { DIFFICULTIES } from '../constants'
import { cn } from '@/lib/utils'

export default function DifficultyFilter({ value, onChange }) {
  const options = [{ key: 'all', label: 'All' }, ...DIFFICULTIES]

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(d => {
        const active = value === d.key
        return (
          <button
            key={d.key}
            onClick={() => onChange(d.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border',
              active
                ? d.key === 'all'
                  ? 'bg-foreground text-background border-foreground'
                  : cn(d.activeClass, 'border-current/20')
                : 'bg-card text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
            )}
          >
            {d.dotColor && <span className={cn('h-1.5 w-1.5 rounded-full', d.dotColor)} />}
            {d.label}
          </button>
        )
      })}
    </div>
  )
}
