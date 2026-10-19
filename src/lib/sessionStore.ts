import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { activeDurationSec, buildSession, type Session, type SetLog } from '../domain/session'
import type { TimerState } from '../domain/timer'
import { applyReadiness } from '../domain/readiness'
import type { Program, Readiness } from '../programacao/types'

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first()
}

/** Retoma a sessão em andamento ou cria a do dia pedido. */
export async function startOrResume(program: Program, weekIndex: number, dayKey: string, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.sessions, db.exercises, async () => {
    const active = await getActiveSession()
    if (active) return active.id!
    const day = program.blocks.flatMap((b) => b.weeks).find((w) => w.index === weekIndex)?.days.find((d) => d.key === dayKey)
    const ids = day?.groups.flatMap((g) => g.items.map((i) => i.exerciseId)) ?? []
    const past = await db.sessions.where('exerciseIds').anyOf(ids).distinct().toArray()
    const equipment = new Map((await db.exercises.bulkGet(ids)).filter((e) => !!e).map((e) => [e!.id, e!.equipment]))
    const s = buildSession(program, weekIndex, dayKey, past, (id) => equipment.get(id) === 'body weight', now)
    return (await db.sessions.add(s)) as number
  })
}

async function mutate(id: number, fn: (s: Session) => void) {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    fn(s)
    await db.sessions.put(s)
  })
}

export const updateSet = (id: number, ex: number, set: number, patch: Partial<SetLog>) =>
  mutate(id, (s) => {
    Object.assign(s.exercises[ex].log[set], patch)
  })

/**
 * Marca/desmarca a série. Ao concluir, registra o horário e inicia o descanso da prescrição
 * (em superset/circuito, o item que não é o último tem descanso curto entre exercícios).
 */
export const toggleSetDone = (id: number, ex: number, set: number, now = Date.now()) =>
  mutate(id, (s) => {
    const e = s.exercises[ex]
    const log = e.log[set]
    log.done = !log.done
    if (log.done) {
      log.completedAt = now
      if (log.reps === null) log.reps = e.prescription.reps?.max ?? 1 // sem digitar = fez o alvo (condicionamento: 1 volta)
      s.restUntil = now + e.prescription.restSec * 1000
      s.restTotal = e.prescription.restSec
      delete s.restPausedLeft
    } else {
      delete log.completedAt
    }
  })

export const addSet = (id: number, ex: number) =>
  mutate(id, (s) => {
    const log = s.exercises[ex].log
    const last = log[log.length - 1]
    log.push({ weight: last?.weight ?? null, reps: null, rpe: null, done: false })
  })

export const removeLastSet = (id: number, ex: number) =>
  mutate(id, (s) => {
    const log = s.exercises[ex].log
    if (log.length > 1 && !log[log.length - 1].done) log.pop()
  })

/** Propaga a carga para as séries seguintes ainda não feitas. */
export const setWeightFrom = (id: number, ex: number, set: number, weight: number | null) =>
  mutate(id, (s) => {
    s.exercises[ex].log.forEach((l, i) => {
      if (i === set || (i > set && !l.done)) l.weight = weight
    })
  })

/** Estado do cronômetro de descanso da sessão (rodando, pausado ou parado). */
export const setRest = (id: number, t: TimerState) =>
  mutate(id, (s) => {
    s.restUntil = t.until
    s.restPausedLeft = t.pausedLeft
    if (t.total !== undefined) s.restTotal = t.total
  })

/** Check-in de prontidão: grava e ajusta a carga sugerida (−5% com prontidão baixa). */
export const setReadiness = (id: number, r: Readiness) => mutate(id, (s) => void applyReadiness(s, r))

export const setSessionNotes = (id: number, notes: string) =>
  mutate(id, (s) => {
    s.notes = notes.slice(0, 2000)
  })

export const finishSession =(id: number, now = Date.now()) =>
  mutate(id, (s) => {
    s.status = 'done'
    s.finishedAt = now
    s.durationSec = activeDurationSec(s, now)
    s.restUntil = undefined
    delete s.restPausedLeft
  })

export const discardSession = (id: number) => db.sessions.delete(id)

/** Última sessão concluída do programa (define o próximo treino). */
export async function lastDoneSession(programId: number): Promise<Session | undefined> {
  const done = await db.sessions.where('programId').equals(programId).toArray()
  return done.filter((s) => s.status === 'done').sort((a, b) => b.startedAt - a.startedAt)[0]
}

export const useActiveSession = () => useLiveQuery(async () => (await getActiveSession()) ?? null, [])
export const useSession = (id: number | undefined) =>
  useLiveQuery(async () => (id === undefined ? null : ((await db.sessions.get(id)) ?? null)), [id])
/** Todas as sessões do programa (grade, próximo treino do ciclo). */
export const useProgramSessions = (programId: number | undefined) =>
  useLiveQuery(async () => (programId === undefined ? [] : db.sessions.where('programId').equals(programId).toArray()), [programId])
export const useLastDoneSession =(programId: number | undefined) =>
  useLiveQuery(async () => (programId === undefined ? null : ((await lastDoneSession(programId)) ?? null)), [programId])
