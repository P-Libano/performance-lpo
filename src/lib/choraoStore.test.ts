import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { LPO_EXERCISES } from '../data/lpo'
import { META, ProgressaDB } from '../db'
import { buildGrid } from '../domain/ciclo'
import { isChoraoBackup, normalizeChorao } from '../programacao/choraoImport'
import { BACKUP_FORMAT, exportData, parseBackup } from './backup'
import { previousSnapshot } from './cicloStore'
import { ChoraoImportError, importChorao } from './choraoStore'
import { getActiveProgram, saveProfileAndGenerate } from './programStore'

const db = new ProgressaDB('progressa')

const week = (name = '', set = '', rep = '', kg = '', rpe = '') => ({ name, set, rep, kg, rpe })
const empty = () => week()

/** Backup do Chorão no formato real (strings, como o localStorage dele grava), sem a quarta. */
const CHORAO_FILE = {
  SEG: {
    name: 'Segunda-feira — Snatch Suspenso & Inferiores',
    notes: 'LPO + perna.',
    readiness: { sleep: '2', energy: '3', soreness: '4' },
    exercises: [
      { baseName: 'Snatch Suspenso', isMain: true, weeks: [week('Snatch Suspenso', '5', '2', '40', '7'), week('Snatch bloco', '5', '2', '42,5', '8'), empty(), empty()], prev: ['37.5', '40', '', ''] },
      { baseName: 'Búlgaro', weeks: [week('Búlgaro (kg por mão)', '3', '8', '12', ''), empty(), empty(), empty()] },
      { baseName: 'Arremesso de Medicine Ball', isMain: false, weeks: [week('', '', '', '6', ''), empty(), empty(), empty()] },
    ],
  },
  TER: { name: 'Terça-feira — Clean', notes: '', exercises: [{ baseName: 'Clean do Chão', isMain: true, weeks: [week('', '5', '1', '72.5', '9'), empty(), empty(), empty()] }] },
  QUI: { name: 'Quinta-feira', notes: '', exercises: [] },
  SEX: { name: 'Sexta-feira', notes: '', exercises: [{ baseName: 'Rosca Direta', weeks: [week('', '3', '8', '999', '12'), empty(), empty(), empty()] }] },
}

beforeAll(async () => {
  await db.exercises.bulkPut([...loadFixtureCatalog(), ...LPO_EXERCISES])
  // dados que já existiam no Progressa
  await saveProfileAndGenerate({ split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'academia', level: 'intermediario' })
})

describe('backup do Chorão', () => {
  it('reconhece o formato (com ou sem a quarta) e recusa outros JSON', () => {
    expect(isChoraoBackup(CHORAO_FILE)).toBe(true)
    expect(isChoraoBackup({ app: 'progressa', format: 3 })).toBe(false)
    expect(isChoraoBackup({ SEG: { exercises: [] } })).toBe(false)
  })

  it('normaliza como o Chorão: vírgula, limites, isMain pelo nome, quarta vazia', () => {
    const days = normalizeChorao(CHORAO_FILE)!
    expect(days.map((d) => d.key)).toEqual(['SEG', 'TER', 'QUA', 'QUI', 'SEX'])
    expect(days[2].exercises).toEqual([])
    expect(days[0].exercises[0].weeks[1]).toEqual({ name: 'Snatch bloco', set: 5, rep: 2, kg: 42.5, rpe: 8 })
    expect(days[0].exercises[0].prev).toEqual([37.5, 40, null, null])
    expect(days[0].exercises[1].isMain).toBe(false)
    expect(days[4].exercises[0].weeks[0]).toMatchObject({ kg: 500, rpe: 10 })
    expect(days[0].readiness).toEqual({ sleep: 2, energy: 3, soreness: 4 })
  })

  it('importa como programa novo e ativo, sem apagar o que existia', async () => {
    const before = await db.programs.count()
    const r = await importChorao(CHORAO_FILE, Date.UTC(2026, 9, 18))
    expect(await db.programs.count()).toBe(before + 1)
    expect(r).toMatchObject({ sessions: 4, exercises: 5, created: ['Arremesso de Medicine Ball'], hasPrevious: true })

    const p = (await getActiveProgram())!
    expect(p.id).toBe(r.programId)
    expect(p.source).toBe('template')
    expect(p.currentCycle).toBe(2)
    expect(p.blocks[0].weeks[0].days.map((d) => d.key)).toEqual(['SEG', 'TER', 'SEX'])
    expect(p.blocks[0].weeks[0].days[0].notes).toBe('LPO + perna.')
    expect(await db.exercises.get('custom-arremesso-medicine-ball')).toMatchObject({ source: 'custom', namePt: 'Arremesso de Medicine Ball' })
  })

  it('as células do Chorão aparecem iguais na grade, com variação, RPE e "Ant."', async () => {
    const p = (await getActiveProgram())!
    const g = buildGrid(p, await db.sessions.toArray(), await previousSnapshot(p))
    const [snatch, bulgaro, medicine] = g.days[0].rows
    expect(snatch.exerciseId).toBe('lpo-snatch-suspenso')
    expect(snatch.cells.slice(0, 2).map((c) => [c.sets, c.reps, c.kg, c.rpe, c.variant])).toEqual([
      [5, 2, 40, 7, ''],
      [5, 2, 42.5, 8, 'Snatch bloco'],
    ])
    expect(snatch.prev).toEqual([37.5, 40, null, null])
    expect(bulgaro).toMatchObject({ exerciseId: '0410' })
    expect(bulgaro.cells[0]).toMatchObject({ sets: 3, reps: 8, kg: 12, variant: 'Búlgaro (kg por mão)', tonnage: 288 })
    // carga sem nº de séries: assume as séries planejadas para a carga não sumir
    expect(medicine.cells[0]).toMatchObject({ sets: 3, reps: null, kg: 6, tonnage: 0 })
    expect(g.weekTotals[0]).toBe(5 * 2 * 40 + 288 + 5 * 72.5 + 3 * 8 * 500)
  })

  it('a prontidão do dia vai na semana mais recente, e o histórico fica em ordem', async () => {
    const seg = (await db.sessions.filter((s) => s.dayKey === 'SEG').toArray()).sort((a, b) => a.weekIndex - b.weekIndex)
    expect(seg.map((s) => s.readiness)).toEqual([undefined, { sleep: 2, energy: 3, soreness: 4 }])
    expect(seg[0].startedAt).toBeLessThan(seg[1].startedAt)
    expect(seg.every((s) => s.origin === 'chorao' && s.status === 'done' && s.cycle === 2)).toBe(true)
  })

  it('o backup do Progressa (formato 3) leva o programa importado e o exercício criado', async () => {
    const b = await exportData()
    expect(b.format).toBe(BACKUP_FORMAT)
    expect(b.format).toBe(3)
    expect(b.customExercises).toEqual([expect.objectContaining({ id: 'custom-arremesso-medicine-ball' })])
    expect(b.cycles).toHaveLength(1)
    const back = parseBackup(JSON.stringify(b))
    expect(back.sessions).toHaveLength(4)
    // formato 2 (antes do porte) continua aceito
    expect(parseBackup(JSON.stringify({ ...b, format: 2, cycles: undefined, customExercises: undefined })).programs).toHaveLength(2)
  })

  it('recusa arquivo que não é do Chorão ou sem exercícios', async () => {
    await expect(importChorao({ foo: 1 })).rejects.toBeInstanceOf(ChoraoImportError)
    const vazio = Object.fromEntries(['SEG', 'TER', 'QUI', 'SEX'].map((k) => [k, { exercises: [] }]))
    await expect(importChorao(vazio)).rejects.toThrow(/nenhum exercício/)
    expect((await db.meta.get(META.activeProgram))?.value).toBeDefined()
  })
})
