import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDocuments, deleteDocument, regenerateCards, approveAllCards, approveCard, deleteCard, fetchPendingCards } from '../api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import DifficultyBadge from '../components/DifficultyBadge'
import { Textarea } from '@/components/ui/textarea'
import {
  FileText, ChevronDown, Plus, Loader2, Inbox, Settings2,
  Check, X, AlertCircle, CheckCheck, Sparkles, Trash2, AlertTriangle,
} from 'lucide-react'

function GenerateForm({ documentId, onDone, onCancel }) {
  const [cardCount, setCardCount] = useState('10')
  const [answerCount, setAnswerCount] = useState(5)
  const [minCorrect, setMinCorrect] = useState(1)
  const [maxCorrect, setMaxCorrect] = useState(4)
  const [hardRatio, setHardRatio] = useState(50)
  const [showSettings, setShowSettings] = useState(false)
  const [phase, setPhase] = useState('config') // 'config' | 'generating' | 'review'
  const [error, setError] = useState(null)
  const [chunkProgress, setChunkProgress] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [edited, setEdited] = useState([])
  const [approvingAll, setApprovingAll] = useState(false)

  const parsedCardCount = parseInt(cardCount, 10)
  const validCardCount = !isNaN(parsedCardCount) && parsedCardCount > 0

  const handleGenerate = async () => {
    if (!validCardCount) return
    setPhase('generating')
    setError(null)
    setChunkProgress(null)
    try {
      const result = await regenerateCards(
        documentId,
        Math.min(500, parsedCardCount),
        answerCount, minCorrect, maxCorrect, hardRatio,
        (completed, total, est, cardsGenerated) =>
          setChunkProgress({ completed, total, cardsGenerated }),
      )
      setDrafts(result.cards)
      setEdited(result.cards.map(c => ({ ...c })))
      setReviewIndex(0)
      setPhase('review')
    } catch (e) {
      setError(e.message)
      setPhase('config')
    }
  }

  const card = edited[reviewIndex]
  const total = edited.length

  const updateCard = (patch) => {
    setEdited(prev => prev.map((c, i) => i === reviewIndex ? { ...c, ...patch } : c))
  }

  const updateAnswer = (ansIdx, patch) => {
    const newAnswers = card.answers.map((a, i) => i === ansIdx ? { ...a, ...patch } : a)
    updateCard({ answers: newAnswers })
  }

  const removeAnswer = (ansIdx) => {
    updateCard({ answers: card.answers.filter((_, i) => i !== ansIdx) })
  }

  const addAnswer = () => {
    updateCard({ answers: [...card.answers, { text: '', isCorrect: false }] })
  }

  const approve = async () => {
    await approveCard(card.id)
    nextCard()
  }

  const skip = async () => {
    await deleteCard(card.id)
    nextCard()
  }

  const nextCard = () => {
    if (reviewIndex + 1 >= total) {
      onDone()
    } else {
      setReviewIndex(i => i + 1)
    }
  }

  const handleApproveAll = async () => {
    setApprovingAll(true)
    try {
      await approveAllCards()
      onDone()
    } catch {
      setApprovingAll(false)
    }
  }

  if (phase === 'generating') {
    return (
      <div className="text-center py-8 space-y-4">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
        <p className="text-sm font-medium">Generating flashcards…</p>
        {chunkProgress && (
          <div className="space-y-2 max-w-xs mx-auto">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-500"
                style={{ width: `${Math.round((chunkProgress.completed / chunkProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((chunkProgress.completed / chunkProgress.total) * 100)}% complete
              {chunkProgress.cardsGenerated > 0 && ` · ${chunkProgress.cardsGenerated} cards`}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'review' && card) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Review {reviewIndex + 1} of {total}</span>
          <span>{Math.round((reviewIndex / total) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${(reviewIndex / total) * 100}%` }}
          />
        </div>

        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {card.sourceRef && (
                <Badge variant="secondary" className="font-normal text-muted-foreground">
                  {card.sourceRef}
                </Badge>
              )}
              <DifficultyBadge difficulty={card.difficulty || 'normal'} />
            </div>

            <Textarea
              value={card.question}
              onChange={(e) => updateCard({ question: e.target.value })}
              rows={2}
              className="text-sm resize-none"
            />

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Answers</Label>
              {card.answers.map((ans, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Button
                    variant={ans.isCorrect ? 'default' : 'outline'}
                    size="icon"
                    className={cn(
                      'h-7 w-7 shrink-0',
                      ans.isCorrect && 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                    )}
                    onClick={() => updateAnswer(i, { isCorrect: !ans.isCorrect })}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    value={ans.text}
                    onChange={(e) => updateAnswer(i, { text: e.target.value })}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAnswer(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={addAnswer}>
                <Plus className="h-3.5 w-3.5" /> Add answer
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={skip}>Skip</Button>
          <Button size="sm" className="flex-1" onClick={approve}>
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </div>
        <Button variant="secondary" size="sm" className="w-full" onClick={handleApproveAll} disabled={approvingAll}>
          {approvingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Approve all {total - reviewIndex} remaining
        </Button>
      </div>
    )
  }

  // Config phase
  return (
    <div className="space-y-4 pt-2">
      {error && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Number of cards</Label>
          <Input
            type="number" min={1} max={500} value={cardCount}
            onChange={(e) => setCardCount(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Button
          variant={showSettings ? 'secondary' : 'outline'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSettings(s => !s)}
          title="Answer settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showSettings && (
        <div className="bg-muted rounded-lg p-3 space-y-3 border border-border">
          <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Answer Settings</span>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Answers/Q</Label>
              <Input
                type="number" min={2} max={8} value={answerCount}
                onChange={(e) => {
                  const v = Math.min(8, Math.max(2, +e.target.value))
                  setAnswerCount(v)
                  if (maxCorrect >= v) setMaxCorrect(v - 1)
                  if (minCorrect > v - 1) setMinCorrect(v - 1)
                }}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Min correct</Label>
              <Input
                type="number" min={1} max={maxCorrect} value={minCorrect}
                onChange={(e) => setMinCorrect(Math.min(maxCorrect, Math.max(1, +e.target.value)))}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Max correct</Label>
              <Input
                type="number" min={minCorrect} max={answerCount - 1} value={maxCorrect}
                onChange={(e) => setMaxCorrect(Math.min(answerCount - 1, Math.max(minCorrect, +e.target.value)))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Difficulty Mix</Label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={hardRatio}
          onChange={(e) => setHardRatio(+e.target.value)}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: hardRatio <= 50
              ? `linear-gradient(to right, #22c55e, #f97316 ${hardRatio * 2}%, #f97316 100%)`
              : `linear-gradient(to right, #f97316, #ef4444 ${(hardRatio - 50) * 2}%, #ef4444 100%)`,
          }}
        />
        <p className="text-center text-xs font-medium text-muted-foreground">
          {hardRatio <= 50
            ? `${100 - hardRatio * 2}% Normal / ${hardRatio * 2}% Hard`
            : `${100 - (hardRatio - 50) * 2}% Hard / ${(hardRatio - 50) * 2}% Extra Hard`}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={handleGenerate} disabled={!validCardCount}>
          <Sparkles className="h-3.5 w-3.5" />
          Generate {validCardCount ? Math.min(500, parsedCardCount) : ''} cards
        </Button>
      </div>
    </div>
  )
}

function ConfirmDeleteDocumentModal({ open, doc, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) { setTyped(''); setDeleting(false) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open || !doc) return null

  const count = doc.cardStats.total
  const confirmPhrase = `delete ${count} question${count !== 1 ? 's' : ''}`
  const matches = typed.trim().toLowerCase() === confirmPhrase

  const handleConfirm = async () => {
    if (!matches) return
    setDeleting(true)
    await onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-xl shadow-lg p-6 w-full max-w-md mx-4 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Delete document</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{doc.filename}</strong> and its {count} question{count !== 1 ? 's' : ''}? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Type <strong className="text-foreground">{confirmPhrase}</strong> to confirm:
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            className="text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && matches) handleConfirm() }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!matches || deleting}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

function DocumentRow({ doc, isExpanded, onToggle, onRefresh, onDelete }) {
  const [generating, setGenerating] = useState(false)
  const { cardStats } = doc

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={onToggle}
      >
        <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug truncate">{doc.filename}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(doc.createdAt).toLocaleDateString()}
          </p>
        </div>

        <span className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 mt-0.5">
          <span className="font-medium">{cardStats.total} cards</span>
          {cardStats.new > 0 && (
            <span className="inline-flex items-center gap-1 text-foreground">
              New {cardStats.new}
            </span>
          )}
          {cardStats.correct > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Check className="h-3 w-3" /> {cardStats.correct}
            </span>
          )}
          {cardStats.wrong > 0 && (
            <span className="inline-flex items-center gap-1 text-red-500">
              <X className="h-3 w-3" /> {cardStats.wrong}
            </span>
          )}
        </span>

        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 mt-0.5',
          isExpanded && 'rotate-180'
        )} />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          {generating ? (
            <GenerateForm
              documentId={doc.id}
              onDone={() => { setGenerating(false); onRefresh() }}
              onCancel={() => setGenerating(false)}
            />
          ) : (
            <div className="pt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setGenerating(true) }}
              >
                <Plus className="h-3.5 w-3.5" /> Generate More Questions
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(doc) }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Document
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchDocuments()
      setDocuments(data)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (id) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await deleteDocument(deleteTarget.id)
    setDeleteTarget(null)
    setExpandedId(null)
    load()
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto w-full text-center text-muted-foreground py-16">
        <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
        <p className="text-sm">Loading documents…</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          {documents.length} source {documents.length === 1 ? 'document' : 'documents'}
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No documents yet.</p>
          <p className="text-xs mt-1">Upload a document on the Create page to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isExpanded={expandedId === doc.id}
              onToggle={() => toggle(doc.id)}
              onRefresh={load}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteDocumentModal
        open={deleteTarget !== null}
        doc={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
