export const DIFFICULTIES = [
  { key: 'normal', label: 'Normal', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500', activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300', hex: '#22c55e' },
  { key: 'hard', label: 'Hard', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', dotColor: 'bg-amber-500', activeClass: 'bg-amber-50 text-amber-700 border-amber-300', hex: '#f97316' },
  { key: 'extra_hard', label: 'Extra Hard', badgeClass: 'bg-red-50 text-red-700 border-red-200', dotColor: 'bg-red-500', activeClass: 'bg-red-50 text-red-700 border-red-300', hex: '#ef4444' },
]

export function getDifficulty(key) {
  return DIFFICULTIES.find(d => d.key === key) || DIFFICULTIES[0]
}
