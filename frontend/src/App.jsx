import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { Sparkles, BookOpen, BarChart3, FolderOpen, LogOut, VolumeX, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setAuthToken, BASE } from '@/api'
import logo from '@/assets/psychomausi-logo.png'
import CreatePage from './pages/CreatePage'
import StudyPage from './pages/StudyPage'
import OverviewPage from './pages/OverviewPage'
import DocumentsPage from './pages/DocumentsPage'
import LoginPage from './pages/LoginPage'

const tabs = [
  { path: '/create', label: 'Upload', icon: Sparkles },
  { path: '/study', label: 'Study', icon: BookOpen },
  { path: '/overview', label: 'Overview', icon: BarChart3 },
  { path: '/documents', label: 'Documents', icon: FolderOpen },
]

export default function App() {
  const [authed, setAuthed] = useState(null) // null = checking
  const [muteNotes, setMuteNotes] = useState(() => localStorage.getItem('mute_bf_notes') === 'true')

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) { setAuthed(false); return }
    setAuthToken(token)
    fetch(`${BASE}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.ok) { setAuthed(true) } else { localStorage.removeItem('auth_token'); setAuthToken(null); setAuthed(false) } })
      .catch(() => { setAuthed(false) })
  }, [])

  function handleLogin(token) {
    localStorage.setItem('auth_token', token)
    setAuthToken(token)
    setAuthed(true)
  }

  function handleLogout() {
    localStorage.removeItem('auth_token')
    setAuthToken(null)
    setAuthed(false)
  }

  function toggleMuteNotes() {
    setMuteNotes(prev => {
      const next = !prev
      localStorage.setItem('mute_bf_notes', String(next))
      return next
    })
  }

  if (authed === null) return null // loading
  if (!authed) return <LoginPage onLogin={handleLogin} />

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <img src={logo} alt="PsychoMausi" className="h-20 w-auto" />
            PsychoMausi
          </span>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1">
              {tabs.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={toggleMuteNotes}
              className={cn(
                "ml-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                muteNotes
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
              title={muteNotes ? 'Boyfriend notes are muted' : 'Mute boyfriend notes'}
            >
              {muteNotes ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{muteNotes ? 'Notes muted' : 'Mute bf notes'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="ml-2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-6 flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/create" replace />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/study" element={<StudyPage muteNotes={muteNotes} />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
        </Routes>
      </main>
    </div>
  )
}
