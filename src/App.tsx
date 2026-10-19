import { Suspense, lazy, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { BrandLockup } from './components/Brand'
import { Button, Icon, Screen } from './components/ui'
import { useCatalogBootstrap } from './lib/useCatalog'
import Catalog from './pages/Catalog'
import ExerciseDetail from './pages/ExerciseDetail'
import GuidePage from './pages/GuidePage'
import Onboarding from './pages/Onboarding'
import RoutinePage from './pages/RoutinePage'
import SessionPage from './pages/SessionPage'

// recharts e zod só carregam quando histórico/ajustes são abertos
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AiRoutinePage = lazy(() => import('./pages/AiRoutinePage'))
const AiReviewPage = lazy(() => import('./pages/AiReviewPage'))
const CicloPage = lazy(() => import('./pages/CicloPage'))

const Lazy = ({ title, children }: { title: string; children: ReactNode }) => (
  <Suspense fallback={<Screen title={title}>Carregando…</Screen>}>{children}</Suspense>
)

const TABS = [
  { to: '/treino', label: 'Treino', icon: 'dumbbell' },
  { to: '/exercicios', label: 'Exercícios', icon: 'list' },
  { to: '/historico', label: 'Histórico', icon: 'chart' },
  { to: '/config', label: 'Ajustes', icon: 'gear' },
]

function BottomNav() {
  const { pathname } = useLocation()
  // a grade do ciclo é uma vista da aba Treino
  const also = (to: string) => to === '/treino' && pathname.startsWith('/ciclo')
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive || also(t.to) ? 'text-accent' : 'text-muted'}`
              }
            >
              <Icon name={t.icon} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function App() {
  const { status, retry } = useCatalogBootstrap()

  if (status.state !== 'ready') {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <BrandLockup className="h-10" />
          {status.state === 'loading' ? (
            <p className="mt-3 text-sm text-muted">Preparando a base de exercícios…</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-danger">{status.message}</p>
              <p className="mt-1 text-xs text-muted">O primeiro acesso precisa de internet (~1,5 MB).</p>
              <Button className="mt-4" onClick={retry}>
                Tentar de novo
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/treino" replace />} />
        <Route path="/treino" element={<RoutinePage />} />
        <Route
          path="/ciclo"
          element={
            <Lazy title="Grade do ciclo">
              <CicloPage />
            </Lazy>
          }
        />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/sessao/:id" element={<SessionPage />} />
        <Route path="/exercicios" element={<Catalog />} />
        <Route path="/exercicio/:id" element={<ExerciseDetail />} />
        <Route
          path="/historico"
          element={
            <Lazy title="Histórico">
              <HistoryPage />
            </Lazy>
          }
        />
        <Route
          path="/config"
          element={
            <Lazy title="Ajustes">
              <SettingsPage />
            </Lazy>
          }
        />
        <Route
          path="/ia/rotina"
          element={
            <Lazy title="Rotina com IA">
              <AiRoutinePage />
            </Lazy>
          }
        />
        <Route
          path="/ia/revisao"
          element={
            <Lazy title="Revisar semana">
              <AiReviewPage />
            </Lazy>
          }
        />
        <Route path="/guia" element={<GuidePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}
