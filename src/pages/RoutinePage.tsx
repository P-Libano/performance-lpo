import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { SwapSheet } from '../components/SwapSheet'
import { Chip, Icon, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { MUSCLE_GROUP_PT, type MuscleGroup } from '../data/curated'
import { EQUIPMENT_ACCESS_PT, GOAL_PT, LEVEL_PT, SPLIT_PT } from '../domain/profile'
import { replaceExercise, useActiveProgram } from '../lib/programStore'
import { startOrResume, useActiveSession, useLastDoneSession } from '../lib/sessionStore'
import { useExerciseMap, useExercises } from '../lib/useCatalog'
import { fmtRest } from '../programacao/explain'
import { allWeeks, nextPosition } from '../programacao/program'
import type { ExerciseGroup, ExercisePrescription, Range } from '../programacao/types'

const ROLE_PT = { principal: 'Principal', composto: 'Composto', isolador: 'Isolador', condicionamento: 'Condicionamento' } as const
const GROUP_KIND_PT = { superset: 'Superset', circuito: 'Circuito', finisher: 'Finisher' } as const
const r = (x?: Range, unit = '') => (!x ? '' : x.min === x.max ? `${x.min}${unit}` : `${x.min}–${x.max}${unit}`)

export function intensityLabel(i: Pick<ExercisePrescription, 'pct1rm' | 'rpe'>) {
  return [i.pct1rm && `${r(i.pct1rm, '%')} 1RM`, i.rpe && `RPE ${r(i.rpe)}`].filter(Boolean).join(' · ')
}

export function prescriptionLabel(i: ExercisePrescription) {
  return i.workSec ? `${i.sets}×${i.workSec}s` : `${i.sets}×${r(i.reps)}`
}

export default function RoutinePage() {
  const program = useActiveProgram()
  const catalog = useExercises()
  const byId = useExerciseMap()
  const active = useActiveSession()
  const last = useLastDoneSession(program?.id)
  const navigate = useNavigate()
  const [weekSel, setWeekSel] = useState<number | undefined>()
  const [daySel, setDaySel] = useState<string | undefined>()
  const [swap, setSwap] = useState<{ day: string; gi: number; ii: number } | null>(null)
  const [why, setWhy] = useState(false)

  const next = program && last !== undefined ? nextPosition(program, last ?? undefined) : undefined
  const weeks = program ? allWeeks(program) : []
  const weekIndex = weekSel ?? next?.weekIndex
  const week = weeks.find((w) => w.index === weekIndex)
  const nextDay = next && week?.index === next.weekIndex ? week.days[next.dayIndex]?.key : undefined
  const dayKey = daySel && week?.days.some((d) => d.key === daySel) ? daySel : (nextDay ?? week?.days[0]?.key)
  const day = week?.days.find((d) => d.key === dayKey)
  const dayIds = useMemo(() => new Set(day?.groups.flatMap((g) => g.items.map((i) => i.exerciseId))), [day])

  if (program === null) return <Navigate to="/onboarding" replace />
  if (!program || !byId || !catalog || !week || !day) return <Screen title="Treino">Carregando…</Screen>

  const p = program.profile
  const swapping = swap && day.groups[swap.gi]?.items[swap.ii]
  const swappingEx = swapping && byId.get(swapping.exerciseId)
  const targets = program.goal.weeklySets

  const itemRow = (it: ExercisePrescription, gi: number, ii: number, tag?: string) => {
    const ex = byId.get(it.exerciseId)
    if (!ex) return null
    const intensity = intensityLabel(it)
    return (
      <li key={`${gi}-${ii}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
        <Link to={`/exercicio/${ex.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <ExerciseThumb exercise={ex} size={52} />
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {tag && <span className="display mr-1 text-xs font-semibold text-accent">{tag}</span>}
              {displayName(ex)}
            </span>
            <span className="text-sm text-muted">
              <span className="font-semibold text-ink">{prescriptionLabel(it)}</span>
              {it.startKg ? ` · ${it.startKg.toLocaleString('pt-BR')} kg` : ''}
              {it.workSec ? ` · pausa ${it.restSec}s` : ` · descanso ${fmtRest(it.restSec)}`}
            </span>
            <span className="mt-1 flex flex-wrap gap-1">
              <Chip tone={it.role === 'principal' ? 'accent' : 'default'}>{ROLE_PT[it.role]}</Chip>
              {intensity && <Chip>{intensity}</Chip>}
            </span>
          </span>
        </Link>
        <button
          onClick={() => setSwap({ day: day.key, gi, ii })}
          aria-label={`Trocar ${displayName(ex)}`}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="swap" />
        </button>
      </li>
    )
  }

  const groupBlock = (g: ExerciseGroup, gi: number) => {
    if (g.kind === 'simples') return <ul key={gi}>{itemRow(g.items[0], gi, 0)}</ul>
    const letter = String.fromCharCode(65 + gi)
    const head =
      g.kind === 'finisher'
        ? `${GROUP_KIND_PT.finisher} · ${g.durationMin} min · ${g.rounds} voltas de ${g.items[0].workSec}s/${g.restBetweenSec}s`
        : `${GROUP_KIND_PT[g.kind]} · ${g.rounds} voltas · ${g.restBetweenSec}s entre exercícios, ${fmtRest(g.restAfterSec ?? 0)} ao fim da volta`
    return (
      <section key={gi} className="rounded-2xl border border-accent/25 bg-accent/5 p-2">
        <p className="px-1 pb-1.5 text-xs font-medium text-accent">{head}</p>
        <ul className="space-y-1.5">{g.items.map((it, ii) => itemRow(it, gi, ii, `${letter}${ii + 1}`))}</ul>
      </section>
    )
  }

  return (
    <Screen
      title="Seu programa"
      action={
        <Link to="/onboarding" className="rounded-lg px-2 py-1 text-sm text-accent hover:bg-surface-2">
          Refazer
        </Link>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {program.source === 'template' ? (
          <>
            <Chip tone="accent">{program.templateName}</Chip>
            <Chip>{p.daysPerWeek}x/semana</Chip>
            <Chip>Ciclo {program.currentCycle ?? 1}</Chip>
          </>
        ) : (
          <>
            <Chip tone="accent">{GOAL_PT[p.goal]}</Chip>
            <Chip>{p.daysPerWeek}x/semana</Chip>
            <Chip>{SPLIT_PT[p.split]}</Chip>
            <Chip>{EQUIPMENT_ACCESS_PT[p.equipment]}</Chip>
            <Chip>{LEVEL_PT[p.level]}</Chip>
          </>
        )}
        {program.source === 'ia' && <Chip tone="accent">IA</Chip>}
      </div>

      <button onClick={() => setWhy((v) => !v)} className="mt-3 w-full rounded-xl border border-line bg-surface p-3 text-left" aria-expanded={why}>
        <span className="flex items-center justify-between text-sm font-medium">
          Por que este treino
          <span className="text-muted">{why ? '−' : '+'}</span>
        </span>
        {why && (
          <span className="mt-2 block text-sm leading-relaxed text-muted">
            {program.explanation}
            {program.notes && <span className="mt-2 block text-ink/80">IA: {program.notes}</span>}
          </span>
        )}
      </button>
      {why && (
        <Link to="/guia" className="mt-1 block px-1 text-xs text-muted underline underline-offset-2">
          O que significam %1RM e RPE?
        </Link>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Link to="/ia/rotina" className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-2.5 hover:border-muted">
          <Icon name="sparkle" className="size-4 text-accent" /> Gerar com IA
        </Link>
        <Link to="/ia/revisao" className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-2.5 hover:border-muted">
          <Icon name="sparkle" className="size-4 text-accent" /> Revisar semana
        </Link>
      </div>

      {program.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          {program.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {active && (
        <Link to={`/sessao/${active.id}`} className="mt-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <span>
            <span className="block text-sm text-accent">Treino em andamento</span>
            <span className="font-semibold">{active.dayName}</span>
          </span>
          <span className="font-semibold text-accent">Continuar →</span>
        </Link>
      )}

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Semanas do ciclo</h2>
        {next && <span className="text-xs text-muted">próxima: semana {next.weekIndex}</span>}
      </div>
      <div className="mt-1 flex gap-1.5 overflow-x-auto pt-1.5 pr-1.5 pb-1" role="tablist" aria-label="Semanas">
        {weeks.map((w) => (
          <button
            key={w.index}
            role="tab"
            aria-selected={w.index === week.index}
            onClick={() => {
              setWeekSel(w.index)
              setDaySel(undefined)
            }}
            className={`relative shrink-0 rounded-lg border px-3 py-1.5 text-sm ${
              w.index === week.index ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface text-muted'
            }`}
          >
            Sem. {w.index}
            {w.kind === 'deload' && <span className="ml-1 text-[10px] uppercase text-warn">deload</span>}
            {next?.weekIndex === w.index && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      {week.kind === 'deload' && (
        <p className="mt-2 text-xs text-warn">Semana de deload: menos séries, carga mais leve e RPE até {program.goal.periodization.deload.rpeMax}.</p>
      )}

      <div className="mt-2 flex gap-2 overflow-x-auto pt-1.5 pr-1.5 pb-1" role="tablist" aria-label="Dias">
        {week.days.map((d) => (
          <button
            key={d.key}
            role="tab"
            aria-selected={d.key === day.key}
            onClick={() => setDaySel(d.key)}
            className={`relative shrink-0 rounded-xl border px-4 py-2 font-semibold ${
              d.key === day.key ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface text-muted'
            }`}
          >
            {d.key}
            {d.key === nextDay && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h2 className="display text-lg font-bold">{day.name}</h2>
        {day.key === nextDay && <span className="text-xs text-accent">Próximo treino</span>}
      </div>
      {day.notes && <p className="mt-1 text-sm text-muted">{day.notes}</p>}

      <div className="mt-2 space-y-2">{day.groups.map(groupBlock)}</div>

      <button
        disabled={!!active}
        onClick={async () => navigate(`/sessao/${await startOrResume(program, week.index, day.key)}`)}
        className="mt-5 h-12 w-full rounded-xl bg-accent font-semibold text-accent-ink disabled:opacity-40"
      >
        {active ? 'Conclua o treino em andamento' : `Iniciar ${day.name} · semana ${week.index}`}
      </button>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">Séries por semana (planejado)</h2>
        <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
          {(Object.entries(program.weeklyVolume) as [MuscleGroup, number][])
            .filter(([g]) => g !== 'condicionamento')
            .sort((a, b) => b[1] - a[1])
            .map(([g, n]) => {
              const t = targets[g]
              const ok = !t || (n >= t.min && n <= t.max)
              return (
                <li key={g} className="flex justify-between rounded-lg bg-surface px-3 py-1.5">
                  <span>{MUSCLE_GROUP_PT[g]}</span>
                  <span className={`tabular-nums ${ok ? 'text-ink' : 'text-warn'}`}>
                    {n}
                    {t && <span className="text-muted"> / {r(t)}</span>}
                  </span>
                </li>
              )
            })}
        </ul>
      </section>

      {swap && swapping && swappingEx && (
        <SwapSheet
          current={swappingEx}
          catalog={catalog}
          profile={p}
          exclude={dayIds}
          onlyLowRep={!!swapping.reps && swapping.reps.min < 6}
          onClose={() => setSwap(null)}
          onPick={async (id) => {
            await replaceExercise(program.id!, swap.day, swap.gi, swap.ii, id)
            setSwap(null)
          }}
        />
      )}
    </Screen>
  )
}
