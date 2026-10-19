import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { PercentTable, PlateCalculator, RpeGuideTable, WarmupRamp } from '../components/BarTools'
import { RestTimer, TimerPresets } from '../components/RestTimer'
import { TreinoTabs } from '../components/TreinoTabs'
import { Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { db } from '../db'
import { exercisesWithHistory, loadSeries } from '../domain/stats'
import { startTimer, type TimerState } from '../domain/timer'
import { useExerciseMap } from '../lib/useCatalog'

function Tool({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group mb-3 rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
        {title}
        <span className="text-muted group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  )
}

/** 1RM: digitado ou o melhor estimado (Epley) de um exercício com histórico. */
function PercentWithHistory() {
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])
  const byId = useExerciseMap()
  const [picked, setPicked] = useState('')
  const options = useMemo(() => (sessions ? exercisesWithHistory(sessions) : []), [sessions])
  const best = useMemo(() => {
    if (!sessions || !picked) return null
    const s = loadSeries(picked, sessions)
    return s.length ? Math.max(...s.map((p) => p.e1rm)) : null
  }, [sessions, picked])
  const name = (id: string) => (byId?.get(id) ? displayName(byId.get(id)!) : id)
  return (
    <>
      {options.length > 0 && (
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          aria-label="Usar o 1RM estimado de um exercício"
          className="mb-2 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        >
          <option value="">Digitar o 1RM</option>
          {options.map((o) => (
            <option key={o.exerciseId} value={o.exerciseId}>
              1RM estimado: {name(o.exerciseId)}
            </option>
          ))}
        </select>
      )}
      <PercentTable key={`${picked}-${best}`} initialRm={best} hint={best ? 'Melhor 1RM estimado (Epley) do histórico deste exercício.' : undefined} />
    </>
  )
}

export default function FerramentasPage() {
  const [timer, setTimer] = useState<TimerState>({})
  const running = timer.until !== undefined || timer.pausedLeft !== undefined
  return (
    <Screen title="Ferramentas">
      <TreinoTabs />
      <Tool title="Cronômetro de descanso" open>
        {running ? <RestTimer inline state={timer} onChange={setTimer} /> : <TimerPresets onPick={(s) => setTimer(startTimer(s))} />}
        <p className="mt-2 text-[11px] text-muted">No fim: bipe e vibração. Durante o treino, o descanso começa sozinho ao concluir a série.</p>
      </Tool>
      <Tool title="Calculadora de anilhas">
        <PlateCalculator />
      </Tool>
      <Tool title="Rampa de aquecimento (LPO)">
        <WarmupRamp />
      </Tool>
      <Tool title="Tabela de % do 1RM">
        <PercentWithHistory />
      </Tool>
      <Tool title="Guia de RPE e RIR">
        <RpeGuideTable />
        <p className="mt-2 text-[11px] text-muted">
          RIR = repetições em reserva.{' '}
          <Link to="/guia" className="text-ink underline underline-offset-2">
            Entenda 1RM, RPE e as contas do app
          </Link>
        </p>
      </Tool>
    </Screen>
  )
}
