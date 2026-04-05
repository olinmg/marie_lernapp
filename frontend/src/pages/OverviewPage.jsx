import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchCards, deleteCard, fetchDocumentBlobUrl, fetchStats } from '../api'
import { DIFFICULTIES } from '../constants'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DifficultyBadge from '../components/DifficultyBadge'
import DocumentFilter from '../components/DocumentFilter'
import { Trash2, ChevronDown, FileText, X, Check, Loader2, Inbox, AlertTriangle, BarChart3, ChevronUp, Search } from 'lucide-react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const SORT_OPTIONS = [
  { key: 'page', label: 'Page' },
  { key: 'correct', label: 'Most Correct' },
  { key: 'wrong', label: 'Most Wrong' },
  { key: 'practiced', label: 'Most Practiced' },
]

const ACTIVITY_TABS = [
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'cumulative', label: 'Cumulative' },
]

function StatsSection({ stats: initialStats, documents }) {
  const [activityTab, setActivityTab] = useState('daily')
  const [expanded, setExpanded] = useState(true)
  const [diffFilter, setDiffFilter] = useState('all')
  const [docFilter, setDocFilter] = useState('all')
  const [stats, setStats] = useState(initialStats)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => { setStats(initialStats) }, [initialStats])

  useEffect(() => {
    if (diffFilter === 'all' && docFilter === 'all') {
      setStats(initialStats)
      return
    }
    let cancelled = false
    setLoadingStats(true)
    fetchStats(
      diffFilter !== 'all' ? diffFilter : undefined,
      docFilter !== 'all' ? docFilter : undefined,
    )
      .then(data => { if (!cancelled) setStats(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingStats(false) })
    return () => { cancelled = true }
  }, [diffFilter, docFilter, initialStats])

  if (!stats) return null

  const activityData = stats[activityTab] || []
  const hasActivity = activityData.some(d => d.count > 0)
  const hasProgress = (stats.progress || []).length > 0

  if (!hasActivity && !hasProgress) return null

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Statistics
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-5 space-y-6 border-t border-border pt-4">
          {/* Difficulty filter */}
          <div className="flex flex-wrap gap-1.5">
            {[{ key: 'all', label: 'All' }, ...DIFFICULTIES].map(d => {
              const active = diffFilter === d.key
              return (
                <button
                  key={d.key}
                  onClick={(e) => { e.stopPropagation(); setDiffFilter(d.key) }}
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
            {loadingStats && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center ml-1" />}
          </div>

          {/* Document source filter */}
          {documents.length > 1 && (
            <DocumentFilter
              documents={documents}
              selected={docFilter}
              onChange={setDocFilter}
            />
          )}

          {/* Activity Chart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Questions Answered</h3>
              <div className="flex gap-1">
                {ACTIVITY_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={(e) => { e.stopPropagation(); setActivityTab(tab.key) }}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border',
                      activityTab === tab.key
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-card text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                {activityTab === 'cumulative' ? (
                  <AreaChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Total Answered"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Answers"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={activityTab === 'daily'}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Progress Chart — Stacked Area */}
          {hasProgress && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Question Status Over Time</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.progress}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="correct"
                      name="Correct"
                      stackId="1"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="wrong"
                      name="Wrong"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="unanswered"
                      name="Unanswered"
                      stackId="1"
                      stroke="#171717"
                      fill="#171717"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function sortCards(cards, sortBy) {
  return [...cards].sort((a, b) => {
    switch (sortBy) {
      case 'page':
        return (a.sourceRef || '').localeCompare(b.sourceRef || '', undefined, { numeric: true })
      case 'correct':
        return b.stats.correct - a.stats.correct
      case 'wrong':
        return b.stats.wrong - a.stats.wrong
      case 'practiced':
        return (b.stats.correct + b.stats.wrong) - (a.stats.correct + a.stats.wrong)
      default:
        return 0
    }
  })
}

function parsePageNumber(sourceRef) {
  if (!sourceRef) return null
  const match = sourceRef.match(/page\s*(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

function ConfirmDeleteModal({ open, onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-xl shadow-lg p-6 w-full max-w-sm mx-4 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Delete question</h3>
            <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

function CardRow({ card, isOpen, onToggle, onDelete, onShowEvidence }) {
  const total = card.stats.correct + card.stats.wrong

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={onToggle}
      >
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 mt-0.5',
          isOpen && 'rotate-180'
        )} />

        <span className="flex-1 text-sm font-medium leading-snug min-w-0">
          {card.question}
        </span>

        <span className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 mt-0.5">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Check className="h-3 w-3" /> {card.stats.correct}
          </span>
          <span className="inline-flex items-center gap-1 text-red-500">
            <X className="h-3 w-3" /> {card.stats.wrong}
          </span>
          <span className="text-muted-foreground font-medium">
            Σ {total}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
          <div className="flex gap-2 flex-wrap items-center">
            <DifficultyBadge difficulty={card.difficulty} />
            {card.sourceRef && (
              <Badge variant="secondary" className="font-normal text-muted-foreground">
                {card.sourceRef}
              </Badge>
            )}
          </div>

          <ul className="space-y-1.5">
            {card.answers.map(a => (
              <li
                key={a.id || a.text}
                className={cn(
                  'flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                  a.isCorrect
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                {a.isCorrect
                  ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  : <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                }
                {a.text}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between pt-1">
            <div>
              {card.documentId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onShowEvidence(card) }}
                >
                  <FileText className="h-3.5 w-3.5" /> Show Evidence
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OverviewPage() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('page')
  const [openIds, setOpenIds] = useState(new Set())
  const [evidenceCard, setEvidenceCard] = useState(null)
  const [evidenceUrl, setEvidenceUrl] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [stats, setStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInQuestions, setSearchInQuestions] = useState(true)
  const [searchInAnswers, setSearchInAnswers] = useState(true)
  const [docFilter, setDocFilter] = useState('all')

  const loadCards = useCallback(async () => {
    setLoading(true)
    const [data, statsData] = await Promise.all([fetchCards(), fetchStats()])
    setCards(data)
    setStats(statsData)
    setLoading(false)
  }, [])

  useEffect(() => { loadCards() }, [loadCards])

  // Compute unique documents from cards
  const uniqueDocuments = (() => {
    const map = new Map()
    for (const c of cards) {
      if (c.documentId && !map.has(c.documentId)) {
        map.set(c.documentId, { id: c.documentId, filename: c.documentFilename || 'Unknown' })
      }
    }
    return Array.from(map.values())
  })()

  const sorted = sortCards(cards, sortBy)

  const filtered = sorted.filter(card => {
    // Document filter
    if (docFilter !== 'all') {
      if (card.documentId !== docFilter) return false
    }
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    if (searchInQuestions && card.question.toLowerCase().includes(q)) return true
    if (searchInAnswers && card.answers.some(a => a.text.toLowerCase().includes(q))) return true
    return false
  })

  const toggle = (id) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDelete = async (id) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    const id = deleteId
    setDeleteId(null)
    await deleteCard(id)
    setCards(prev => prev.filter(c => c.id !== id))
    setOpenIds(prev => { const next = new Set(prev); next.delete(id); return next })
    if (evidenceCard?.id === id) setEvidenceCard(null)
  }

  const handleShowEvidence = (card) => {
    setEvidenceCard(prev => prev?.id === card.id ? null : card)
  }

  useEffect(() => {
    if (!evidenceCard?.documentId) { setEvidenceUrl(null); return }
    let revoked = false
    fetchDocumentBlobUrl(evidenceCard.documentId).then((url) => {
      if (revoked) return
      const page = parsePageNumber(evidenceCard.sourceRef)
      setEvidenceUrl(page ? `${url}#page=${page}` : url)
    })
    return () => { revoked = true }
  }, [evidenceCard])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto w-full text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
        <p className="text-sm">Loading cards…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Statistics */}
      <StatsSection stats={stats} documents={uniqueDocuments} />

      {/* Search bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cards…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-4">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={searchInQuestions}
              onChange={e => setSearchInQuestions(e.target.checked)}
              className="accent-foreground h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-muted-foreground">Questions</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={searchInAnswers}
              onChange={e => setSearchInAnswers(e.target.checked)}
              className="accent-foreground h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-muted-foreground">Answers</span>
          </label>
        </div>
      </div>

      {/* Sort bar */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border',
              sortBy === opt.key
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Document source filter */}
      {uniqueDocuments.length > 1 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          <DocumentFilter
            documents={uniqueDocuments}
            selected={docFilter}
            onChange={setDocFilter}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
          {searchQuery.trim() ? (
            <>
              <p className="text-sm">No cards match your search.</p>
              <p className="text-xs mt-1">Try a different search term or adjust the filters.</p>
            </>
          ) : (
            <>
              <p className="text-sm">No cards yet.</p>
              <p className="text-xs mt-1">Create some cards to get started.</p>
            </>
          )}
        </div>
      ) : (
        <div className={cn('flex gap-6', evidenceCard && 'items-start')}>
          <div className={cn('space-y-2', evidenceCard ? 'w-1/2' : 'w-full')}>
            {filtered.map(card => (
              <CardRow
                key={card.id}
                card={card}
                isOpen={openIds.has(card.id)}
                onToggle={() => toggle(card.id)}
                onDelete={handleDelete}
                onShowEvidence={handleShowEvidence}
              />
            ))}
          </div>

          {evidenceCard && (
            <div className="w-1/2 sticky top-20 bg-card rounded-xl border border-border overflow-hidden" style={{ height: 'calc(100vh - 8rem)' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Source Document
                </span>
                {parsePageNumber(evidenceCard.sourceRef) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                    Page {parsePageNumber(evidenceCard.sourceRef)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => setEvidenceCard(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <iframe
                key={evidenceUrl}
                src={evidenceUrl}
                className="w-full border-0"
                style={{ height: 'calc(100% - 2.5rem)' }}
                title="Document preview"
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
