import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { displayName } from '../data/catalog'
import type { Exercise } from '../data/types'
import { parseNumber, type SessionExercise } from '../domain/session'
import { fmtRest } from '../programacao/explain'
import { contaFor, fromReference } from '../programacao/progression/carga'
import { fmtKg, fmtReps, workingWeight } from '../programacao/progression/common'
import type { SuggestionKind } from '../programacao/types'
import { PlateCalculator, WarmupRamp } from './BarTools'
import { ExerciseGif } from './ExerciseMedia'
import { Icon, Sheet } from './ui'

/** Input numérico que aceita vírgula e só grava ao sair do campo/confirmar. */
function NumberField({
  value,
  onCommit,
  placeholder,
  label,
  step,
  disabled,
}: {
  value: number | null
  onCommit: (v: number | null) => void
  placeholder?: string
  label: string
  step?: 'decimal' | 'numeric'
  disabled?: boolean
}) {
  const fmt = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(fmt(value))
  }, [value, focused])
  return (
    <input
      aria-label={label}
      inputMode={step ?? 'decimal'}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        const v = parseNumber(text)
        if (v !== value) onCommit(v)
        setText(fmt(v))
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="display h-11 w-full min-w-0 rounded-lg border border-line bg-bg text-center text-base font-semibold outline-none placeholder:text-xs placeholder:font-normal placeholder:text-muted/60 focus:border-accent disabled:opacity-40"
    />
  )
}

const BANNER: Record<SuggestionKind, { cls: string; icon: string }> = {
  increase: { cls: 'border-accent/40 bg-accent/10 text-accent', icon: '↑' },
  less_rest: { cls: 'border-accent/40 bg-accent/10 text-accent', icon: '⏱' },
  add_set: { cls: 'border-accent/40 bg-accent/10 text-accent', icon: '+' },
  more_reps: { cls: 'border-accent/40 bg-accent/10 text-accent', icon: '↑' },
  decrease: { cls: 'border-warn/40 bg-warn/10 text-warn', icon: '↓' },
  deload: { cls: 'border-warn/40 bg-warn/10 text-warn', icon: '↓' },
  keep: { cls: 'border-line bg-surface-2 text-ink', icon: '=' },
  start: { cls: 'border-line bg-surface-2 text-muted', icon: '•' },
}

function bannerTitle(item: SessionExercise, bodyweight: boolean): string {
  const s = item.suggestion
  const w = s.weight !== null && !bodyweight ? fmtKg(s.weight) : null
  switch (s.kind) {
    case 'increase':
      return w ? `Suba para ${w}` : 'Hora de dificultar'
    case 'decrease':
      return w ? `Reduza para ${w}` : 'Alivie a variação'
    case 'deload':
      return w ? `Deload: ${w}` : 'Semana leve'
    case 'less_rest':
      return `Menos descanso: ${s.restSec}s`
    case 'add_set':
      return `Mais uma série: ${s.sets}`
    case 'more_reps':
      return `Busque ${s.reps?.min} reps${w ? ` com ${w}` : ''}`
    case 'keep':
      return w ? `Mantenha ${w}` : 'Mantenha e busque mais reps'
    case 'start':
      return 'Primeira vez'
  }
}

/** Primeira vez: peso × reps que a pessoa já faz → carga de partida pela conta do 1RM. */
function ReferenceCalc({ prescription, onUse }: { prescription: SessionExercise['prescription']; onUse: (kg: number) => void }) {
  const [weight, setWeight] = useState<number | null>(null)
  const [reps, setReps] = useState<number | null>(null)
  const calc = weight && reps ? fromReference({ weight, reps }, prescription) : null
  return (
    <div className="rounded-xl border border-line bg-bg p-2.5">
      <p className="text-xs font-medium">Já sabe quanto usa neste exercício?</p>
      <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <NumberField label="Peso de referência" value={weight} placeholder="kg" onCommit={setWeight} />
        <span className="text-muted">×</span>
        <NumberField label="Reps de referência" value={reps} step="numeric" placeholder="reps" onCommit={setReps} />
      </div>
      {calc && (
        <>
          <p className="mt-1.5 text-[11px] leading-snug text-muted">{calc.text}</p>
          <button onClick={() => onUse(calc.kg)} className="mt-1.5 w-full rounded-lg bg-accent/15 py-2 text-sm font-medium text-accent">
            Usar {fmtKg(calc.kg)} nas séries
          </button>
        </>
      )}
    </div>
  )
}

const range = (r?: { min: number; max: number }) => (!r ? '' : r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`)

export function SessionExerciseCard({
  index,
  tag,
  item,
  exercise,
  open,
  readOnly,
  onToggleOpen,
  onWeight,
  onReps,
  onRpe,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onVariant,
}: {
  index: number
  /** Ex.: "A1" em superset/circuito. */
  tag?: string
  item: SessionExercise
  exercise: Exercise | undefined
  open: boolean
  readOnly: boolean
  onToggleOpen: () => void
  onWeight: (set: number, v: number | null) => void
  onReps: (set: number, v: number | null) => void
  onRpe: (set: number, v: number | null) => void
  onToggleDone: (set: number) => void
  onAddSet: () => void
  onRemoveSet: () => void
  /** Variação executada (aparece na grade do ciclo). */
  onVariant?: (v: string) => void
}) {
  const [tool, setTool] = useState<'anilhas' | 'rampa' | null>(null)
  const p = item.prescription
  const timed = !!p.workSec
  const workKg = item.log.find((l) => !l.done && l.weight)?.weight ?? item.suggestion.weight ?? item.log[0]?.weight ?? null
  const doneCount = item.log.filter((l) => l.done).length
  const complete = doneCount >= p.sets
  const name = exercise ? displayName(exercise) : item.exerciseId
  const s = item.suggestion
  const bodyweight = item.previous ? workingWeight(item.previous) === 0 : exercise?.equipment === 'body weight'
  const banner = BANNER[s.kind]
  const target = timed ? `${p.sets}×${p.workSec}s` : `${p.sets}×${range(p.reps)}`
  const intensity = [p.pct1rm && `${range(p.pct1rm)}% 1RM`, p.rpe && `RPE ${range(p.rpe)}`].filter(Boolean).join(' · ')
  const conta = !timed && !bodyweight ? contaFor(item.recent ?? [], p, s.weight) : null
  const firstOpen = item.log.findIndex((l) => !l.done)
  const cols = timed ? 'grid-cols-[2rem_1fr_2.75rem]' : 'grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.75rem]'

  return (
    <section className={`rounded-2xl border ${complete ? 'border-accent/30' : 'border-line'} bg-surface`}>
      <button onClick={onToggleOpen} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
            complete ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'
          }`}
        >
          {complete ? <Icon name="check" className="size-4" /> : (tag ?? index + 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="text-sm text-muted">
            {target} · {doneCount}/{item.log.length} {timed ? 'voltas' : 'séries'}
          </span>
        </span>
        {!open && s.weight !== null && s.weight > 0 && (
          <span className={`rounded-lg border px-2 py-1 text-xs ${banner.cls}`}>
            {banner.icon} {fmtKg(s.weight)}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-line p-3">
          <div className="flex gap-3">
            {exercise && (
              <Link to={`/exercicio/${exercise.id}`} className="w-[42%] shrink-0" aria-label={`Como fazer ${name}`}>
                <ExerciseGif exercise={exercise} />
              </Link>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`rounded-xl border p-2.5 ${banner.cls}`}>
                <p className="display font-semibold">
                  {banner.icon} {bannerTitle(item, bodyweight)}
                </p>
                <p className="mt-0.5 text-xs leading-snug opacity-90">{s.reason}</p>
              </div>
              {conta && (
                <details className="rounded-xl border border-line bg-bg px-2.5 py-2 text-xs">
                  <summary className="cursor-pointer font-medium">A conta · 1RM ≈ {fmtKg(conta.estimate.e1rm)}</summary>
                  <ul className="mt-1 space-y-0.5 leading-snug text-muted">
                    {conta.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="text-xs text-muted">
                Alvo: {target}
                {intensity && ` · ${intensity}`} · {timed ? `pausa ${p.restSec}s` : `descanso ${fmtRest(p.restSec)}`}
              </p>
              {!timed && (
                <div>
                  <p className="text-xs font-medium text-muted">Histórico</p>
                  {item.recent?.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs tabular-nums">
                      {[...item.recent].reverse().map((r) => (
                        <li key={r.date} className="flex justify-between gap-2">
                          <span className="text-muted">{new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          <span>
                            {bodyweight ? '' : `${fmtKg(workingWeight(r))} × `}
                            {fmtReps(r)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted">Sem registros ainda.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {s.kind === 'start' && !timed && !bodyweight && !readOnly && firstOpen !== -1 && (
            <div className="mt-3">
              <ReferenceCalc prescription={p} onUse={(kg) => onWeight(firstOpen, kg)} />
            </div>
          )}

          <div className={`mt-3 grid ${cols} items-center gap-1.5 text-center text-[11px] text-muted`}>
            <span>#</span>
            {timed ? (
              <span>Trabalho</span>
            ) : (
              <>
                <span>Anterior</span>
                <span>kg</span>
                <span>Reps</span>
                <span>RPE</span>
              </>
            )}
            <span />
          </div>
          <ol className="mt-1 space-y-1.5">
            {item.log.map((l, i) => {
              const prev = item.previous?.sets[i]
              return (
                <li key={i} className={`grid ${cols} items-center gap-1.5 rounded-xl px-0.5 py-0.5 ${l.done ? 'bg-accent/10' : ''}`}>
                  <span className="text-center font-semibold text-muted">{i + 1}</span>
                  {timed ? (
                    <span className="text-center text-sm">
                      {p.workSec}s trabalho · {p.restSec}s pausa
                    </span>
                  ) : (
                    <>
                      <span className="truncate text-center text-xs text-muted tabular-nums">
                        {prev ? `${bodyweight ? '' : `${String(prev.weight).replace('.', ',')}×`}${prev.reps}` : '—'}
                      </span>
                      <NumberField label={`Carga série ${i + 1}`} value={l.weight} placeholder={bodyweight ? 'PC' : 'kg'} onCommit={(v) => onWeight(i, v)} />
                      <NumberField label={`Reps série ${i + 1}`} value={l.reps} step="numeric" placeholder={range(p.reps)} onCommit={(v) => onReps(i, v)} />
                      <NumberField
                        label={`RPE série ${i + 1}`}
                        value={l.rpe}
                        placeholder="RPE"
                        onCommit={(v) => onRpe(i, v === null ? null : Math.min(10, Math.max(1, Math.round(v * 2) / 2)))}
                      />
                    </>
                  )}
                  <button
                    disabled={readOnly}
                    onClick={() => onToggleDone(i)}
                    aria-label={l.done ? `Desmarcar série ${i + 1}` : `Concluir série ${i + 1}`}
                    aria-pressed={l.done}
                    className={`grid size-11 place-items-center rounded-xl border ${
                      l.done ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-2 text-muted'
                    }`}
                  >
                    <Icon name="check" />
                  </button>
                </li>
              )
            })}
          </ol>
          {!timed && (
            <p className="mt-1.5 text-[11px] text-muted">
              RPE é opcional (1–10; 10 = falha). Ajuda a progressão por carga.{' '}
              <Link to="/guia" className="text-ink underline underline-offset-2">
                Entenda 1RM e RPE
              </Link>
            </p>
          )}
          {!readOnly && onVariant && !timed && (
            <input
              defaultValue={item.variant ?? ''}
              maxLength={60}
              placeholder="Variação executada (opcional)"
              aria-label="Variação executada"
              onBlur={(e) => e.target.value.trim() !== (item.variant ?? '') && onVariant(e.target.value.trim())}
              className="mt-2 h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
            />
          )}
          {!readOnly && (
            <div className="mt-2 flex items-center justify-end gap-2 text-sm">
              {!timed && !bodyweight && (
                <span className="mr-auto flex gap-1">
                  <button onClick={() => setTool('anilhas')} className="rounded-lg px-2 py-1.5 text-muted hover:bg-surface-2">
                    Anilhas
                  </button>
                  <button onClick={() => setTool('rampa')} className="rounded-lg px-2 py-1.5 text-muted hover:bg-surface-2">
                    Aquecimento
                  </button>
                </span>
              )}
              <button onClick={onRemoveSet} className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2">
                − {timed ? 'volta' : 'série'}
              </button>
              <button onClick={onAddSet} className="rounded-lg px-3 py-1.5 text-accent hover:bg-surface-2">
                + {timed ? 'volta' : 'série'}
              </button>
            </div>
          )}
        </div>
      )}
      {tool && (
        <Sheet eyebrow={tool === 'anilhas' ? 'Anilhas por lado' : 'Rampa de aquecimento'} title={name} onClose={() => setTool(null)}>
          {tool === 'anilhas' ? <PlateCalculator initialKg={workKg} /> : <WarmupRamp initialKg={workKg} />}
        </Sheet>
      )}
    </section>
  )
}
