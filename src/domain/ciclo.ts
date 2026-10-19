import { allWeeks } from '../programacao/program'
import { epley } from '../programacao/progression/carga'
import type { CycleSnapshot, ExerciseRole, Program, SessionV2, SetLog } from '../programacao/types'

/**
 * Grade do ciclo (porte do CHORÃO PERFORMANCE): cada exercício do programa × semanas do ciclo.
 * A grade é uma visão das sessões: a célula resume a sessão daquele dia naquela semana do ciclo
 * atual; editar a célula reescreve as séries da sessão (ver lib/cicloStore).
 */

// ───────────────────────── números ─────────────────────────

export type CellField = 'sets' | 'reps' | 'kg' | 'rpe'

/** Limites do Chorão (normalizeData). */
export const LIMITS: Record<CellField, number> = { sets: 20, reps: 100, kg: 500, rpe: 10 }

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places

/** Saneia um valor digitado: aceita vírgula, corta no limite do campo, rejeita negativo/texto. Vazio → null. */
export function cleanNum(field: CellField, v: unknown): number | null {
  const t = String(v ?? '')
    .trim()
    .replace(',', '.')
  if (t === '') return null
  const n = parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(LIMITS[field], round(n, 2))
}

/** Tonelagem: séries × reps × kg (campos vazios contam 0). */
export const tonnage = (sets: number | null, reps: number | null, kg: number | null) => round((sets ?? 0) * (reps ?? 0) * (kg ?? 0), 2)

/** 1RM estimado (Epley); 1 rep = a própria carga. 0 sem dados. */
export function oneRm(reps: number | null, kg: number | null): number {
  if (!reps || !kg || reps <= 0 || kg <= 0) return 0
  return reps === 1 ? kg : round(epley(kg, reps), 1)
}

/** Variação % de `cur` sobre `base` (inteiro); null sem base ou sem valor. */
export function pctChange(cur: number | null | undefined, base: number | null | undefined): number | null {
  if (!cur || !base || cur <= 0 || base <= 0) return null
  return Math.round(((cur - base) / base) * 100)
}

// ───────────────────────── célula ─────────────────────────

export interface Cell {
  sets: number | null
  reps: number | null
  kg: number | null
  rpe: number | null
  /** Variação executada (o `name` de cada semana no Chorão). */
  variant: string
  /** Soma de reps × kg das séries feitas. */
  tonnage: number
  /** Todas as séries feitas com a mesma carga e reps (editar pela grade não perde informação). */
  uniform: boolean
}

export const EMPTY_CELL: Cell = { sets: null, reps: null, kg: null, rpe: null, variant: '', tonnage: 0, uniform: true }

/** Valor mais frequente (empate → maior). */
function mode(xs: number[]): number | null {
  if (!xs.length) return null
  const count = new Map<number, number>()
  for (const x of xs) count.set(x, (count.get(x) ?? 0) + 1)
  let best = xs[0]
  let n = 0
  for (const [x, c] of count) if (c > n || (c === n && x > best)) [best, n] = [x, c]
  return best
}

/** Resumo das séries feitas de um exercício da sessão. */
export function cellFromLog(e: { log: SetLog[]; variant?: string }): Cell {
  const done = e.log.filter((l) => l.done)
  const variant = e.variant ?? ''
  if (!done.length) return { ...EMPTY_CELL, variant }
  const weights = done.map((l) => l.weight).filter((x): x is number => x !== null)
  const reps = done.map((l) => l.reps).filter((x): x is number => x !== null)
  const lastRpe = [...done].reverse().find((l) => l.rpe !== null)?.rpe ?? null
  const same = (xs: (number | null)[]) => xs.every((x) => x === xs[0])
  return {
    sets: done.length,
    reps: mode(reps),
    kg: mode(weights),
    rpe: lastRpe,
    variant,
    tonnage: round(
      done.reduce((a, l) => a + (l.reps ?? 0) * (l.weight ?? 0), 0),
      2,
    ),
    uniform: same(done.map((l) => l.weight)) && same(done.map((l) => l.reps)),
  }
}

/** Séries iguais a partir da célula (RPE vai na última, como o "RPE da série" do Chorão). */
export function logFromCell(c: Pick<Cell, 'sets' | 'reps' | 'kg' | 'rpe'>): SetLog[] {
  const n = c.sets ?? 0
  return Array.from({ length: n }, (_, i) => ({ weight: c.kg, reps: c.reps, rpe: i === n - 1 ? c.rpe : null, done: true }))
}

// ───────────────────────── grade ─────────────────────────

export interface GridRow {
  dayKey: string
  groupIndex: number
  itemIndex: number
  exerciseId: string
  role: ExerciseRole
  /** Uma célula por semana do ciclo. */
  cells: Cell[]
  /** Sessão e índice do exercício nela, por semana (undefined = ainda não registrado). */
  refs: ({ sessionId: number; exIndex: number } | undefined)[]
  /** Carga da mesma semana no ciclo anterior ("Ant."). */
  prev: (number | null)[]
}

export interface GridDay {
  key: string
  name: string
  notes?: string
  rows: GridRow[]
  /** Tonelagem do dia por semana. */
  tonnage: number[]
}

export interface Grid {
  cycle: number
  weekIndices: number[]
  weekKinds: ('carga' | 'deload')[]
  days: GridDay[]
  /** Tonelagem por semana somando todos os dias. */
  weekTotals: number[]
  total: number
}

export const currentCycle = (p: Pick<Program, 'currentCycle'>) => p.currentCycle ?? 1
export const sessionCycle = (s: Pick<SessionV2, 'cycle'>) => s.cycle ?? 1

/** Sessão mais recente do (semana, dia) no ciclo atual do programa. */
function latestByWeekDay(program: Program, sessions: SessionV2[]) {
  const map = new Map<string, SessionV2>()
  for (const s of sessions) {
    if (s.programId !== program.id || sessionCycle(s) !== currentCycle(program)) continue
    const k = `${s.weekIndex}|${s.dayKey}`
    const cur = map.get(k)
    if (!cur || s.startedAt > cur.startedAt) map.set(k, s)
  }
  return map
}

/** Índice do item (grupo gi, posição ii no grupo) na lista achatada de exercícios da sessão. */
export function sessionIndexOf(s: SessionV2, gi: number, ii: number, exerciseId: string): number {
  const inGroup = s.exercises.map((e, i) => ({ e, i })).filter(({ e }) => e.groupIndex === gi)
  const hit = inGroup[ii]
  if (hit && hit.e.exerciseId === exerciseId) return hit.i
  return s.exercises.findIndex((e) => e.exerciseId === exerciseId)
}

export function buildGrid(program: Program, sessions: SessionV2[], previous?: CycleSnapshot): Grid {
  const weeks = allWeeks(program)
  const latest = latestByWeekDay(program, sessions)
  const prevKg = new Map((previous?.exercises ?? []).map((e) => [`${e.dayKey}|${e.exerciseId}`, e.kg]))
  const weekTotals = weeks.map(() => 0)

  const days: GridDay[] = weeks[0].days.map((d) => {
    const tonnageByWeek = weeks.map(() => 0)
    const rows: GridRow[] = d.groups.flatMap((g, gi) =>
      g.items.map((it, ii) => {
        const refs: GridRow['refs'] = []
        const cells = weeks.map((w, wi) => {
          const s = latest.get(`${w.index}|${d.key}`)
          const idx = s ? sessionIndexOf(s, gi, ii, it.exerciseId) : -1
          if (!s || idx < 0) {
            refs.push(undefined)
            return EMPTY_CELL
          }
          refs.push({ sessionId: s.id!, exIndex: idx })
          const cell = cellFromLog(s.exercises[idx])
          tonnageByWeek[wi] += cell.tonnage
          weekTotals[wi] += cell.tonnage
          return cell
        })
        const prev = weeks.map((_, wi) => prevKg.get(`${d.key}|${it.exerciseId}`)?.[wi] ?? null)
        return { dayKey: d.key, groupIndex: gi, itemIndex: ii, exerciseId: it.exerciseId, role: it.role, cells, refs, prev }
      }),
    )
    return { key: d.key, name: d.name, ...(d.notes ? { notes: d.notes } : {}), rows, tonnage: tonnageByWeek.map((x) => round(x, 2)) }
  })

  const totals = weekTotals.map((x) => round(x, 2))
  return {
    cycle: currentCycle(program),
    weekIndices: weeks.map((w) => w.index),
    weekKinds: weeks.map((w) => w.kind),
    days,
    weekTotals: totals,
    total: round(
      totals.reduce((a, b) => a + b, 0),
      2,
    ),
  }
}

/** Badge "↑ vs S1": carga acima da primeira semana (não é PR real). */
export const aboveFirstWeek = (row: GridRow, wi: number) => wi > 0 && (row.cells[wi].kg ?? 0) > (row.cells[0].kg ?? 0) && (row.cells[0].kg ?? 0) > 0

/** Variação da carga da semana contra a S1. */
export const deltaVsFirst = (row: GridRow, wi: number) => (wi > 0 ? pctChange(row.cells[wi].kg, row.cells[0].kg) : null)

/** Variação contra a mesma semana do ciclo anterior. */
export const deltaVsPrev = (row: GridRow, wi: number) => pctChange(row.cells[wi].kg, row.prev[wi])

// ───────────────────────── ciclos ─────────────────────────

/** Quantos ciclos fechados guardamos por programa (como o Chorão). */
export const MAX_SNAPSHOTS = 24

/** Fecha o ciclo: tonelagem por semana e a carga de cada exercício (vira o "Ant." do próximo). */
export function closeCycle(program: Program, grid: Grid, now = Date.now()): CycleSnapshot {
  return {
    programId: program.id!,
    cycle: grid.cycle,
    closedAt: now,
    weeks: grid.weekTotals,
    total: grid.total,
    exercises: grid.days.flatMap((d) => d.rows.map((r) => ({ dayKey: d.key, exerciseId: r.exerciseId, kg: r.cells.map((c) => c.kg) }))),
  }
}

/**
 * Próximo treino dentro do ciclo atual: depois da sessão concluída mais adiantada (semana, dia) —
 * não da mais recente, para que preencher uma semana antiga na grade não volte o ponteiro.
 * `cycleDone` = todas as semanas do ciclo já têm o último dia feito (hora do "Novo ciclo").
 */
export function nextInCycle(program: Program, sessions: SessionV2[]): { weekIndex: number; dayIndex: number; cycleDone: boolean } {
  const weeks = allWeeks(program)
  let best: { wi: number; di: number } | null = null
  for (const s of sessions) {
    if (s.programId !== program.id || s.status !== 'done' || sessionCycle(s) !== currentCycle(program)) continue
    const wi = weeks.findIndex((w) => w.index === s.weekIndex)
    const di = wi >= 0 ? weeks[wi].days.findIndex((d) => d.key === s.dayKey) : -1
    if (di < 0) continue
    if (!best || wi > best.wi || (wi === best.wi && di > best.di)) best = { wi, di }
  }
  if (!best) return { weekIndex: weeks[0].index, dayIndex: 0, cycleDone: false }
  if (best.di + 1 < weeks[best.wi].days.length) return { weekIndex: weeks[best.wi].index, dayIndex: best.di + 1, cycleDone: false }
  if (best.wi + 1 < weeks.length) return { weekIndex: weeks[best.wi + 1].index, dayIndex: 0, cycleDone: false }
  return { weekIndex: weeks[0].index, dayIndex: 0, cycleDone: true }
}

/** Mantém os `MAX_SNAPSHOTS` resumos mais recentes; devolve os ids a apagar. */
export const snapshotsToPrune = (snaps: CycleSnapshot[]) =>
  [...snaps]
    .sort((a, b) => a.closedAt - b.closedAt)
    .slice(0, Math.max(0, snaps.length - MAX_SNAPSHOTS))
    .map((s) => s.id!)

/** Resumo do ciclo: total do mês e variação contra o ciclo anterior. */
export function cycleSummary(grid: Grid, previous?: CycleSnapshot) {
  return {
    total: grid.total,
    previous: previous ? { total: previous.total, weeks: previous.weeks, closedAt: previous.closedAt } : null,
    pctVsPrevious: previous && grid.total > 0 ? pctChange(grid.total, previous.total) : null,
  }
}
