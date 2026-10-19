import { describe, expect, it } from 'vitest'
import { programFromDays } from '../programacao/program'
import type { SessionV2, SetLog } from '../programacao/types'
import {
  EMPTY_CELL,
  aboveFirstWeek,
  buildGrid,
  cellFromLog,
  cleanNum,
  closeCycle,
  cycleSummary,
  deltaVsFirst,
  deltaVsPrev,
  logFromCell,
  oneRm,
  pctChange,
  tonnage,
} from './ciclo'

describe('cleanNum (normalizeData do Chorão)', () => {
  it('aceita vírgula decimal e arredonda em 2 casas', () => {
    expect(cleanNum('kg', '72,5')).toBe(72.5)
    expect(cleanNum('kg', '62.555')).toBe(62.56)
    expect(cleanNum('kg', ' 40 ')).toBe(40)
  })
  it('corta nos limites: séries ≤ 20, reps ≤ 100, kg ≤ 500, RPE ≤ 10', () => {
    expect(cleanNum('sets', 35)).toBe(20)
    expect(cleanNum('reps', '150')).toBe(100)
    expect(cleanNum('kg', '999')).toBe(500)
    expect(cleanNum('rpe', '11')).toBe(10)
  })
  it('vazio, texto e negativo viram null', () => {
    expect(cleanNum('kg', '')).toBeNull()
    expect(cleanNum('kg', null)).toBeNull()
    expect(cleanNum('kg', 'abc')).toBeNull()
    expect(cleanNum('kg', '-5')).toBeNull()
  })
  it('como o parseFloat do Chorão, ignora sufixo ("8 reps" → 8)', () => {
    expect(cleanNum('reps', '8 reps')).toBe(8)
  })
})

describe('tonelagem e 1RM', () => {
  it('séries × reps × kg', () => {
    expect(tonnage(3, 8, 80)).toBe(1920)
    expect(tonnage(5, 3, 72.5)).toBe(1087.5)
  })
  it('campo vazio conta 0 (LPO sem reps não soma)', () => {
    expect(tonnage(5, null, 40)).toBe(0)
    expect(tonnage(null, null, null)).toBe(0)
  })
  it('Epley kg × (1 + reps/30), 1 casa', () => {
    expect(oneRm(8, 80)).toBe(101.3)
    expect(oneRm(5, 100)).toBe(116.7)
  })
  it('1 rep devolve a própria carga; sem dados, 0', () => {
    expect(oneRm(1, 140)).toBe(140)
    expect(oneRm(0, 100)).toBe(0)
    expect(oneRm(5, null)).toBe(0)
  })
  it('variação % inteira; sem base, null', () => {
    expect(pctChange(85, 80)).toBe(6)
    expect(pctChange(76, 80)).toBe(-5)
    expect(pctChange(80, 0)).toBeNull()
    expect(pctChange(0, 80)).toBeNull()
  })
})

const set = (weight: number | null, reps: number | null, rpe: number | null = null, done = true): SetLog => ({ weight, reps, rpe, done })

describe('célula ↔ séries', () => {
  it('resume as séries feitas: carga e reps mais frequentes, RPE da última série com RPE', () => {
    const c = cellFromLog({ log: [set(80, 8), set(80, 8, 8), set(80, 7, 9), set(80, null, null, false)], variant: 'pausa 2s' })
    expect(c).toEqual({ sets: 3, reps: 8, kg: 80, rpe: 9, variant: 'pausa 2s', tonnage: 80 * 23, uniform: false })
  })
  it('sem série feita = célula vazia', () => {
    expect(cellFromLog({ log: [set(80, null, null, false)] })).toEqual(EMPTY_CELL)
  })
  it('LPO sem reps: conta as séries e a carga, tonelagem 0', () => {
    const c = cellFromLog({ log: [set(40, null), set(40, null), set(40, null)] })
    expect([c.sets, c.reps, c.kg, c.tonnage]).toEqual([3, null, 40, 0])
  })
  it('célula → séries iguais, RPE só na última; ida e volta preserva a célula', () => {
    const log = logFromCell({ sets: 3, reps: 8, kg: 80, rpe: 8 })
    expect(log).toEqual([set(80, 8), set(80, 8), set(80, 8, 8)])
    expect(cellFromLog({ log })).toMatchObject({ sets: 3, reps: 8, kg: 80, rpe: 8, tonnage: 1920, uniform: true })
    expect(logFromCell({ sets: null, reps: 8, kg: 80, rpe: null })).toEqual([])
  })
})

// programa de 2 dias, 4 semanas (força + hipertrofia: 3 de carga + deload)
const program = {
  ...programFromDays(
    { goal: 'powerbuilding', daysPerWeek: 2, split: 'AB', equipment: 'academia', level: 'intermediario' },
    [
      { key: 'A1', name: 'A', exercises: [{ exerciseId: '0043', sets: 3, repMin: 8, repMax: 8, restSec: 120 }, { exerciseId: '0025', sets: 3, repMin: 8, repMax: 8, restSec: 120 }] },
      { key: 'B1', name: 'B', exercises: [{ exerciseId: '0032', sets: 3, repMin: 5, repMax: 5, restSec: 180 }] },
    ],
    () => 'barbell',
    { source: 'local', now: 0 },
  ),
  id: 7,
}

let nextId = 1
function session(weekIndex: number, dayKey: string, logs: SetLog[][], extra: Partial<SessionV2> = {}): SessionV2 {
  const day = program.blocks[0].weeks.find((w) => w.index === weekIndex)!.days.find((d) => d.key === dayKey)!
  const items = day.groups.flatMap((g, gi) => g.items.map((it) => ({ it, gi })))
  return {
    id: nextId++,
    programId: 7,
    weekIndex,
    weekKind: 'carga',
    dayKey,
    dayName: day.name,
    startedAt: weekIndex * 1000,
    status: 'done',
    exerciseIds: items.map(({ it }) => it.exerciseId),
    exercises: items.map(({ it, gi }, i) => ({
      exerciseId: it.exerciseId,
      role: it.role,
      group: it.group,
      groupIndex: gi,
      groupKind: 'simples',
      prescription: it,
      suggestion: { kind: 'start', weight: null, failStreak: 0, reason: '' },
      log: logs[i] ?? [],
    })),
    ...extra,
  }
}

const sessions = [
  session(1, 'A1', [logFromCell({ sets: 3, reps: 8, kg: 100, rpe: 7 }), logFromCell({ sets: 3, reps: 8, kg: 80, rpe: 8 })]),
  session(2, 'A1', [logFromCell({ sets: 3, reps: 8, kg: 105, rpe: 8 }), logFromCell({ sets: 3, reps: 8, kg: 76, rpe: 8 })]),
  session(1, 'B1', [logFromCell({ sets: 3, reps: 5, kg: 140, rpe: 8 })]),
  // outro ciclo e outro programa não entram
  session(3, 'A1', [logFromCell({ sets: 3, reps: 8, kg: 999, rpe: 8 })], { cycle: 2 }),
  session(3, 'B1', [logFromCell({ sets: 3, reps: 5, kg: 999, rpe: 8 })], { programId: 99 }),
]

describe('grade do ciclo', () => {
  const grid = buildGrid(program, sessions)

  it('uma linha por exercício e uma célula por semana do ciclo', () => {
    expect(grid.weekIndices).toEqual([1, 2, 3, 4])
    expect(grid.weekKinds).toEqual(['carga', 'carga', 'carga', 'deload'])
    expect(grid.days.map((d) => d.rows.map((r) => r.exerciseId))).toEqual([['0043', '0025'], ['0032']])
    const agach = grid.days[0].rows[0]
    expect(agach.cells.map((c) => c.kg)).toEqual([100, 105, null, null])
    expect(agach.refs[0]).toEqual({ sessionId: 1, exIndex: 0 })
    expect(agach.refs[2]).toBeUndefined()
  })

  it('tonelagem por célula, por dia e por semana (somando todos os dias)', () => {
    expect(grid.days[0].rows[0].cells[0].tonnage).toBe(2400)
    expect(grid.days[0].tonnage).toEqual([2400 + 1920, 2520 + 1824, 0, 0])
    expect(grid.days[1].tonnage).toEqual([2100, 0, 0, 0])
    expect(grid.weekTotals).toEqual([6420, 4344, 0, 0])
    expect(grid.total).toBe(10764)
  })

  it('deltas contra a S1 e badge "↑ vs S1"', () => {
    const [agach, supino] = grid.days[0].rows
    expect(deltaVsFirst(agach, 1)).toBe(5)
    expect(aboveFirstWeek(agach, 1)).toBe(true)
    expect(deltaVsFirst(supino, 1)).toBe(-5)
    expect(aboveFirstWeek(supino, 1)).toBe(false)
    expect(deltaVsFirst(agach, 0)).toBeNull()
    expect(aboveFirstWeek(agach, 2)).toBe(false)
  })

  it('novo ciclo: o resumo guarda tonelagem e cargas, que viram o "Ant." do ciclo seguinte', () => {
    const snap = closeCycle(program, grid, 5_000)
    expect(snap).toMatchObject({ programId: 7, cycle: 1, closedAt: 5_000, weeks: [6420, 4344, 0, 0], total: 10764 })
    expect(snap.exercises[0]).toEqual({ dayKey: 'A1', exerciseId: '0043', kg: [100, 105, null, null] })

    const next = { ...program, currentCycle: 2 }
    const g2 = buildGrid(next, sessions, snap)
    // só a sessão do ciclo 2 aparece; as cargas do ciclo 1 ficam como referência, com zero de kg/RPE no novo
    expect(g2.days[0].rows[0].cells.map((c) => c.kg)).toEqual([null, null, 999, null])
    expect(g2.days[0].rows[0].prev).toEqual([100, 105, null, null])
    expect(g2.days[0].rows[1].cells.every((c) => c.kg === null && c.rpe === null)).toBe(true)
    expect(deltaVsPrev(g2.days[0].rows[0], 2)).toBeNull()
    expect(deltaVsPrev({ ...g2.days[0].rows[0], prev: [100, 105, 900, null] }, 2)).toBe(11)

    const sum = cycleSummary(g2, snap)
    expect(sum.previous?.total).toBe(10764)
    expect(sum.pctVsPrevious).toBe(pctChange(g2.total, 10764))
  })
})
