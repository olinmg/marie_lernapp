export const BASE = import.meta.env.VITE_API_URL || '/api'
console.log('[api] BASE URL resolved to:', BASE)

let _token = null

export function setAuthToken(token) {
  _token = token
}

function authHeaders(extra = {}) {
  const h = { ...extra }
  if (_token) h['Authorization'] = `Bearer ${_token}`
  return h
}

export async function generateCards(file, cardCount, answerCount, minCorrect, maxCorrect, hardRatio, onProgress) {
  const form = new FormData()
  form.append('file', file)
  form.append('card_count', cardCount)
  form.append('answer_count', answerCount)
  form.append('min_correct', minCorrect)
  form.append('max_correct', maxCorrect)
  form.append('hard_ratio', hardRatio)

  const res = await fetch(`${BASE}/generate`, { method: 'POST', body: form, headers: authHeaders() })
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
    let allCards = []

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
          if (event.cards && event.cards.length > 0) {
            allCards = allCards.concat(event.cards)
          }
          onProgress(event.completed, event.total, null, allCards.length)
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

export async function fetchDocumentBlobUrl(documentId) {
  const res = await fetch(`${BASE}/documents/${documentId}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch document')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchCards() {
  const res = await fetch(`${BASE}/cards`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch cards')
  return res.json()
}

export async function createCard(card) {
  const res = await fetch(`${BASE}/cards`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(card),
  })
  if (!res.ok) throw new Error('Failed to create card')
  return res.json()
}

export async function updateCard(id, patch) {
  const res = await fetch(`${BASE}/cards/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update card')
  return res.json()
}

export async function deleteCard(id) {
  const res = await fetch(`${BASE}/cards/${id}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to delete card')
}

export async function fetchPendingCards() {
  const res = await fetch(`${BASE}/cards/pending`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch pending cards')
  return res.json()
}

export async function approveCard(id) {
  const res = await fetch(`${BASE}/cards/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to approve card')
  return res.json()
}

export async function approveAllCards() {
  const res = await fetch(`${BASE}/cards/approve-all`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to approve all cards')
  return res.json()
}

export async function submitAnswer(cardId, { isCorrect, responseTimeMs, answerCount }) {
  const res = await fetch(`${BASE}/cards/${cardId}/answer`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ isCorrect, responseTimeMs, answerCount }),
  })
  if (!res.ok) throw new Error('Failed to submit answer')
  return res.json()
}

export async function fetchState() {
  const res = await fetch(`${BASE}/state`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch state')
  return res.json()
}

export async function fetchStats(difficulty, documentId) {
  const params = new URLSearchParams()
  if (difficulty) params.set('difficulty', difficulty)
  if (documentId) params.set('document_id', documentId)
  const qs = params.toString()
  const res = await fetch(`${BASE}/stats${qs ? '?' + qs : ''}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function fetchDocuments() {
  const res = await fetch(`${BASE}/documents`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

export async function deleteDocument(documentId) {
  const res = await fetch(`${BASE}/documents/${documentId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete document')
}

export async function regenerateCards(documentId, cardCount, answerCount, minCorrect, maxCorrect, hardRatio, onProgress) {
  const form = new FormData()
  form.append('card_count', cardCount)
  form.append('answer_count', answerCount)
  form.append('min_correct', minCorrect)
  form.append('max_correct', maxCorrect)
  form.append('hard_ratio', hardRatio)

  const res = await fetch(`${BASE}/documents/${documentId}/generate`, {
    method: 'POST',
    body: form,
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Generation failed')
  }

  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('text/event-stream')) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let result = null
    let allCards = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6))
        if (event.type === 'progress' && onProgress) {
          if (event.cards && event.cards.length > 0) {
            allCards = allCards.concat(event.cards)
          }
          onProgress(event.completed, event.total, null, allCards.length)
        } else if (event.type === 'complete') {
          result = event
        }
      }
    }

    if (!result) throw new Error('Stream ended without completion event')
    return result
  }

  return res.json()
}
