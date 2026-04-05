import { useState, useCallback } from 'react'
import { generateCards, createCard } from '../api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import DifficultyBadge from '../components/DifficultyBadge'
import { Upload, Settings2, Loader2, Check, X, Plus, AlertCircle } from 'lucide-react'

const ACCEPT_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.gif'

function UploadPhase({ onGenerate }) {
  const [file, setFile] = useState(null)
  const [cardCount, setCardCount] = useState(10)
  const [answerCount, setAnswerCount] = useState(5)
  const [minCorrect, setMinCorrect] = useState(1)
  const [maxCorrect, setMaxCorrect] = useState(4)
  const [hardRatio, setHardRatio] = useState(50)
  const [dragOver, setDragOver] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }, [])

  const handleSubmit = () => {
    if (!file) return
    onGenerate({ file, cardCount, answerCount, minCorrect, maxCorrect, hardRatio })
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create Flashcards</h1>
        <p className="text-sm text-muted-foreground">Upload your source material and let AI generate questions</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
          dragOver
            ? 'border-primary bg-secondary'
            : 'border-border bg-card hover:border-muted-foreground/40 hover:bg-secondary/50'
        )}
      >
        <input
          id="file-input"
          type="file"
          accept={ACCEPT_TYPES}
          className="hidden"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        {file ? (
          <p className="font-medium text-foreground">{file.name}</p>
        ) : (
          <>
            <p className="font-medium mb-1">Drop your file here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WebP, GIF</p>
          </>
        )}
      </div>

      {/* Settings */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Number of cards</Label>
              <Input
                type="number" min={1} max={500} value={cardCount}
                onChange={(e) => setCardCount(Math.min(500, Math.max(1, +e.target.value)))}
              />
            </div>
            <Button
              variant={showSettings ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setShowSettings(s => !s)}
              title="Answer settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>

          {showSettings && (
            <div className="bg-muted rounded-lg p-4 space-y-4 border border-border">
              <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Answer Settings</span>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Answers per question</Label>
                  <Input
                    type="number" min={2} max={8} value={answerCount}
                    onChange={(e) => {
                      const v = Math.min(8, Math.max(2, +e.target.value))
                      setAnswerCount(v)
                      if (maxCorrect >= v) setMaxCorrect(v - 1)
                      if (minCorrect > v - 1) setMinCorrect(v - 1)
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Min correct</Label>
                  <Input
                    type="number" min={1} max={maxCorrect} value={minCorrect}
                    onChange={(e) => setMinCorrect(Math.min(maxCorrect, Math.max(1, +e.target.value)))}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Max correct</Label>
                  <Input
                    type="number" min={minCorrect} max={answerCount - 1} value={maxCorrect}
                    onChange={(e) => setMaxCorrect(Math.min(answerCount - 1, Math.max(minCorrect, +e.target.value)))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Each question will have {answerCount} options with {minCorrect}–{maxCorrect} correct answers.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label>Difficulty Mix</Label>
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={hardRatio}
                onChange={(e) => setHardRatio(+e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #dbeafe ${hardRatio}%, #22c55e ${hardRatio}%)`,
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Normal
                </span>
                <span className="flex items-center gap-1.5">
                  Hard
                </span>
              </div>
              <p className="text-center text-sm font-medium">
                {100 - hardRatio}% Normal / {hardRatio}% Hard
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={handleSubmit} disabled={!file}>
        Generate {cardCount} cards
      </Button>
    </div>
  )
}

function GeneratingPhase({ hardRatio, chunkProgress }) {
  const formatTime = (seconds) => {
    if (seconds == null || seconds <= 0) return null
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }

  return (
    <div className="max-w-md mx-auto text-center py-24 space-y-6">
      <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
      <h2 className="text-xl font-semibold tracking-tight">Generating flashcards…</h2>
      <p className="text-sm font-medium text-muted-foreground">
        {100 - hardRatio}% Normal / {hardRatio}% Hard
      </p>
      {chunkProgress ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Processing section {Math.min(chunkProgress.completed + 1, chunkProgress.total)} of {chunkProgress.total}…
          </p>
          <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-500"
              style={{ width: `${Math.round((chunkProgress.completed / chunkProgress.total) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {Math.round((chunkProgress.completed / chunkProgress.total) * 100)}% complete
          </p>
          {formatTime(chunkProgress.estimatedRemainingSeconds) && (
            <p className="text-sm font-medium text-muted-foreground">
              ~{formatTime(chunkProgress.estimatedRemainingSeconds)} remaining
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">AI is analyzing your document and crafting questions</p>
      )}
    </div>
  )
}

function ReviewPhase({ cards, documentId, onDone }) {
  const [index, setIndex] = useState(0)
  const [edited, setEdited] = useState(() => cards.map(c => ({ ...c })))

  const card = edited[index]
  const total = edited.length

  const updateCard = (patch) => {
    setEdited(prev => prev.map((c, i) => i === index ? { ...c, ...patch } : c))
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
    await createCard({
      question: card.question,
      answers: card.answers,
      sourceRef: card.sourceRef,
      difficulty: card.difficulty || 'normal',
      documentId,
    })
    next()
  }

  const skip = () => next()

  const next = () => {
    if (index + 1 >= total) {
      onDone()
    } else {
      setIndex(i => i + 1)
    }
  }

  if (!card) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Card {index + 1} of {total}</span>
          <span>{Math.round(((index) / total) * 100)}% reviewed</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex gap-2 flex-wrap">
            {card.sourceRef && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border">
                {card.sourceRef}
              </span>
            )}
            <DifficultyBadge difficulty={card.difficulty || 'normal'} />
          </div>

          <Textarea
            value={card.question}
            onChange={(e) => updateCard({ question: e.target.value })}
            rows={3}
            className="text-base resize-none"
          />

          <div className="space-y-2">
            <Label className="text-muted-foreground">Answers</Label>
            {card.answers.map((ans, i) => (
              <div key={i} className="flex items-center gap-2">
                <Button
                  variant={ans.isCorrect ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'h-8 w-8 shrink-0',
                    ans.isCorrect && 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                  )}
                  onClick={() => updateAnswer(i, { isCorrect: !ans.isCorrect })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Input
                  value={ans.text}
                  onChange={(e) => updateAnswer(i, { text: e.target.value })}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAnswer(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={addAnswer}>
              <Plus className="h-4 w-4" /> Add answer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={skip}>
          Skip
        </Button>
        <Button className="flex-1" onClick={approve}>
          <Check className="h-4 w-4" /> Approve
        </Button>
      </div>
    </div>
  )
}

export default function CreatePage() {
  const [phase, setPhase] = useState('upload')
  const [drafts, setDrafts] = useState([])
  const [hardRatio, setHardRatio] = useState(50)
  const [documentId, setDocumentId] = useState(null)
  const [error, setError] = useState(null)
  const [chunkProgress, setChunkProgress] = useState(null)

  const handleGenerate = async ({ file, cardCount, answerCount, minCorrect, maxCorrect, hardRatio: ratio }) => {
    setHardRatio(ratio)
    setPhase('generating')
    setError(null)
    setChunkProgress(null)
    try {
      const result = await generateCards(
        file, cardCount, answerCount, minCorrect, maxCorrect, ratio,
        (completed, total, estimatedRemainingSeconds) => setChunkProgress({ completed, total, estimatedRemainingSeconds }),
      )
      setDrafts(result.cards)
      setDocumentId(result.documentId)
      setPhase('review')
    } catch (e) {
      setError(e.message)
      setPhase('upload')
    }
  }

  const handleDone = () => {
    setPhase('upload')
    setDrafts([])
    setDocumentId(null)
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      {error && (
        <div className="max-w-xl mx-auto mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {phase === 'upload' && <UploadPhase onGenerate={handleGenerate} />}
      {phase === 'generating' && <GeneratingPhase hardRatio={hardRatio} chunkProgress={chunkProgress} />}
      {phase === 'review' && <ReviewPhase cards={drafts} documentId={documentId} onDone={handleDone} />}
    </div>
  )
}
