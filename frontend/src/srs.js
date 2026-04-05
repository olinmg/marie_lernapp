/**
 * Spaced Repetition utilities — pure functions for priority scoring,
 * rating derivation, and study-mode filtering.
 */

export function getPriority(card, turnCounter) {
  const srs = card.srs
  const turnsSinceReview = turnCounter - srs.lastReviewedAt
  const due = turnsSinceReview / srs.interval
  return due * (1 / srs.easeFactor)
}

export function deriveRating(isCorrect, responseTimeMs, answerCount) {
  if (!isCorrect) return 1
  if (answerCount > 1 && responseTimeMs < 800) return 3 // likely guess
  if (responseTimeMs < 3000) return 5
  if (responseTimeMs < 8000) return 4
  return 3
}

export function getNextCard(cards, turnCounter) {
  if (cards.length === 0) return null
  return cards.reduce((best, card) => {
    const p = getPriority(card, turnCounter)
    return p > best.priority ? { card, priority: p } : best
  }, { card: cards[0], priority: getPriority(cards[0], turnCounter) }).card
}

/**
 * Filter cards by study mode:
 *  - 'new':   never reviewed (lastResult is null)
 *  - 'wrong': last result was wrong
 *  - 'mixed': all cards
 */
export function filterCardsByMode(cards, mode) {
  switch (mode) {
    case 'new':
      return cards.filter(c => c.srs.lastResult === null)
    case 'wrong':
      return cards.filter(c => c.srs.lastResult === 'wrong')
    case 'mixed':
    default:
      return cards
  }
}
