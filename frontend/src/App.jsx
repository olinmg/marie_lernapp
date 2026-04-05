import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { Sparkles, BookOpen, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import logo from '@/assets/psychomausi-logo.png'
import CreatePage from './pages/CreatePage'
import StudyPage from './pages/StudyPage'
import OverviewPage from './pages/OverviewPage'

const tabs = [
  { path: '/create', label: 'Create', icon: Sparkles },
  { path: '/study', label: 'Study', icon: BookOpen },
  { path: '/overview', label: 'Overview', icon: BarChart3 },
]

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <img src={logo} alt="PsychoMausi" className="h-20 w-auto" />
            PsychoMausi
          </span>
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
        </div>
      </header>

      <main className="flex-1 py-8 px-6 overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/create" replace />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/overview" element={<OverviewPage />} />
        </Routes>
      </main>
    </div>
  )
}
