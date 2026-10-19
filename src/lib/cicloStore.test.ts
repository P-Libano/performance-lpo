import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { LPO_EXERCISES } from '../data/lpo'
import { ProgressaDB } from '../db'
import { buildGrid } from '../domain/ciclo'
import type { Program } from '../programacao/types'
import { setCell } from './cicloStore'
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
