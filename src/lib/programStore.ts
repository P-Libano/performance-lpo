import { useLiveQuery } from 'dexie-react-hooks'
import { META, db } from '../db'
import type { Profile } from '../domain/profile'
import { choraoTemplate } from '../programacao/chorao'
import { generateProgram } from '../programacao/generator'
import { swapInProgram } from '../programacao/program'
import type { Program } from '../programacao/types'

async function equipmentLookup() {
  const equipment = new Map<string, string>()
  await db.exercises.each((e) => equipment.set(e.id, e.equipment))
  return (id: string) => equipment.get(id)
}

export async function getProfile(): Promise<Profile | undefined> {
  return (await db.meta.get(META.profile))?.value as Profile | undefined
}

export async function getActiveProgram(): Promise<Program | undefined> {
  const id = (await db.meta.get(META.activeProgram))?.value as number | undefined
  return id === undefined ? undefined : db.programs.get(id)
}

/** Salva o perfil, gera o programa local e o torna ativo. */
export async function saveProfileAndGenerate(profile: Profile): Promise<Program> {
  const program = generateProgram(profile, await equipmentLookup())
  return db.transaction('rw', db.meta, db.programs, async () => {
    await db.meta.put({ key: META.profile, value: profile })
    const id = (await db.programs.add(program)) as number
    await db.meta.put({ key: META.activeProgram, value: id })
    return { ...program, id }
  })
}

/** Ativa um programa pronto (ex.: vindo da IA). */
export async function activateProgram(program: Program): Promise<number> {
  return db.transaction('rw', db.meta, db.programs, async () => {
    await db.meta.put({ key: META.profile, value: program.profile })
    const { id: _ignored, ...rest } = program
    const id = (await db.programs.add(rest)) as number
    await db.meta.put({ key: META.activeProgram, value: id })
    return id
  })
}

/** Ativa o template "LPO + Musculação" (plano inicial do Chorão). */
export async function activateChoraoTemplate(): Promise<number> {
  return activateProgram(choraoTemplate().program)
}

/** Troca o exercício (grupo, item) do dia em todas as semanas do programa. */
export async function replaceExercise(programId: number, dayKey: string, groupIndex: number, itemIndex: number, newId: string) {
  const p = await db.programs.get(programId)
  if (!p) return
  await db.programs.put(swapInProgram(p, dayKey, groupIndex, itemIndex, newId, await equipmentLookup()))
}

export const useProfile = () => useLiveQuery(getProfile, [])
/** `null` = carregado e sem programa; `undefined` = carregando. */
export const useActiveProgram = () => useLiveQuery(async () => (await getActiveProgram()) ?? null, [])
