import { cn } from '@/lib/utils'
import { FileText } from 'lucide-react'

export default function DocumentFilter({ documents, selected, onChange, multi = false }) {
  // documents: [{ id, filename }]
  // selected: Set<id> (multi) or string|null (single)

  if (!documents || documents.length === 0) return null

  const options = [{ id: 'all', filename: 'All Sources' }, ...documents]

  if (multi) {
    const allSelected = selected.size === documents.length

    const toggle = (id) => {
      if (id === 'all') {
        onChange(new Set(documents.map(d => d.id)))
        return
      }
      const next = new Set(selected)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      onChange(next)
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map(d => {
          const active = d.id === 'all' ? allSelected : selected.has(d.id)
          return (
            <button
              key={d.id}
              onClick={() => toggle(d.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border max-w-[200px]',
                active
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:bg-secondary hover:text-foreground opacity-50'
              )}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{d.filename}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // Single-select mode (for stats)
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(d => {
        const active = d.id === 'all' ? selected === 'all' : selected === d.id
        return (
          <button
            key={d.id}
            onClick={() => onChange(d.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border max-w-[200px]',
              active
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
            )}
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{d.filename}</span>
          </button>
        )
      })}
    </div>
  )
}
