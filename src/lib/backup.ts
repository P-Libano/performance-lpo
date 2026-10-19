import { MUSCLE_GROUPS } from '../data/curated'
import { LPO_BY_ID } from '../data/lpo'
import type { Exercise } from '../data/types'
import { META, db } from '../db'
import type { EquipmentLookup } from '../programacao/generator'
import { migrateRoutine, migrateSession, type RoutineV1, type SessionV1 } from '../programacao/migrate'
import { GOAL_IDS, type BackupV2, type Program, type SessionV2 } from '../programacao/types'
import { z } from './zod'

/**
 * Backup dos dados do usuário: perfil, programas e sessões.
 * Fica de fora o catálogo (é rebaixado do CDN) e a chave da API (segredo local).
 * Formato 2 (atual). O formato 1 (rotinas sem semanas) é aceito e migrado.
 */

export const BACKUP_FORMAT = 2

const group = z.enum(MUSCLE_GROUPS)
const num = z.number().finite()
const range = z.object({ min: num, max: num })
const role = z.enum(['principal', 'composto', 'isolador', 'condicionamento'])

const profileSchema = z.object({
  goal: z.enum(GOAL_IDS),
  daysPerWeek: z.number().int().min(2).max(6),
  split: z.enum(['AB', 'ABC', 'ABCD', 'upper_lower', 'full_body']),
  equipment: z.enum(['academia', 'halteres', 'peso_corporal']),
  level: z.enum(['iniciante', 'intermediario', 'avancado']),
  pullupBar: z.boolean().optional(),
})

const prescription = z.object({
  exerciseId: z.string(),
  role,
  group,
  sets: z.number().int().min(1).max(12),
  reps: range.optional(),
  restSec: z.number().int().min(0),
  pct1rm: range.optional(),
  rpe: range.optional(),
  workSec: z.number().int().optional(),
  startKg: num.optional(),
})

const programSchema = z.object({
  id: z.number().int(),
  createdAt: num,
  source: z.enum(['local', 'ia', 'template']),
  templateName: z.string().optional(),
  currentCycle: z.number().int().min(1).optional(),
  profile: profileSchema,
  // o snapshot do objetivo é conferido só no essencial; o resto vem do próprio app
  goal: z.looseObject({ id: z.enum(GOAL_IDS), nome: z.string() }),
  blocks: z.array(
    z.object({
      index: z.number().int(),
      weeks: z.array(
        z.object({
          index: z.number().int(),
          kind: z.enum(['carga', 'deload']),
          intensityTarget: num.optional(),
          days: z.array(
            z.object({
              key: z.string(),
              name: z.string(),
              notes: z.string().optional(),
              groups: z.array(
                z.object({
                  kind: z.enum(['simples', 'superset', 'circuito', 'finisher']),
                  items: z.array(prescription).min(1),
                  rounds: z.number().int().optional(),
                  restBetweenSec: num.optional(),
                  restAfterSec: num.optional(),
                  durationMin: num.optional(),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
  repeat: z.boolean(),
  weeklyVolume: z.record(z.string(), num),
  explanation: z.string(),
  warnings: z.array(z.string()),
  notes: z.string().optional(),
})

const resultSchema = z.object({
  date: num,
  weekKind: z.enum(['carga', 'deload']),
  prescription,
  sets: z.array(z.object({ weight: num, reps: num, rpe: num.nullable(), restBeforeSec: num.nullable() })),
})

const sessionSchema = z.object({
  id: z.number().int(),
  programId: z.number().int(),
  weekIndex: z.number().int(),
  weekKind: z.enum(['carga', 'deload']),
  dayKey: z.string(),
  dayName: z.string(),
  startedAt: num,
  finishedAt: num.optional(),
  durationSec: num.optional(),
  status: z.enum(['active', 'done']),
  exerciseIds: z.array(z.string()),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      role,
      group,
      groupIndex: z.number().int(),
      groupKind: z.enum(['simples', 'superset', 'circuito', 'finisher']),
      prescription,
      suggestion: z.object({
        kind: z.enum(['start', 'increase', 'keep', 'decrease', 'deload', 'less_rest', 'add_set', 'more_reps']),
        weight: num.nullable(),
        restSec: num.optional(),
        sets: z.number().int().optional(),
        reps: range.optional(),
        failStreak: z.number().int(),
        reason: z.string(),
        beforeReadiness: num.optional(),
      }),
      previous: resultSchema.optional(),
      recent: z.array(resultSchema).optional(),
      log: z.array(z.object({ weight: num.nullable(), reps: num.nullable(), rpe: num.nullable(), done: z.boolean(), completedAt: num.optional() })),
      variant: z.string().optional(),
    }),
  ),
  restUntil: num.optional(),
  restTotal: num.optional(),
  restPausedLeft: num.optional(),
  cycle: z.number().int().min(1).optional(),
  origin: z.enum(['sessao', 'grade', 'chorao']).optional(),
  readiness: z.object({ sleep: z.number().int().min(1).max(5), energy: z.number().int().min(1).max(5), soreness: z.number().int().min(1).max(5) }).optional(),
  notes: z.string().optional(),
})

export const backupSchema = z.object({
  app: z.literal('progressa'),
  format: z.literal(2),
  exportedAt: z.string(),
  profile: profileSchema.nullable(),
  activeProgramId: z.number().int().nullable(),
  programs: z.array(programSchema),
  sessions: z.array(sessionSchema),
  // opcionais (porte do Chorão): backups antigos não têm
  cycles: z
    .array(
      z.object({
        id: z.number().int(),
        programId: z.number().int(),
        cycle: z.number().int().min(1),
        closedAt: num,
        weeks: z.array(num),
        total: num,
        exercises: z.array(z.object({ dayKey: z.string(), exerciseId: z.string(), kg: z.array(num.nullable()) })),
      }),
    )
    .optional(),
  // exercícios criados no app (importação do Chorão); os LPO fixos o app recria sozinho
  customExercises: z.array(z.looseObject({ id: z.string(), name: z.string(), source: z.literal('custom') })).optional(),
})

// ── formato 1 (só para importar backups antigos) ──
const v1Exercise = z.object({
  exerciseId: z.string(),
  group,
  compound: z.boolean(),
  sets: z.number().int().min(1).max(10),
  repMin: z.number().int().min(1),
  repMax: z.number().int().min(1),
  restSec: z.number().int().min(0),
})
const v1Result = z.object({ date: num, sets: z.array(z.object({ weight: num, reps: num })) })
const backupSchemaV1 = z.object({
  app: z.literal('progressa'),
  format: z.literal(1),
  exportedAt: z.string(),
  profile: profileSchema.nullable(),
  activeRoutineId: z.number().int().nullable(),
  routines: z.array(
    z.object({
      id: z.number().int(),
      createdAt: num,
      source: z.enum(['local', 'ia']),
      profile: profileSchema,
      days: z.array(z.object({ key: z.string(), name: z.string(), exercises: z.array(v1Exercise) })),
      schedule: z.array(z.string()),
      warnings: z.array(z.string()),
      notes: z.string().optional(),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.number().int(),
      routineId: z.number().int(),
      dayKey: z.string(),
      dayName: z.string(),
      startedAt: num,
      finishedAt: num.optional(),
      status: z.enum(['active', 'done']),
      exerciseIds: z.array(z.string()),
      exercises: z.array(
        v1Exercise.extend({
          suggestion: z.object({ kind: z.string(), weight: num.nullable(), failStreak: z.number().int(), reason: z.string() }),
          previous: v1Result.optional(),
          recent: z.array(v1Result).optional(),
          log: z.array(z.object({ weight: num.nullable(), reps: num.nullable(), done: z.boolean() })),
        }),
      ),
      restUntil: num.optional(),
      restTotal: num.optional(),
    }),
  ),
})

export type Backup = BackupV2

export async function exportData(now = new Date()): Promise<Backup> {
  const [profile, active, programs, sessions, cycles, custom] = await Promise.all([
    db.meta.get(META.profile),
    db.meta.get(META.activeProgram),
    db.programs.toArray(),
    db.sessions.toArray(),
    db.cycles.toArray(),
    db.exercises.filter((e) => e.source === 'custom' && !LPO_BY_ID.has(e.id)).toArray(),
  ])
  return {
    app: 'progressa',
    format: 2,
    exportedAt: now.toISOString(),
    profile: (profile?.value as Backup['profile']) ?? null,
    activeProgramId: (active?.value as number | undefined) ?? null,
    programs,
    sessions,
    cycles,
    customExercises: custom,
  }
}

/** Exporta, baixa o arquivo e registra a data (aviso de backup com mais de 7 dias). */
export async function exportBackupFile(now = new Date()): Promise<Backup> {
  const data = await exportData(now)
  downloadJson(data, `progressa-backup-${data.exportedAt.slice(0, 10)}.json`)
  await db.meta.put({ key: META.lastBackupAt, value: now.getTime() })
  return data
}

/** Dias desde o último backup (null = nunca). */
export async function daysSinceBackup(now = Date.now()): Promise<number | null> {
  const last = (await db.meta.get(META.lastBackupAt))?.value as number | undefined
  return last ? Math.floor((now - last) / 864e5) : null
}

export class BackupError extends Error {}

const issueText = (e: z.ZodError) => {
  const issue = e.issues[0]
  return `Backup inválido em "${issue.path.map(String).join('.') || 'raiz'}": ${issue.message}`
}

/** Valida o JSON (formato 1 ou 2) e devolve sempre o formato 2. Mensagens amigáveis em pt-BR. */
export function parseBackup(text: string, equipmentOf: EquipmentLookup = () => undefined): Backup & { migratedFrom?: 1 } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('O arquivo não é um JSON válido.')
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'progressa') {
    throw new BackupError('Este arquivo não é um backup do Progressa.')
  }
  const format = (raw as { format?: unknown }).format
  if (format === 1) {
    const v1 = backupSchemaV1.safeParse(raw)
    if (!v1.success) throw new BackupError(issueText(v1.error))
    const b = v1.data
    return {
      app: 'progressa',
      format: 2,
      exportedAt: b.exportedAt,
      profile: b.profile,
      activeProgramId: b.activeRoutineId,
      programs: b.routines.map((r) => migrateRoutine(r as RoutineV1, equipmentOf)),
      sessions: b.sessions.map((s) => migrateSession(s as SessionV1)),
      migratedFrom: 1,
    }
  }
  if (format !== BACKUP_FORMAT) {
    throw new BackupError(`Versão de backup não suportada (o app lê os formatos 1 e ${BACKUP_FORMAT}).`)
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) throw new BackupError(issueText(parsed.error))
  return parsed.data as unknown as Backup
}

/** Substitui perfil, programas e sessões pelos do backup (o catálogo e a chave da API ficam). */
export async function importData(b: Backup): Promise<{ programs: number; sessions: number }> {
  await db.transaction('rw', [db.meta, db.programs, db.sessions, db.cycles, db.exercises], async () => {
    await db.programs.clear()
    await db.sessions.clear()
    await db.cycles.clear()
    await db.meta.bulkDelete([META.profile, META.activeProgram])
    await db.programs.bulkPut(b.programs as Program[])
    await db.sessions.bulkPut(b.sessions as SessionV2[])
    if (b.cycles) await db.cycles.bulkPut(b.cycles)
    if (b.customExercises) await db.exercises.bulkPut(b.customExercises as unknown as Exercise[])
    if (b.profile) await db.meta.put({ key: META.profile, value: b.profile })
    if (b.activeProgramId !== null) await db.meta.put({ key: META.activeProgram, value: b.activeProgramId })
  })
  return { programs: b.programs.length, sessions: b.sessions.length }
}

/** Apaga dados do usuário (mantém o catálogo baixado e a chave da API). */
export async function wipeUserData() {
  await db.transaction('rw', db.meta, db.programs, db.sessions, db.cycles, async () => {
    await db.programs.clear()
    await db.sessions.clear()
    await db.cycles.clear()
    await db.meta.bulkDelete([META.profile, META.activeProgram])
  })
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
