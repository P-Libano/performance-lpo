import { suggestNextV2 } from '../programacao/progression'
import { weekAt } from '../programacao/program'
import type {
  ExerciseResultV2,
  Program,
  SessionExerciseV2,
  SessionV2,
  SetLog,
} from '../programacao/types'

export type { SetLog } from '../programacao/types'
export type Session = SessionV2
export type SessionExercise = SessionExerciseV2

/** Pausa maior que isto não conta na duração (app esquecido aberto). */
const IDLE_GAP_MS = 15 * 60 * 1000

/** Séries concluídas de um exercício, no formato que as estratégias de progressão recebem. */
export function toResult(e: SessionExerciseV2, date: number, weekKind: SessionV2['weekKind']): ExerciseResultV2 {
  const done = e.log.filter((s) => s.done && s.reps !== null)
  return {
    date,
    weekKind,
    prescription: e.prescription,
    sets: done.map((s, i) => ({
      weight: s.weight ?? 0,
      reps: s.reps!,
      rpe: s.rpe ?? null,
      restBeforeSec: i > 0 && s.completedAt && done[i - 1].completedAt ? Math.round((s.completedAt - done[i - 1].completedAt!) / 1000) : null,
    })),
  }
}

/** Histórico de um exercício (sessões concluídas, ordem cronológica). */
export function historyFor(exerciseId: string, sessions: SessionV2[]): ExerciseResultV2[] {
  return sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((s) => s.exercises.filter((e) => e.exerciseId === exerciseId).map((e) => toResult(e, s.startedAt, s.weekKind)))
    .filter((r) => r.sets.length > 0)
}

/** Monta a sessão do dia com a sugestão da estratégia do objetivo e séries pré-preenchidas. */
export function buildSession(
  program: Program,
  weekIndex: number,
  dayKey: string,
  past: SessionV2[],
  isBodyweight: (id: string) => boolean,
  now = Date.now(),
): SessionV2 {
  const week = weekAt(program, weekIndex)
  const day = week.days.find((d) => d.key === dayKey)
  if (!day) throw new Error(`Dia ${dayKey} não existe na semana ${weekIndex}`)
  const exercises: SessionExerciseV2[] = day.groups.flatMap((g, groupIndex) =>
    g.items.map((item) => {
      const history = historyFor(item.exerciseId, past)
      const suggestion = suggestNextV2({
        goal: program.goal,
        role: item.role,
        group: item.group,
        prescription: item,
        history,
        weekKind: week.kind,
        bodyweight: isBodyweight(item.exerciseId),
      })
      const prescription = {
        ...item,
        sets: suggestion.sets ?? item.sets,
        restSec: suggestion.restSec ?? item.restSec,
        ...(suggestion.reps ? { reps: suggestion.reps } : {}),
      }
      const previous = history.at(-1)
      // template com carga inicial: vale até existir histórico do exercício
      const planned = !previous && suggestion.kind === 'start' && item.startKg ? item.startKg : null
      const finalSuggestion = planned
        ? { ...suggestion, weight: planned, reason: `Carga inicial do plano: ${planned.toLocaleString('pt-BR')} kg. ${suggestion.reason}` }
        : suggestion
      const weight = finalSuggestion.weight ?? previous?.sets[0]?.weight ?? null
      return {
        exerciseId: item.exerciseId,
        role: item.role,
        group: item.group,
        groupIndex,
        groupKind: g.kind,
        prescription,
        suggestion: finalSuggestion,
        previous,
        recent: history.slice(-3),
        log: Array.from({ length: prescription.sets }, (): SetLog => ({ weight, reps: null, rpe: null, done: false })),
      }
    }),
  )
  return {
    programId: program.id!,
    weekIndex: week.index,
    weekKind: week.kind,
    dayKey,
    dayName: day.name,
    startedAt: now,
    status: 'active',
    exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))],
    exercises,
    cycle: program.currentCycle ?? 1,
  }
}

/** Duração ativa: do início ao fim, descontando buracos longos entre séries. */
export function activeDurationSec(s: SessionV2, end = s.finishedAt ?? Date.now()): number {
  const marks = [s.startedAt, ...s.exercises.flatMap((e) => e.log.map((l) => l.completedAt).filter((t): t is number => !!t)), end].sort(
    (a, b) => a - b,
  )
  let total = 0
  for (let i = 1; i < marks.length; i++) total += Math.min(marks[i] - marks[i - 1], IDLE_GAP_MS)
  return Math.round(total / 1000)
}

/** Resumo para a tela de fim de treino. */
export function sessionSummary(s: SessionV2) {
  const sets = s.exercises.flatMap((e) => e.log.filter((l) => l.done && l.reps !== null))
  return {
    exercises: s.exercises.filter((e) => e.log.some((l) => l.done)).length,
    sets: sets.length,
    reps: sets.reduce((a, l) => a + (l.reps ?? 0), 0),
    volumeKg: sets.reduce((a, l) => a + (l.reps ?? 0) * (l.weight ?? 0), 0),
    durationMin: Math.round((s.durationSec ?? activeDurationSec(s)) / 60),
  }
}

/** Aceita "62,5", "62.5", "" (→ null). */
export function parseNumber(input: string): number | null {
  const t = input.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
