import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { META, ProgressaDB, db } from '../../src/db'
import { buildSession } from '../../src/domain/session'
import { exportData, importData, parseBackup } from '../../src/lib/backup'
import type { RoutineV1, SessionV1 } from '../../src/programacao/migrate'
import { allWeeks, nextPosition } from '../../src/programacao/program'
import { catalog, equipmentOf } from './helpers'

const profile = { goal: 'hipertrofia', daysPerWeek: 4, split: 'AB', equipment: 'academia', level: 'intermediario' } as const

const ex = (exerciseId: string, group: string, compound: boolean) => ({ exerciseId, group, compound, sets: compound ? 4 : 3, repMin: 8, repMax: 12, restSec: compound ? 120 : 75 })
const routineV1: RoutineV1 = {
  id: 7,
  createdAt: 1_000,
  source: 'local',
  profile: { ...profile },
  days: [
    { key: 'A', name: 'Treino A — Empurrar + quadríceps', exercises: [ex('0043', 'quadriceps', true), ex('0025', 'peito', true), ex('0091', 'ombros', true), ex('0201', 'triceps', false)] as RoutineV1['days'][0]['exercises'] },
    { key: 'B', name: 'Treino B — Puxar + posteriores', exercises: [ex('0085', 'posteriores', true), ex('2330', 'costas', true), ex('0027', 'costas', true), ex('0031', 'biceps', false)] as RoutineV1['days'][0]['exercises'] },
  ],
  schedule: ['A', 'B', 'A', 'B'],
  warnings: [],
}
const sessionV1: SessionV1 = {
  id: 3,
  routineId: 7,
  dayKey: 'A',
  dayName: 'Treino A — Empurrar + quadríceps',
  startedAt: 2_000,
  finishedAt: 2_000 + 3_600_000,
  status: 'done',
  exerciseIds: ['0043', '0025', '0091', '0201'],
  exercises: routineV1.days[0].exercises.map((e) => ({
    ...e,
    suggestion: { kind: 'start', weight: null, failStreak: 0, reason: 'Primeira vez' },
    log: [12, 12, 12, 12].slice(0, e.sets).map((reps) => ({ weight: 60, reps, done: true })),
  })),
}

describe('migração v3 → v4 do IndexedDB', () => {
  it('rotina vira programa, sessões ganham RPE/papel/prescrição, rotina ativa vira programa ativo', async () => {
    const name = 'progressa-migracao-teste'
    const old = new Dexie(name)
    old.version(1).stores({ exercises: 'id, bodyPart, equipment, target', meta: 'key' })
    old.version(2).stores({ routines: '++id, createdAt' })
    old.version(3).stores({ sessions: '++id, startedAt, status, *exerciseIds' })
    await old.open()
    await old.table('exercises').bulkPut(catalog)
    await old.table('routines').put(routineV1)
    await old.table('sessions').put(sessionV1)
    await old.table('meta').bulkPut([
      { key: 'profile', value: routineV1.profile },
      { key: 'activeRoutine', value: 7 },
    ])
    old.close()

    const db4 = new ProgressaDB(name)
    await db4.open()
    const programs = await db4.programs.toArray()
    const sessions = await db4.sessions.toArray()
    const active = await db4.meta.get(META.activeProgram)
    const p = programs[0]
    const s = sessions[0]
    console.log(
      'migrado:',
      JSON.stringify({
        versao: db4.verno,
        programa: { id: p.id, goal: p.goal.id, semanas: allWeeks(p).length, dias: allWeeks(p)[0].days.map((d) => d.key) },
        sessao: { id: s.id, programId: s.programId, dayKey: s.dayKey, weekKind: s.weekKind, durationSec: s.durationSec, set1: s.exercises[0].log[0], papel: s.exercises[0].role },
        ativo: active?.value,
      }),
    )
    // passa pela v4 (esta migração) e chega à atual (v5: tabela de ciclos)
    expect(db4.verno).toBe(5)
    expect(await db4.cycles.count()).toBe(0)
    expect(p.id).toBe(7)
    expect(allWeeks(p)[0].days.map((d) => d.key)).toEqual(['A1', 'B1', 'A2', 'B2'])
    expect(p.explanation.length).toBeGreaterThan(50)
    expect(s).toMatchObject({ programId: 7, dayKey: 'A1', weekIndex: 1, weekKind: 'carga', durationSec: 3600 })
    expect(s.exercises[0].log[0]).toEqual({ weight: 60, reps: 12, rpe: null, done: true })
    expect(s.exercises[0].prescription).toMatchObject({ reps: { min: 8, max: 12 }, sets: 4 })
    expect(active?.value).toBe(7)
    expect(await db4.meta.get('activeRoutine')).toBeUndefined()

    // o programa migrado funciona: próximo treino é B1 e a sessão nova usa o histórico antigo
    expect(nextPosition(p, s)).toEqual({ weekIndex: 1, dayIndex: 1 })
    const next = buildSession(p, 1, 'A2', sessions, (id) => equipmentOf(id) === 'body weight', 10_000)
    const squat = next.exercises.find((e) => e.exerciseId === '0043')!
    console.log('nova sessão A2, agachamento:', squat.suggestion.kind, squat.suggestion.weight, `"${squat.suggestion.reason}"`)
    expect(squat.suggestion).toMatchObject({ kind: 'increase', weight: 65 })
    db4.close()
  })
})

describe('backup: formato 1 → 2 e ida e volta', () => {
  const v1 = JSON.stringify({
    app: 'progressa',
    format: 1,
    exportedAt: '2026-10-14T12:00:00.000Z',
    profile: routineV1.profile,
    activeRoutineId: 7,
    routines: [routineV1],
    sessions: [sessionV1],
  })

  it('importa backup v1, exporta v2, reimporta e fica igual', async () => {
    await db.exercises.bulkPut(catalog)
    const parsedV1 = parseBackup(v1, equipmentOf)
    expect(parsedV1.migratedFrom).toBe(1)
    await importData(parsedV1)
    const export1 = await exportData(new Date('2026-10-15T10:00:00Z'))
    const text = JSON.stringify(export1)
    console.log(`v1 → import → export v2: ${text.length} bytes; programas=${export1.programs.length}, sessões=${export1.sessions.length}`)

    await importData(parseBackup(text))
    const export2 = await exportData(new Date('2026-10-15T10:00:00Z'))
    expect(export2).toEqual(export1)
    expect(export2.format).toBe(3) // formato atual (porte do Chorão)
    expect(export2.sessions[0].exercises[0].log[0].rpe).toBeNull()
  })

  it('rejeita formato desconhecido e v1 inválido com mensagem amigável', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'progressa', format: 9 }))).toThrow('lê os formatos 1 a 3')
    const bad = JSON.parse(v1)
    bad.sessions[0].exercises[0].log[0].reps = 'doze'
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/sessions\.0\.exercises\.0\.log\.0\.reps/)
  })
})
