import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ReadinessCard } from '../components/ReadinessCard'
import { RestTimer, TimerPresets } from '../components/RestTimer'
import { startTimer, type TimerState } from '../domain/timer'
import { SessionExerciseCard } from '../components/SessionExerciseCard'
import { Button, Icon, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { fmtKg } from '../programacao/progression/common'
import { db } from '../db'
import { sessionSummary } from '../domain/session'
import { fmtDay, previousSameDay } from '../domain/stats'
import { useExerciseMap } from '../lib/useCatalog'
import {
  addSet,
  discardSession,
  finishSession,
  removeLastSet,
  setReadiness,
  setRest,
  setWeightFrom,
  toggleSetDone,
  updateSet,
  useSession,
} from '../lib/sessionStore'

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const m = Math.floor((now - since) / 60000)
  return <span className="display text-muted">{m} min</span>
}

export default function SessionPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const session = useSession(id)
  const byId = useExerciseMap()
  const navigate = useNavigate()
  const [open, setOpen] = useState<number | null | undefined>(undefined)
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null)
  const doneSessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])

  const onRest = useCallback((t: TimerState) => setRest(id, t), [id])
  const [showPresets, setShowPresets] = useState(false)

  // abre o primeiro exercício com série pendente
  useEffect(() => {
    if (session && open === undefined) {
      const i = session.exercises.findIndex((e) => e.log.some((l) => !l.done))
      setOpen(i === -1 ? null : i)
    }
  }, [session, open])

  if (session === null) {
    return (
      <Screen title="Treino" back>
        <p className="text-muted">Sessão não encontrada.</p>
      </Screen>
    )
  }
  if (!session || !byId) return <Screen title="Treino">Carregando…</Screen>

  const done = session.status === 'done'
  const pending = session.exercises.reduce((a, e) => a + e.log.filter((l) => !l.done).length, 0)
  const groupIndices = [...new Set(session.exercises.map((e) => e.groupIndex))]

  if (done) {
    const sum = sessionSummary(session)
    const prev = doneSessions && previousSameDay(session, doneSessions)
    const prevKg = prev ? sessionSummary(prev).volumeKg : 0
    const delta = prevKg > 0 ? Math.round(((sum.volumeKg - prevKg) / prevKg) * 100) : null
    return (
      <Screen title={session.dayName} back>
        <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-sm text-accent">Treino concluído</p>
          <p className="mt-1 text-sm text-muted">
            {new Date(session.startedAt).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}
          </p>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ['Duração', `${sum.durationMin} min`],
              ['Exercícios', sum.exercises],
              ['Séries', sum.sets],
              ['Volume', fmtKg(Math.round(sum.volumeKg))],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="display font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {sum.volumeKg > 0 && (
            <p className="mt-3 border-t border-accent/20 pt-2 text-sm">
              {prev && delta !== null ? (
                <>
                  Volume{' '}
                  <strong className={`tabular-nums ${delta >= 0 ? 'text-accent' : ''}`}>
                    {delta >= 0 ? '+' : '−'}
                    {Math.abs(delta)}%
                  </strong>{' '}
                  <span className="text-muted">
                    vs a última vez ({fmtDay(prev.startedAt)}: {fmtKg(Math.round(prevKg))}).
                  </span>
                </>
              ) : (
                <span className="text-muted">Primeiro registro deste treino.</span>
              )}{' '}
              <Link to="/historico" className="text-xs text-muted underline underline-offset-2">
                Ver evolução
              </Link>
            </p>
          )}
        </div>
        <ul className="mt-4 space-y-2">
          {session.exercises.map((e) => {
            const ex = byId.get(e.exerciseId)
            const sets = e.log.filter((l) => l.done)
            return (
              <li key={e.exerciseId} className="rounded-xl border border-line bg-surface p-3">
                <p className="font-medium">{ex ? displayName(ex) : e.exerciseId}</p>
                <p className="mt-0.5 text-sm text-muted tabular-nums">
                  {sets.length
                    ? sets.map((l) => `${l.weight ? `${String(l.weight).replace('.', ',')}×` : ''}${l.reps}`).join(' · ')
                    : 'não feito'}
                </p>
              </li>
            )
          })}
        </ul>
        <Button className="mt-5 w-full" onClick={() => navigate('/treino')}>
          Voltar para a rotina
        </Button>
      </Screen>
    )
  }

  return (
    <Screen
      title={session.dayName}
      action={
        <button onClick={() => setConfirm('finish')} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
          Concluir
        </button>
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <Elapsed since={session.startedAt} />
        <span className="flex-1 text-muted">{pending} séries restantes</span>
        <button
          onClick={() => setShowPresets((v) => !v)}
          aria-expanded={showPresets}
          className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
        >
          <Icon name="timer" className="size-4" /> Descanso
        </button>
      </div>
      <ReadinessCard value={session.readiness} onChange={(r) => setReadiness(id, r)} />
      {showPresets && (
        <TimerPresets
          className="mb-3"
          onPick={(sec) => {
            onRest(startTimer(sec))
            setShowPresets(false)
          }}
        />
      )}

      <div className="space-y-3">
        {groupIndices.map((gi) => {
          const members = session.exercises.map((e, ex) => ({ e, ex })).filter(({ e }) => e.groupIndex === gi)
          const kind = members[0].e.groupKind
          const letter = String.fromCharCode(65 + gi)
          const cards = members.map(({ e: item, ex }, k) => (
            <SessionExerciseCard
              key={`${item.exerciseId}-${ex}`}
              index={ex}
              tag={kind === 'simples' ? undefined : `${letter}${k + 1}`}
              item={item}
              exercise={byId.get(item.exerciseId)}
              open={open === ex}
              readOnly={false}
              onToggleOpen={() => setOpen(open === ex ? null : ex)}
              onWeight={(set, v) => setWeightFrom(id, ex, set, v)}
              onReps={(set, v) => updateSet(id, ex, set, { reps: v })}
              onRpe={(set, v) => updateSet(id, ex, set, { rpe: v })}
              onToggleDone={async (set) => {
                const wasDone = item.log[set].done
                await toggleSetDone(id, ex, set)
                if (wasDone) return
                // superset/circuito: alterna para o próximo exercício do grupo com série pendente
                if (kind !== 'simples') {
                  const order = [...members.slice(k + 1), ...members.slice(0, k + 1)]
                  const nxt = order.find(({ e, ex: j }) => e.log.some((l, i) => !l.done && !(j === ex && i === set)))
                  if (nxt) return setOpen(nxt.ex)
                }
                // concluiu a última série pendente: avança para o próximo exercício
                const remaining = item.log.filter((l, i) => i !== set && !l.done).length
                if (remaining === 0) {
                  const next = session.exercises.findIndex((e, i) => i > ex && e.log.some((l) => !l.done))
                  setOpen(next === -1 ? null : next)
                }
              }}
              onAddSet={() => addSet(id, ex)}
              onRemoveSet={() => removeLastSet(id, ex)}
            />
          ))
          if (kind === 'simples') return <div key={gi}>{cards}</div>
          const p0 = members[0].e.prescription
          const head =
            kind === 'finisher'
              ? `Finisher · ${members.length} exercícios · ${p0.workSec}s trabalho / ${p0.restSec}s pausa`
              : `${kind === 'superset' ? 'Superset' : 'Circuito'} · alterne os exercícios; descanse ao fim da volta`
          return (
            <div key={gi} className="space-y-2 rounded-2xl border border-accent/25 bg-accent/5 p-2">
              <p className="px-1 text-xs font-medium text-accent">{head}</p>
              {cards}
            </div>
          )
        })}
      </div>

      <button onClick={() => setConfirm('discard')} className="mt-6 w-full py-3 text-sm text-danger/80 hover:text-danger">
        Descartar treino
      </button>
      {(session.restUntil || session.restPausedLeft !== undefined) && <div className="h-24" />}

      <RestTimer
        state={{ until: session.restUntil, total: session.restTotal, pausedLeft: session.restPausedLeft }}
        onChange={onRest}
      />

      {confirm && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 px-6" role="dialog" aria-modal>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
            <p className="text-lg font-semibold">{confirm === 'finish' ? 'Concluir treino?' : 'Descartar treino?'}</p>
            <p className="mt-1 text-sm text-muted">
              {confirm === 'finish'
                ? pending
                  ? `${pending} séries não foram marcadas e não entram no histórico.`
                  : 'Tudo marcado. As cargas da próxima sessão serão calculadas a partir deste treino.'
                : 'As séries registradas serão apagadas.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
                Voltar
              </Button>
              {confirm === 'finish' ? (
                <Button
                  className="flex-1"
                  onClick={async () => {
                    await finishSession(id)
                    setConfirm(null)
                  }}
                >
                  Concluir
                </Button>
              ) : (
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={async () => {
                    await discardSession(id)
                    navigate('/treino', { replace: true })
                  }}
                >
                  Descartar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}
