import { Badge } from '@/components/ui/badge'
import { getDifficulty } from '../constants'
import { cn } from '@/lib/utils'

export default function DifficultyBadge({ difficulty, size = 'sm' }) {
  const d = getDifficulty(difficulty)
  return (
    <Badge
      variant="outline"
      className={cn(
        d.badgeClass,
        size === 'lg' ? 'text-sm px-3 py-1' : ''
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', d.dotColor)} />
      {d.label}
    </Badge>
  )
}
