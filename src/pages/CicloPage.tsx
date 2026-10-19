import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { TreinoTabs } from '../components/TreinoTabs'
import { Button, Chip, Screen, Sheet } from '../components/ui'
import { displayName } from '../data/catalog'
import {
  aboveFirstWeek,
  cleanNum,
  cycleSummary,
  deltaVsFirst,
  deltaVsPrev,
  oneRm,
  tonnage,
  type Cell,
  type Grid,
  type GridRow,
} from '../domain/ciclo'
import { exportBackupFile } from '../lib/backup'
import { setCell, startNewCycle, useCycleGrid } from '../lib/cicloStore'
import { useActiveProgram } from '../lib/programStore'
import { useExerciseMap } from '../lib/useCatalog'
import type { Program } from '../programacao/types'

export const fmtNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
export const fmtTonKg = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} kg`
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

function Delta({ pct, suffix = '' }: { pct: number | null; suffix?: string }) {
  if (pct === null || pct === 0) return null
  return (
    <span className={`rounded px-1 text-[10px] font-bold tabular-nums ${pct > 0 ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'}`}>
      {pct > 0 ? '+' : ''}
      {pct}%{suffix}
    </span>
  )
}

/** Faixa de tonelagem S1–S4 (todos os dias) e o resumo contra o ciclo anterior. */
export function TonnageBanner({ grid, previous }: { grid: Grid; previous?: Parameters<typeof cycleSummary>[1] }) {
  const sum = cycleSummary(grid, previous)
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label="Tonelagem do ciclo">
      <p className="eyebrow text-muted">Tonelagem por semana · todos os dias</p>
      <dl className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${grid.weekIndices.length}, minmax(0, 1fr))` }}>
        {grid.weekIndices.map((w, i) => (
          <div key={w} className="rounded-lg bg-surface-2 px-1 py-1.5 text-center">
            <dt className="text-[11px] text-muted">
              S{i + 1}
              {grid.weekKinds[i] === 'deload' && <span className="text-warn"> ·dl</span>}
            </dt>
            <dd className="display text-sm font-semibold">{fmtTonKg(grid.weekTotals[i])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        Ciclo {grid.cycle}: <strong className="text-ink">{fmtTonKg(sum.total)}</strong>
        {sum.previous && (
          <>
            {' '}
            · anterior ({fmtDate(sum.previous.closedAt)}): {fmtTonKg(sum.previous.total)}{' '}
            {sum.pctVsPrevious !== null && <Delta pct={sum.pctVsPrevious} suffix=" vs anterior" />}
          </>
        )}
      </p>
    </section>
  )
}

function CellButton({ row, wi, onOpen }: { row: GridRow; wi: number; onOpen: () => void }) {
  const c = row.cells[wi]
  const filled = c.sets !== null || c.kg !== null
  const prev = row.prev[wi]
  return (
    <button
      onClick={onOpen}
      className={`relative flex min-h-[86px] min-w-0 flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1.5 text-center ${
        filled ? 'border-line bg-bg' : 'border-dashed border-line bg-transparent text-muted'
      }`}
      aria-label={`Semana ${wi + 1}: ${filled ? `${c.sets ?? 0} séries de ${c.reps ?? '—'} com ${c.kg ?? 0} kg` : 'vazia'}`}
    >
      {aboveFirstWeek(row, wi) && (
        <span className="absolute -top-2 right-0 rounded-full bg-accent px-1 text-[9px] font-black text-accent-ink" title="Carga acima da S1 (não é PR real)">
          ↑S1
        </span>
      )}
      {c.variant && <span className="w-full truncate px-0.5 text-[10px] text-accent">{c.variant}</span>}
      {filled ? (
        <>
          <span className="display text-sm font-semibold leading-tight">{c.kg !== null ? fmtNum(c.kg) : '—'}</span>
          <span className="text-[11px] leading-tight tabular-nums">
            {c.sets ?? 0}×{c.reps ?? '—'}
            {c.rpe !== null && <span className="text-muted"> @{fmtNum(c.rpe)}</span>}
          </span>
        </>
      ) : (
        <span className="my-auto text-lg leading-none">+</span>
      )}
      {filled && <span className="text-[10px] leading-tight text-muted tabular-nums">{c.tonnage ? fmtTonKg(c.tonnage) : 'ton —'}</span>}
      <Delta pct={deltaVsFirst(row, wi)} />
      {prev !== null && prev > 0 && (
        <span className="text-[9px] leading-tight text-muted" title="Mesma semana do ciclo anterior">
          Ant. {fmtNum(prev)} <Delta pct={deltaVsPrev(row, wi)} />
        </span>
      )}
    </button>
  )
}

/** `wi` = posição da semana no ciclo (0 = S1); `weekIndex` = índice da semana no programa. */
type Editing = { row: GridRow; wi: number; weekIndex: number }

function CellEditor({ program, editing, name, onClose }: { program: Program; editing: Editing; name: string; onClose: () => void }) {
  const { row, wi } = editing
  const c = row.cells[wi]
  const str = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
  const [f, setF] = useState({ variant: c.variant, sets: str(c.sets), reps: str(c.reps), kg: str(c.kg), rpe: str(c.rpe) })
  const [busy, setBusy] = useState(false)
  const parsed = { sets: cleanNum('sets', f.sets), reps: cleanNum('reps', f.reps), kg: cleanNum('kg', f.kg), rpe: cleanNum('rpe', f.rpe) }
  const e1rm = oneRm(parsed.reps, parsed.kg)

  const save = async (cell: Pick<Cell, 'sets' | 'reps' | 'kg' | 'rpe' | 'variant'>) => {
    setBusy(true)
    try {
      await setCell(program, editing.weekIndex, row.dayKey, row.groupIndex, row.itemIndex, row.exerciseId, cell)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const field = (k: 'sets' | 'reps' | 'kg' | 'rpe', label: string, placeholder: string) => (
    <label className="block min-w-0">
      <span className="text-[11px] text-muted">{label}</span>
      <input
        inputMode={k === 'sets' || k === 'reps' ? 'numeric' : 'decimal'}
        value={f[k]}
        placeholder={placeholder}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        onFocus={(e) => e.target.select()}
        className="display h-11 w-full min-w-0 rounded-lg border border-line bg-bg text-center text-base font-semibold outline-none focus:border-accent"
      />
    </label>
  )

  return (
    <Sheet eyebrow={`Semana ${wi + 1} · ${row.dayKey}`} title={name} onClose={onClose}>
      <label className="block">
        <span className="text-[11px] text-muted">Variação executada</span>
        <input
          value={f.variant}
          maxLength={60}
          placeholder="Ex.: snatch bloco, pausa no joelho…"
          onChange={(e) => setF({ ...f, variant: e.target.value })}
          className="h-11 w-full rounded-lg border border-line bg-bg px-3 outline-none focus:border-accent"
        />
      </label>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {field('sets', 'Séries', '0')}
        {field('reps', 'Reps', '—')}
        {field('kg', 'kg', '0')}
        {field('rpe', 'RPE', '8')}
      </div>
      <p className="mt-2 text-xs text-muted tabular-nums">
        Tonelagem: <strong className="text-ink">{fmtTonKg(tonnage(parsed.sets, parsed.reps, parsed.kg))}</strong>
        {e1rm > 0 && (
          <>
            {' '}
            · 1RM estimado (Epley): <strong className="text-ink">{fmtNum(e1rm)} kg</strong>
          </>
        )}
      </p>
      {!c.uniform && (
        <p className="mt-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
          As séries desta semana têm cargas ou reps diferentes. Salvar pela grade deixa todas iguais ({parsed.sets ?? 0}×{parsed.reps ?? '—'} com{' '}
          {parsed.kg ?? 0} kg). Para manter cada série, edite no histórico do treino.
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted">
        Séries ≤ 20, reps ≤ 100, kg ≤ 500, RPE ≤ 10. Vírgula decimal vale. O RPE vai na última série.
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => save({ sets: null, reps: null, kg: null, rpe: null, variant: '' })}>
          Limpar
        </Button>
        <Button className="flex-1" disabled={busy} onClick={() => save({ ...parsed, variant: f.variant.trim() })}>
          Salvar semana {wi + 1}
        </Button>
      </div>
    </Sheet>
  )
}

export default function CicloPage() {
  const program = useActiveProgram()
  const data = useCycleGrid(program)
  const byId = useExerciseMap()
  const [daySel, setDaySel] = useState<string | undefined>()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [confirmCycle, setConfirmCycle] = useState(false)

  if (program === null) return <Navigate to="/onboarding" replace />
  if (!program || !data || !byId) return <Screen title="Grade do ciclo">Carregando…</Screen>

  const { grid, previous } = data
  const day = grid.days.find((d) => d.key === daySel) ?? grid.days[0]
  const name = (id: string) => {
    const e = byId.get(id)
    return e ? displayName(e) : id
  }
  const cols = { gridTemplateColumns: `repeat(${grid.weekIndices.length}, minmax(0, 1fr))` }

  return (
    <Screen
      title="Grade do ciclo"
      action={
        <button onClick={() => setConfirmCycle(true)} className="rounded-lg px-2 py-1 text-sm text-accent hover:bg-surface-2 print:hidden">
          Novo ciclo
        </button>
      }
    >
      <TreinoTabs />
      <TonnageBanner grid={grid} previous={previous} />

      <div className="mt-4 flex gap-2 overflow-x-auto pt-1.5 pr-1.5 pb-1" role="tablist" aria-label="Dias">
        {grid.days.map((d) => (
          <button
            key={d.key}
            role="tab"
            aria-selected={d.key === day.key}
            onClick={() => setDaySel(d.key)}
            className={`shrink-0 rounded-xl border px-4 py-2 font-semibold ${
              d.key === day.key ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface text-muted'
            }`}
          >
            {d.key}
          </button>
        ))}
      </div>

      <h2 className="display mt-3 text-lg font-bold">{day.name}</h2>
      {day.notes && <p className="mt-0.5 text-sm text-muted">{day.notes}</p>}

      <div className="mt-3 space-y-3">
        {day.rows.map((row) => {
          const ex = byId.get(row.exerciseId)
          return (
            <section key={`${row.groupIndex}-${row.itemIndex}`} className="rounded-2xl border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2.5">
                {ex && (
                  <Link to={`/exercicio/${ex.id}`} aria-label={`Como fazer ${name(row.exerciseId)}`}>
                    <ExerciseThumb exercise={ex} size={40} />
                  </Link>
                )}
                <p className="min-w-0 flex-1 truncate font-medium">{name(row.exerciseId)}</p>
                {row.role === 'principal' && <Chip tone="accent">Principal</Chip>}
              </div>
              <div className="mt-2 grid gap-1 text-center text-[11px] text-muted" style={cols}>
                {grid.weekIndices.map((w, i) => (
                  <span key={w}>
                    S{i + 1}
                    {grid.weekKinds[i] === 'deload' && <span className="text-warn"> dl</span>}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid gap-1" style={cols}>
                {grid.weekIndices.map((w, wi) => (
                  <CellButton key={w} row={row} wi={wi} onOpen={() => setEditing({ row, wi, weekIndex: w })} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="mt-3 grid gap-1 rounded-xl bg-surface-2 p-2 text-center text-xs tabular-nums" style={cols} aria-label="Tonelagem do dia">
        {day.tonnage.map((t, i) => (
          <span key={i}>
            <span className="block text-[10px] text-muted">Dia S{i + 1}</span>
            {fmtTonKg(t)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Toque numa semana para registrar séries, reps, carga, RPE e a variação feita. A grade lê e grava as mesmas sessões do treino:
        a progressão e o histórico usam tudo o que entrar aqui.
      </p>

      {editing && <CellEditor program={program} editing={editing} name={name(editing.row.exerciseId)} onClose={() => setEditing(null)} />}
      {confirmCycle && (
        <Sheet title={`Fechar o ciclo ${grid.cycle} e começar o ${grid.cycle + 1}?`} onClose={() => setConfirmCycle(false)}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink/85">
            <li>Primeiro baixa o backup (arquivo JSON) com tudo o que está registrado.</li>
            <li>Guarda o resumo do ciclo: tonelagem S1–S{grid.weekIndices.length} ({fmtTonKg(grid.total)}) e as cargas de cada exercício.</li>
            <li>A grade recomeça vazia na S1. As cargas de agora aparecem como “Ant.” em cada semana, com a variação %.</li>
            <li>Os treinos feitos continuam no histórico e na progressão.</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmCycle(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={async () => {
                await exportBackupFile()
                await startNewCycle(program)
                setConfirmCycle(false)
              }}
            >
              Baixar backup e iniciar
            </Button>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
