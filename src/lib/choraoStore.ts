import { META, db } from '../db'
import { CHORAO_STORAGE_KEY, choraoToProgress, normalizeChorao } from '../programacao/choraoImport'
import type { Program, SessionV2 } from '../programacao/types'

export class ChoraoImportError extends Error {}

/**
 * Importa o backup do Chorão como um programa novo e ativo. Os dados atuais do Progressa ficam:
 * os programas antigos e o histórico continuam no banco.
 */
export async function importChorao(raw: unknown, now = Date.now()) {
  const days = normalizeChorao(raw)
  if (!days) throw new ChoraoImportError('O arquivo não tem o formato do Chorão (dias SEG a SEX com exercícios).')
  const r = choraoToProgress(days, now)
  if (!r.program.blocks[0].weeks[0].days.length) throw new ChoraoImportError('O backup do Chorão não tem nenhum exercício.')
  const programId = await db.transaction('rw', [db.meta, db.programs, db.sessions, db.cycles, db.exercises], async () => {
    await db.exercises.bulkPut(r.customExercises)
    const id = (await db.programs.add(r.program as Program)) as number
    await db.sessions.bulkAdd(r.sessions.map((s) => ({ ...s, programId: id }) as SessionV2))
    if (r.previous) await db.cycles.add({ ...r.previous, programId: id })
    await db.meta.put({ key: META.profile, value: r.program.profile })
    await db.meta.put({ key: META.activeProgram, value: id })
    return id
  })
  return {
    programId,
    sessions: r.sessions.length,
    exercises: r.matched.length,
    created: r.customExercises.map((e) => e.name),
    hasPrevious: !!r.previous,
  }
}

/** Backup do Chorão guardado neste navegador (só existe se o Chorão rodou na mesma origem). */
export function choraoInThisBrowser(): unknown | null {
  try {
    const t = localStorage.getItem(CHORAO_STORAGE_KEY)
    return t ? JSON.parse(t) : null
  } catch {
    return null
  }
}
