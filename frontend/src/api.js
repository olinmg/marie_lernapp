const BASE = '/api'

export async function generateCards(file, cardCount, answerCount, minCorrect, maxCorrect, hardRatio, onProgress) {
  const form = new FormData()
  form.append('file', file)
  form.append('card_count', cardCount)
  form.append('answer_count', answerCount)
  form.append('min_correct', minCorrect)
  form.append('max_correct', maxCorrect)
  form.append('hard_ratio', hardRatio)

  const res = await fetch(`${BASE}/generate`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Generation failed')
  }

  const contentType = res.headers.get('content-type') || ''

  // Chunked SSE response for large documents
  if (contentType.includes('text/event-stream')) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let result = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines
      const lines = buffer.split('\n')
      buffer = lines.pop() // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6))
        if (event.type === 'progress' && onProgress) {
          onProgress(event.completed, event.total, event.estimatedRemainingSeconds)
        } else if (event.type === 'complete') {
          result = event
        }
      }
    }

    if (!result) throw new Error('Stream ended without completion event')
    return result // { documentId, cards }
  }

  return res.json() // { documentId, cards }
}

export function getDocumentUrl(documentId) {
  return `${BASE}/documents/${documentId}`
}

export async function fetchCards() {
  const res = await fetch(`${BASE}/cards`)
  if (!res.ok) throw new Error('Failed to fetch cards')
  return res.json()
}

export async function createCard(card) {
  const res = await fetch(`${BASE}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  })
  if (!res.ok) throw new Error('Failed to create card')
  return res.json()
}

export async function updateCard(id, patch) {
  const res = await fetch(`${BASE}/cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update card')
  return res.json()
}

export async function deleteCard(id) {
  const res = await fetch(`${BASE}/cards/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete card')
}

export async function submitAnswer(cardId, { isCorrect, responseTimeMs, answerCount }) {
  const res = await fetch(`${BASE}/cards/${cardId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCorrect, responseTimeMs, answerCount }),
  })
  if (!res.ok) throw new Error('Failed to submit answer')
  return res.json()
}

export async function fetchState() {
  const res = await fetch(`${BASE}/state`)
  if (!res.ok) throw new Error('Failed to fetch state')
  return res.json()
}

export async function fetchStats() {
  const res = await fetch(`${BASE}/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}
