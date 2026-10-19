import { customId } from '../data/match'
import type { Exercise } from '../data/types'
import { cleanNum, logFromCell } from '../domain/ciclo'
import { DEFAULT_READINESS } from '../domain/readiness'
import { CHORAO_DAY_KEYS, programFromChoraoDays, resolveChoraoName, type ChoraoDayKey, type Resolved } from './chorao'
import type { CycleSnapshot, Program, Readiness, SessionExerciseV2, SessionV2 } from './types'

/**
 * Importação do backup JSON do CHORÃO PERFORMANCE (o conteúdo da chave `workout_tracker_advanced_v8`):
 * vira um programa novo (template LPO + Musculação com os exercícios dele), uma sessão concluída por
 * dia/semana preenchida e, se houver cargas "Ant.", o resumo do ciclo anterior. Não apaga nada.
 */

export const CHORAO_STORAGE_KEY = 'workout_tracker_advanced_v8'

const DAY = 24 * 60 * 60 * 1000

export interface ChoraoWeek {
  name: string
  set: number | null
  rep: number | null
  kg: number | null
  rpe: number | null
}

export interface ChoraoExercise {
  baseName: string
  isMain: boolean
  weeks: ChoraoWeek[]
  prev: (number | null)[] | null
}

export interface ChoraoDay {
  key: ChoraoDayKey
  name: string
  notes: string
  readiness: Readiness
  exercises: ChoraoExercise[]
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** Parece um backup do Chorão? (SEG…SEX com `exercises[]`; a quarta pode faltar, como no original). */
export function isChoraoBackup(raw: unknown): boolean {
  const d = obj(raw)
  return !!d && CHORAO_DAY_KEYS.filter((k) => k !== 'QUA').every((k) => Array.isArray(obj(d[k])?.exercises))
}

/** Lê o "1–5" do Chorão (strings) com fallback no padrão dele. */
const level = (v: unknown, dflt: number) => {
  const n = Math.round(Number(v))
  return n >= 1 && n <= 5 ? n : dflt
}

/** Porte do normalizeData do Chorão: 30 exercícios/dia, 4 semanas, nomes até 60, números saneados. */
export function normalizeChorao(raw: unknown): ChoraoDay[] | null {
  if (!isChoraoBackup(raw)) return null
  const d = raw as Record<string, unknown>
  const MAIN = /^(snatch suspenso|snatch do chão|hang snatch|levantamento terra|agachamento (frontal|costas)|supino reto|clean & jerk|jerk)/i
  return CHORAO_DAY_KEYS.map((key) => {
    const day = obj(d[key]) ?? {}
    const r = obj(day.readiness) ?? {}
    const exercises = (Array.isArray(day.exercises) ? day.exercises : []).slice(0, 30).map((raw): ChoraoExercise => {
      const ex = obj(raw) ?? {}
      const baseName = String(ex.baseName ?? 'Exercício').slice(0, 60)
      const weeks = [0, 1, 2, 3].map((i) => {
        const w = obj((Array.isArray(ex.weeks) ? ex.weeks : [])[i]) ?? {}
        return { name: String(w.name ?? '').slice(0, 60), set: cleanNum('sets', w.set), rep: cleanNum('reps', w.rep), kg: cleanNum('kg', w.kg), rpe: cleanNum('rpe', w.rpe) }
      })
      const prev = Array.isArray(ex.prev) ? [0, 1, 2, 3].map((i) => cleanNum('kg', (ex.prev as unknown[])[i])) : null
      return { baseName, isMain: typeof ex.isMain === 'boolean' ? ex.isMain : MAIN.test(baseName), weeks, prev }
    })
    return {
      key,
      name: String(day.name ?? key),
      notes: String(day.notes ?? ''),
      readiness: { sleep: level(r.sleep, DEFAULT_READINESS.sleep), energy: level(r.energy, DEFAULT_READINESS.energy), soreness: level(r.soreness, DEFAULT_READINESS.soreness) },
      exercises,
    }
  })
}

const filled = (w: ChoraoWeek) => w.set !== null || w.rep !== null || w.kg !== null || w.rpe !== null || !!w.name

export interface ChoraoImport {
  program: Program
  /** Sem `programId` (quem grava preenche). */
  sessions: Omit<SessionV2, 'programId'>[]
  previous: Omit<CycleSnapshot, 'programId'> | null
  /** Exercícios a criar (nomes sem par no catálogo). */
  customExercises: Exercise[]
  matched: { name: string; id: string }[]
}

export function customExercise(name: string, r: Resolved): Exercise {
  return {
    id: r.id,
    name,
    namePt: name,
    bodyPart: r.group === 'peito' ? 'chest' : r.group === 'costas' ? 'back' : r.group === 'ombros' ? 'shoulders' : 'upper legs',
    equipment: 'barbell',
    target: '',
    muscleGroup: '',
    secondary: [],
    image: '',
    gif: '',
    steps: { es: [], en: [] },
    attribution: '',
    source: 'custom',
  }
}

export function choraoToProgress(days: ChoraoDay[], now = Date.now()): ChoraoImport {
  const cache = new Map<string, Resolved>()
  const customExercises: Exercise[] = []
  const matched: ChoraoImport['matched'] = []
  const resolve = (name: string) => {
    if (!cache.has(name)) {
      const r = resolveChoraoName(name, customId)
      cache.set(name, r)
      matched.push({ name, id: r.id })
      if (r.created) customExercises.push(customExercise(name, r))
    }
    return cache.get(name)!
  }

  // prescrição pelas séries/reps da primeira semana preenchida; as cargas ficam nas sessões
  const plan = days.map((d) => ({
    key: d.key,
    name: d.name,
    notes: d.notes,
    exercises: d.exercises.map((e) => {
      const first = e.weeks.find((w) => w.set !== null || w.rep !== null)
      return { baseName: e.baseName, isMain: e.isMain, set: first?.set ?? null, rep: first?.rep ?? null, kg: null }
    }),
  }))
  const hasPrev = days.some((d) => d.exercises.some((e) => e.prev?.some((x) => x !== null)))
  const program = { ...programFromChoraoDays(plan, resolve, { now }), currentCycle: hasPrev ? 2 : 1 }
  program.warnings = [...program.warnings, 'Importado do Chorão: as datas dos treinos são aproximadas (uma semana por coluna S1–S4, terminando nesta semana).']

  const weeks = program.blocks[0].weeks
  const start = now - 3 * 7 * DAY - 4 * DAY
  const sessions: ChoraoImport['sessions'] = []
  days.forEach((d, dayIdx) => {
    const progDay = weeks[0].days.find((x) => x.key === d.key)
    if (!progDay) return
    const daySessions: (typeof sessions)[number][] = []
    for (let wi = 0; wi < 4; wi++) {
      if (!d.exercises.some((e) => filled(e.weeks[wi]))) continue
      const exercises: SessionExerciseV2[] = d.exercises.map((e, i) => {
        const item = progDay.groups[i].items[0]
        const w = e.weeks[wi]
        // carga sem nº de séries: assume as séries planejadas (senão a carga sumiria da grade)
        const sets = w.set ?? (w.kg !== null || w.rep !== null ? item.sets : null)
        return {
          exerciseId: item.exerciseId,
          role: item.role,
          group: item.group,
          groupIndex: i,
          groupKind: 'simples',
          prescription: item,
          suggestion: { kind: 'start', weight: null, failStreak: 0, reason: 'Importado do Chorão.' },
          log: logFromCell({ sets, reps: w.rep, kg: w.kg, rpe: w.rpe }),
          ...(w.name && w.name !== e.baseName ? { variant: w.name } : {}),
        }
      })
      const at = start + wi * 7 * DAY + dayIdx * DAY
      daySessions.push({
        weekIndex: weeks[wi].index,
        weekKind: 'carga',
        dayKey: d.key,
        dayName: progDay.name,
        startedAt: at,
        finishedAt: at,
        status: 'done',
        exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))],
        exercises,
        cycle: program.currentCycle,
        origin: 'chorao',
      })
    }
    // o Chorão guarda uma prontidão por dia: vai na semana mais recente preenchida
    const last = daySessions.at(-1)
    if (last) last.readiness = d.readiness
    sessions.push(...daySessions)
  })

  const previous = hasPrev
    ? {
        cycle: 1,
        closedAt: start - DAY,
        weeks: [0, 0, 0, 0],
        total: 0,
        exercises: days.flatMap((d) =>
          d.exercises.filter((e) => e.prev).map((e) => ({ dayKey: d.key, exerciseId: cache.get(e.baseName)!.id, kg: e.prev! })),
        ),
      }
    : null

  return { program, sessions, previous, customExercises, matched }
}
