import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { buildGrid, currentCycle, logFromCell, sessionCycle, sessionIndexOf, type Cell } from '../domain/ciclo'
import { buildSession } from '../domain/session'
import type { CycleSnapshot, Program, SessionV2 } from '../programacao/types'

/** Resumo mais recente de um ciclo anterior ao atual (referência "Ant."). */
export async function previousSnapshot(program: Program): Promise<CycleSnapshot | undefined> {
  const snaps = await db.cycles.where('programId').equals(program.id!).toArray()
  return snaps.filter((s) => s.cycle < currentCycle(program)).sort((a, b) => a.closedAt - b.closedAt).at(-1)
}

/** Grade do ciclo atual + resumo do anterior, reativos ao banco. */
export function useCycleGrid(program: Program | null | undefined) {
  return useLiveQuery(async () => {
    if (!program?.id) return undefined
    const [sessions, previous, history] = await Promise.all([
      db.sessions.where('programId').equals(program.id).toArray(),
      previousSnapshot(program),
      db.cycles.where('programId').equals(program.id).sortBy('closedAt'),
    ])
    return { grid: buildGrid(program, sessions, previous), previous, history, sessions }
  }, [program])
}

const emptyCell = (c: Pick<Cell, 'sets' | 'reps' | 'kg' | 'rpe' | 'variant'>) => !c.sets && !c.reps && !c.kg && !c.rpe && !c.variant

/**
 * Grava uma célula da grade: reescreve as séries do exercício na sessão daquele dia/semana do ciclo
 * atual. Sem sessão, cria uma já concluída (origem "grade"). Uma sessão de grade que fica vazia é apagada.
 */
export async function setCell(
  program: Program,
  weekIndex: number,
  dayKey: string,
  gi: number,
  ii: number,
  exerciseId: string,
  cell: Pick<Cell, 'sets' | 'reps' | 'kg' | 'rpe' | 'variant'>,
  now = Date.now(),
): Promise<number | undefined> {
  return db.transaction('rw', db.sessions, db.exercises, async () => {
    const mine = (await db.sessions.where('programId').equals(program.id!).toArray())
      .filter((s) => s.weekIndex === weekIndex && s.dayKey === dayKey && sessionCycle(s) === currentCycle(program))
      .sort((a, b) => b.startedAt - a.startedAt)
    let s: SessionV2 | undefined = mine[0]
    if (!s) {
      if (emptyCell(cell)) return undefined
      const day = program.blocks.flatMap((b) => b.weeks).find((w) => w.index === weekIndex)?.days.find((d) => d.key === dayKey)
      const ids = day?.groups.flatMap((g) => g.items.map((i) => i.exerciseId)) ?? []
      const past = await db.sessions.where('exerciseIds').anyOf(ids).distinct().toArray()
      const equipment = new Map((await db.exercises.bulkGet(ids)).filter((e) => !!e).map((e) => [e!.id, e!.equipment]))
      s = buildSession(program, weekIndex, dayKey, past, (id) => equipment.get(id) === 'body weight', now)
      s.status = 'done'
      s.origin = 'grade'
      s.finishedAt = now
      for (const e of s.exercises) e.log = []
    }
    const idx = sessionIndexOf(s, gi, ii, exerciseId)
    if (idx < 0) return s.id
    const e = s.exercises[idx]
    e.log = logFromCell(cell)
    if (cell.variant) e.variant = cell.variant.slice(0, 60)
    else delete e.variant
    if (s.origin === 'grade' && s.exercises.every((x) => !x.log.length && !x.variant)) {
      if (s.id !== undefined) await db.sessions.delete(s.id)
      return undefined
    }
    return (await db.sessions.put(s)) as number
  })
}
