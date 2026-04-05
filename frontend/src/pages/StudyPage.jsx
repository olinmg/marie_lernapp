import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCards, submitAnswer, fetchState } from '../api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DifficultyBadge from '../components/DifficultyBadge'
import DocumentPreview from '../components/DocumentPreview'
import { getNextCard, filterCardsByMode } from '../srs'
import { Square, CheckSquare, CheckCircle2, XCircle, Loader2, Inbox, ArrowRight, ArrowLeft, Sparkles, Shuffle, RotateCcw, CheckCircle, Flame, ChevronDown } from 'lucide-react'
import { POSITIVE_QUOTES, SUPPORTIVE_QUOTES, INTERMISSION_QUOTES, getRandomQuote } from '../constants/easterEggs'

const EASTER_EGG_IMAGES = import.meta.glob('../assets/easter-eggs/*.{png,jpg,jpeg,gif,webp}', { eager: true, import: 'default' })
const imagesList = Object.values(EASTER_EGG_IMAGES)

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const MODES = [
  { key: 'mixed', label: 'Mixed', icon: Shuffle, description: 'All cards by priority' },
  { key: 'new', label: 'New Only', icon: Sparkles, description: 'Unreviewed cards' },
  { key: 'wrong', label: 'Wrong Only', icon: RotateCcw, description: 'Cards you got wrong' },
]

export default function StudyPage() {
  const [phase, setPhase] = useState('select') // 'select' | 'study'
  const [cards, setCards] = useState([])
  const [mode, setMode] = useState('mixed')
  const [turnCounter, setTurnCounter] = useState(0)
  const [current, setCurrent] = useState(null)
  const [shuffledAnswers, setShuffledAnswers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [checked, setChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  
  // Easter Eggs State
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0)
  const [consecutiveWrong, setConsecutiveWrong] = useState(0)
  const [activeToast, setActiveToast] = useState(null)
  
  const [showIntermission, setShowIntermission] = useState(false)
  const [intermissionData, setIntermissionData] = useState(null)
  
  const [expandedExplanations, setExpandedExplanations] = useState(new Set())
  const [hoverQuote, setHoverQuote] = useState('')
  
  const answerStartTime = useRef(null)
  const navigate = useNavigate()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [data, state] = await Promise.all([fetchCards(), fetchState()])
    setCards(data)
    setTurnCounter(state.turnCounter)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const pickNext = useCallback((allCards, currentMode, tc) => {
    const pool = filterCardsByMode(allCards, currentMode)
    if (pool.length === 0) { setCurrent(null); return }
    const card = getNextCard(pool, tc)
    setCurrent(card)
    setShuffledAnswers(shuffleArray(card.answers))
    setSelected(new Set())
    setChecked(false)
    setIsCorrect(false)
    setExpandedExplanations(new Set())
    setHoverQuote(getRandomQuote(SUPPORTIVE_QUOTES))
    answerStartTime.current = Date.now()
  }, [])

  // Start session: set mode, reset counters, pick first card, go to study phase
  const startSession = useCallback((newMode) => {
    setMode(newMode)
    setSessionCorrect(0)
    setSessionTotal(0)
    setConsecutiveCorrect(0)
    setConsecutiveWrong(0)
    setShowIntermission(false)
    pickNext(cards, newMode, turnCounter)
    setPhase('study')
  }, [cards, turnCounter, pickNext])

  // Exit back to mode selection
  const exitSession = useCallback(() => {
    setPhase('select')
    setCurrent(null)
    setSessionCorrect(0)
    setSessionTotal(0)
    setConsecutiveCorrect(0)
    setConsecutiveWrong(0)
    setShowIntermission(false)
    setActiveToast(null)
  }, [])

  const handleCheck = async () => {
    if (!current) return
    const correctSet = new Set(current.answers.filter(a => a.isCorrect).map(a => a.id))
    const correct = selected.size === correctSet.size && [...selected].every(id => correctSet.has(id))

    setIsCorrect(correct)
    setChecked(true)
    setSessionTotal(t => t + 1)
    setHoverQuote(correct ? getRandomQuote(POSITIVE_QUOTES) : getRandomQuote(SUPPORTIVE_QUOTES))
    
    if (correct) {
      setSessionCorrect(c => c + 1)
      
      const newStreak = consecutiveCorrect + 1
      setConsecutiveCorrect(newStreak)
      setConsecutiveWrong(0)
      
      if (newStreak === 5) {
        setActiveToast({ type: 'positive', text: getRandomQuote(POSITIVE_QUOTES) })
        setConsecutiveCorrect(0)
        setTimeout(() => setActiveToast(null), 4000)
      }
    } else {
      const newWrongStreak = consecutiveWrong + 1
      setConsecutiveWrong(newWrongStreak)
      setConsecutiveCorrect(0)
      
      if (newWrongStreak === 3) {
        setActiveToast({ type: 'supportive', text: getRandomQuote(SUPPORTIVE_QUOTES) })
        setConsecutiveWrong(0)
        setTimeout(() => setActiveToast(null), 5000)
      }
    }

    const responseTimeMs = Date.now() - (answerStartTime.current || Date.now())

    try {
      const result = await submitAnswer(current.id, {
        isCorrect: correct,
        responseTimeMs,
        answerCount: current.answers.length,
      })

      // Update local card state with new SRS data from server
      const newTurnCounter = result.turnCounter
      setTurnCounter(newTurnCounter)

      setCards(prev => prev.map(c =>
        c.id === current.id
          ? {
              ...c,
              stats: {
                correct: c.stats.correct + (correct ? 1 : 0),
                wrong: c.stats.wrong + (correct ? 0 : 1),
              },
              srs: result.srs,
            }
          : c
      ))
    } catch {
      // Silently handle error — session stats already updated locally
    }
  }

  const handleNext = () => {
    // Intermission check
    if (sessionTotal > 0 && sessionTotal % 25 === 0) {
      const includeImage = imagesList.length > 0 && Math.random() <= 0.50 // 50% chance
      const imgTarget = includeImage ? imagesList[Math.floor(Math.random() * imagesList.length)] : null
      
      setIntermissionData({
        quote: getRandomQuote(INTERMISSION_QUOTES),
        image: imgTarget
      })
      setShowIntermission(true)
    } else {
      pickNext(cards, mode, turnCounter)
    }
  }

  const continueFromIntermission = () => {
    setShowIntermission(false)
    pickNext(cards, mode, turnCounter)
  }

  const toggleAnswer = (id) => {
    if (checked) return
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const getAnswerClasses = (ans) => {
    if (!checked) {
      return selected.has(ans.id)
        ? 'bg-secondary border-primary/30 ring-1 ring-primary/20'
        : 'bg-card border-border hover:bg-secondary/50'
    }
    if (ans.isCorrect && selected.has(ans.id)) return 'bg-emerald-50 border-emerald-400'
    if (ans.isCorrect && !selected.has(ans.id)) return 'bg-blue-50 border-blue-400 border-dashed'
    if (!ans.isCorrect && selected.has(ans.id)) return 'bg-red-50 border-red-400'
    return 'bg-muted/20 border-border opacity-50'
  }

  const getAnswerIcon = (ans) => {
    if (!checked) {
      return selected.has(ans.id)
        ? <CheckSquare className="h-4 w-4 text-primary" />
        : <Square className="h-4 w-4 text-muted-foreground" />
    }
    if (ans.isCorrect && selected.has(ans.id)) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    if (ans.isCorrect && !selected.has(ans.id)) return <CheckCircle2 className="h-4 w-4 text-blue-500" />
    if (!ans.isCorrect && selected.has(ans.id)) return <XCircle className="h-4 w-4 text-red-600" />
    return <Square className="h-4 w-4 text-muted-foreground/30" />
  }

  const getAnswerLabel = (ans) => {
    if (!checked) return null
    if (ans.isCorrect && selected.has(ans.id)) return <span className="ml-auto text-xs font-medium text-emerald-600">Correct ✓</span>
    if (ans.isCorrect && !selected.has(ans.id)) return <span className="ml-auto text-xs font-medium text-blue-500">Missed — also correct</span>
    if (!ans.isCorrect && selected.has(ans.id)) return <span className="ml-auto text-xs font-medium text-red-600">Wrong ✗</span>
    return null
  }

  // Compute mode card counts for badges
  const modeCounts = {
    mixed: cards.length,
    new: cards.filter(c => c.srs.lastResult === null).length,
    wrong: cards.filter(c => c.srs.lastResult === 'wrong').length,
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
          <p className="text-sm">Loading cards…</p>
        </div>
      </div>
    )
  }

  const pool = filterCardsByMode(cards, mode)
  const hasDocument = current?.documentId != null
  const sessionWrong = sessionTotal - sessionCorrect
  const modeInfo = MODES.find(m => m.key === mode)

  const emptyMessages = {
    mixed: { title: 'No cards yet.', sub: 'Create some cards to get started.' },
    new: { title: 'All cards reviewed!', sub: 'Switch to Mixed to keep studying.' },
    wrong: { title: 'No wrong cards!', sub: 'Great job — try Mixed or New Only.' },
  }

  // ─── Mode Selection Screen ─────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="max-w-3xl mx-auto w-full space-y-8 py-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Study</h1>
          <p className="text-sm text-muted-foreground">Choose a study mode to begin</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MODES.map(m => {
            const Icon = m.icon
            const count = modeCounts[m.key]
            const disabled = count === 0
            return (
              <button
                key={m.key}
                onClick={() => !disabled && startSession(m.key)}
                className={cn(
                  'group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all text-center',
                  disabled
                    ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-md hover:bg-primary/5 cursor-pointer'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center h-12 w-12 rounded-full transition-colors',
                  disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{m.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                </div>
                <Badge variant={disabled ? 'outline' : 'secondary'} className="text-xs">
                  {count} {count === 1 ? 'card' : 'cards'}
                </Badge>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Study / Question Screen ───────────────────────────────────
  const ModeIcon = modeInfo?.icon || Shuffle

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {showIntermission ? (
          <div className="max-w-2xl mx-auto text-center space-y-6 py-12 animate-in fade-in zoom-in duration-500">
            <Card className="border-2 border-primary/20 bg-primary/5 shadow-lg overflow-hidden">
              {intermissionData?.image && (
                <div className="w-full max-h-80 flex items-center justify-center bg-muted/30 p-2">
                  <img src={intermissionData.image} alt="Intermission" className="max-w-full max-h-80 object-contain rounded-md" />
                </div>
              )}
              <CardContent className="pt-8 pb-8 space-y-6 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-primary animate-pulse" />
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Time for a breath</h2>
                <p className="text-lg font-medium text-muted-foreground max-w-md mx-auto leading-relaxed">{intermissionData?.quote}</p>
                <div className="pt-4">
                  <Button size="lg" onClick={continueFromIntermission}>
                    Continue Studying <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : pool.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{emptyMessages[mode].title}</p>
            <p className="text-xs mt-1">{emptyMessages[mode].sub}</p>
            <Button variant="outline" className="mt-6" onClick={exitSession}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Choose another mode
            </Button>
          </div>
        ) : current ? (
          <div className="flex items-start gap-6 w-full">
            {/* Back button — left edge */}
            <button
              onClick={exitSession}
              className="mt-2 flex-shrink-0 flex items-start gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="Back to mode selection"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {/* Center: Card + Document */}
            <div className={cn('flex-1 min-w-0 flex gap-6 justify-center')}>
              {/* Left: Card */}
              <div className={cn(hasDocument ? 'w-1/2' : 'w-full')} style={{ maxWidth: hasDocument ? undefined : '42rem' }}>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      <DifficultyBadge difficulty={current.difficulty} />
                      {current.sourceRef && (
                        <Badge variant="secondary" className="font-normal text-muted-foreground">
                          {current.sourceRef}
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-lg font-semibold leading-snug">
                      {current.question}
                    </h2>

                    <p className="text-xs text-muted-foreground">Select all that apply</p>

                    <div className="space-y-2">
                      {shuffledAnswers.map(ans => {
                        const hasExplanation = checked && ans.explanation
                        const isExpanded = expandedExplanations.has(ans.id)
                        return (
                          <div key={ans.id}>
                            <button
                              onClick={() => checked ? (hasExplanation && setExpandedExplanations(prev => {
                                const s = new Set(prev)
                                if (s.has(ans.id)) s.delete(ans.id); else s.add(ans.id)
                                return s
                              })) : toggleAnswer(ans.id)}
                              className={cn(
                                'w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all cursor-pointer border',
                                hasExplanation && isExpanded ? 'rounded-b-none' : '',
                                getAnswerClasses(ans)
                              )}
                            >
                              {getAnswerIcon(ans)}
                              <span className="text-sm">{ans.text}</span>
                              {getAnswerLabel(ans)}
                              {hasExplanation && (
                                <ChevronDown className={cn('h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                              )}
                            </button>
                            {hasExplanation && isExpanded && (
                              <div className={cn(
                                'px-4 py-2 text-xs border border-t-0 rounded-b-lg',
                                ans.isCorrect
                                  ? 'bg-emerald-50/50 border-emerald-400 text-emerald-700'
                                  : selected.has(ans.id)
                                    ? 'bg-red-50/50 border-red-400 text-red-700'
                                    : 'bg-muted/10 border-border text-muted-foreground'
                              )}>
                                {ans.explanation}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Document Preview */}
              {hasDocument && (
                <div className="w-1/2 bg-card rounded-xl border border-border overflow-hidden" style={{ minHeight: '600px' }}>
                  <DocumentPreview
                    documentId={current.documentId}
                    sourceRef={current.sourceRef}
                    revealed={checked}
                  />
                </div>
              )}
            </div>

            {/* Stats — right edge */}
            <div className="mt-2 flex-shrink-0 flex flex-col items-end gap-1 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ModeIcon className="h-3.5 w-3.5" />
                {modeInfo?.label}
              </span>
              <span className="text-muted-foreground">{sessionTotal} answered</span>
              {sessionCorrect > 0 && (
                <span className="text-emerald-600 font-medium">{sessionCorrect} ✓</span>
              )}
              {sessionWrong > 0 && (
                <span className="text-red-500 font-medium">{sessionWrong} ✗</span>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Fixed bottom bar — always visible when studying */}
      {phase === 'study' && current && !showIntermission && pool.length > 0 && (
        <div className="flex-shrink-0 pt-3 pb-1">
          <div className="mx-auto w-full" style={{ maxWidth: '42rem' }}>
            <div className="flex gap-3 items-stretch">
              {!checked ? (
                <>
                  <div className="group relative flex-1 flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium bg-primary/5 text-primary/70 border border-primary/10 cursor-default">
                    <Sparkles className="h-4 w-4" /> You got this!
                    <div className="absolute bottom-full left-0 right-0 mb-2 px-3 py-2 rounded-lg text-xs bg-card border border-border shadow-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {hoverQuote}
                    </div>
                  </div>
                  <Button size="lg" onClick={handleCheck} disabled={selected.size === 0}>
                    Check Answer
                  </Button>
                </>
              ) : (
                <>
                  <div className={cn(
                    'group relative flex-1 flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium cursor-default',
                    isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  )}>
                    {isCorrect
                      ? <><CheckCircle2 className="h-4 w-4" /> Correct — you got all right answers!</>
                      : <><XCircle className="h-4 w-4" /> Incorrect</>
                    }
                    <div className="absolute bottom-full left-0 right-0 mb-2 px-3 py-2 rounded-lg text-xs bg-card border border-border shadow-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {hoverQuote}
                    </div>
                  </div>
                  <Button size="lg" onClick={handleNext}>
                    Next Card <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Easter Egg Toast */}
      {activeToast && (
        <div className={cn(
          "fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 fade-in duration-300",
          "px-6 py-4 rounded-full shadow-lg border backdrop-blur-md font-medium text-center flex items-center gap-3",
          activeToast.type === 'positive' 
            ? "bg-rose-50/90 text-rose-700 border-rose-200"
            : "bg-blue-50/90 text-blue-700 border-blue-200"
        )}>
          {activeToast.type === 'positive' ? <Flame className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
          {activeToast.text}
        </div>
      )}

    </div>
  )
}
