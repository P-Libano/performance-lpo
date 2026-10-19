import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { LPO_EXERCISES } from '../data/lpo'
import { ProgressaDB } from '../db'
import { buildGrid, nextInCycle } from '../domain/ciclo'
import { buildSession } from '../domain/session'
import type { Program } from '../programacao/types'
import { exportData, importData, parseBackup } from './backup'
import { setCell, startNewCycle } from './cicloStore'
import { activateChoraoTemplate, getActiveProgram } from './programStore'

let program: Program
const db = new ProgressaDB('progressa')

beforeAll(async () => {
  await db.exercises.bulkPut([...loadFixtureCatalog(), ...LPO_EXERCISES])
  await activateChoraoTemplate()
  program = (await getActiveProgram())!
})

const grid = async () => buildGrid(program, await db.sessions.toArray())

describe('grade do ciclo gravando nas sessões', () => {
  it('célula nova cria a sessão do dia já concluída, com origem "grade"', async () => {
    await setCell(program, 1, 'SEG', 0, 0, 'lpo-snatch-suspenso', { sets: 5, reps: 2, kg: 42.5, rpe: 8, variant: 'Snatch bloco' }, 1_000)
    const [s] = await db.sessions.toArray()
    expect(s).toMatchObject({ status: 'done', origin: 'grade', weekIndex: 1, dayKey: 'SEG', cycle: 1 })
    expect(s.exercises[0].variant).toBe('Snatch bloco')
    expect(s.exercises[1].log).toEqual([])
    const c = (await grid()).days[0].rows[0].cells[0]
    expect(c).toMatchObject({ sets: 5, reps: 2, kg: 42.5, rpe: 8, variant: 'Snatch bloco', tonnage: 425 })
  })

  it('outra célula do mesmo dia/semana entra na mesma sessão', async () => {
    await setCell(program, 1, 'SEG', 2, 0, '0116', { sets: 3, reps: 8, kg: 80, rpe: null, variant: '' })
    expect(await db.sessions.count()).toBe(1)
    const g = await grid()
    expect(g.days[0].tonnage[0]).toBe(425 + 1920)
    expect(g.weekTotals[0]).toBe(2345)
  })

  it('a progressão enxerga o que entrou pela grade', async () => {
    const [s] = await db.sessions.toArray()
    expect(s.exerciseIds).toContain('0116')
    expect(s.exercises[2].log.every((l) => l.done)).toBe(true)
  })

  it('limpar todas as células apaga a sessão criada pela grade', async () => {
    const empty = { sets: null, reps: null, kg: null, rpe: null, variant: '' }
    await setCell(program, 1, 'SEG', 0, 0, 'lpo-snatch-suspenso', empty)
    expect(await db.sessions.count()).toBe(1)
    await setCell(program, 1, 'SEG', 2, 0, '0116', empty)
    expect(await db.sessions.count()).toBe(0)
  })

  it('célula vazia sem sessão não cria nada', async () => {
    await setCell(program, 2, 'TER', 0, 0, 'lpo-clean-chao', { sets: null, reps: null, kg: null, rpe: null, variant: '' })
    expect(await db.sessions.count()).toBe(0)
  })
})

describe('novo ciclo', () => {
  it('próximo treino segue o ponto mais adiantado do ciclo, não a última edição', async () => {
    await setCell(program, 2, 'TER', 0, 0, 'lpo-clean-chao', { sets: 5, reps: 1, kg: 75, rpe: 8, variant: '' }, 2_000)
    await setCell(program, 1, 'SEG', 0, 0, 'lpo-snatch-suspenso', { sets: 5, reps: 2, kg: 40, rpe: 7, variant: '' }, 3_000)
    expect(nextInCycle(program, await db.sessions.toArray())).toEqual({ weekIndex: 2, dayIndex: 2, cycleDone: false })
  })

  it('guarda o resumo, avança o ciclo, zera a grade e mantém as cargas como "Ant."', async () => {
    const snap = await startNewCycle(program, 10_000)
    expect(snap).toMatchObject({ cycle: 1, closedAt: 10_000, weeks: [400, 375, 0, 0], total: 775 })
    const p2 = (await getActiveProgram())!
    expect(p2.currentCycle).toBe(2)
    const g = buildGrid(p2, await db.sessions.toArray(), snap)
    expect(g.total).toBe(0)
    expect(g.days[0].rows[0].prev).toEqual([40, null, null, null])
    expect(g.days[1].rows[0].prev).toEqual([null, 75, null, null])
    // histórico intacto e o ciclo novo recomeça na semana 1
    expect(await db.sessions.count()).toBe(2)
    expect(nextInCycle(p2, await db.sessions.toArray())).toEqual({ weekIndex: 1, dayIndex: 0, cycleDone: false })
    expect(buildSession(p2, 1, 'SEG', [], () => false).cycle).toBe(2)
  })

  it('guarda só os 24 ciclos mais recentes', async () => {
    let p = (await getActiveProgram())!
    for (let i = 0; i < 26; i++) {
      await startNewCycle(p, 20_000 + i)
      p = (await getActiveProgram())!
    }
    const snaps = await db.cycles.where('programId').equals(p.id!).sortBy('closedAt')
    expect(snaps).toHaveLength(24)
    expect(snaps.at(-1)!.cycle).toBe(p.currentCycle! - 1)
  })

  it('ciclo completo quando a última semana termina', () => {
    const fake = (weekIndex: number, dayKey: string) => ({ programId: program.id!, status: 'done', cycle: 1, weekIndex, dayKey }) as never
    expect(nextInCycle(program, [fake(4, 'SEX')])).toEqual({ weekIndex: 1, dayIndex: 0, cycleDone: true })
    expect(nextInCycle(program, [fake(3, 'SEX')])).toEqual({ weekIndex: 4, dayIndex: 0, cycleDone: false })
  })

  it('o backup leva os ciclos e volta igual', async () => {
    const before = await db.cycles.toArray()
    const b = parseBackup(JSON.stringify(await exportData()))
    expect(b.cycles).toHaveLength(24)
    await importData(b)
    expect(await db.cycles.toArray()).toEqual(before)
  })
})
