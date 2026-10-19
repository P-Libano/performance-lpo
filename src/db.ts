import Dexie, { type EntityTable } from 'dexie'
import type { Exercise } from './data/types'
import { migrateRoutine, migrateSession, type RoutineV1, type SessionV1 } from './programacao/migrate'
import type { CycleSnapshot, Program, SessionV2 } from './programacao/types'

export interface MetaRow {
  key: string
  value: unknown
}

export class ProgressaDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  meta!: EntityTable<MetaRow, 'key'>
  programs!: EntityTable<Program, 'id'>
  sessions!: EntityTable<SessionV2, 'id'>
  cycles!: EntityTable<CycleSnapshot, 'id'>

  constructor(name = 'progressa') {
    super(name)
    this.version(1).stores({
      exercises: 'id, bodyPart, equipment, target',
      meta: 'key',
    })
    this.version(2).stores({
      routines: '++id, createdAt',
    })
    this.version(3).stores({
      sessions: '++id, startedAt, status, *exerciseIds',
    })
    // v4: Routine → Program (com semanas), sessões com RPE/papel/prescrição. `routines` fica só como legado.
    this.version(4)
      .stores({
        programs: '++id, createdAt',
        sessions: '++id, startedAt, status, *exerciseIds, programId',
      })
      .upgrade(async (tx) => {
        const equipment = new Map<string, string>()
        await tx.table('exercises').each((e: Exercise) => equipment.set(e.id, e.equipment))
        const routines = (await tx.table('routines').toArray()) as RoutineV1[]
        await tx.table('programs').bulkPut(routines.map((r) => migrateRoutine(r, (id) => equipment.get(id))))
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: SessionV1 & Partial<SessionV2>, ref: { value: unknown }) => {
            if (s.programId === undefined) ref.value = migrateSession(s as SessionV1)
          })
        const active = await tx.table('meta').get(META_V1_ACTIVE_ROUTINE)
        if (active) {
          await tx.table('meta').put({ key: META.activeProgram, value: active.value })
          await tx.table('meta').delete(META_V1_ACTIVE_ROUTINE)
        }
      })
    // v5 (porte do Chorão): resumos de ciclos fechados; sessões ganham ciclo/origem/prontidão (campos opcionais)
    this.version(5).stores({
      cycles: '++id, programId, closedAt',
    })
  }
}

const META_V1_ACTIVE_ROUTINE = 'activeRoutine'

/** Chaves usadas na tabela meta. */
export const META = {
  catalog: 'catalog',
  profile: 'profile',
  activeProgram: 'activeProgram',
  apiKey: 'anthropicApiKey',
  /** Data (ms) do último backup exportado: aviso quando passar de 7 dias. */
  lastBackupAt: 'lastBackupAt',
} as const

export const db = new ProgressaDB()
