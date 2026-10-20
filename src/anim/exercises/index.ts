import type { ExerciseSpec } from '../spec'
import { supino } from './supino'
import { terra } from './terra'

/** Todos os exercícios com animação própria (qualquer status). O app só usa os `revisado`. */
export const EXERCISES: readonly ExerciseSpec[] = [terra, supino]

export const EXERCISE_BY_ID: ReadonlyMap<string, ExerciseSpec> = new Map(EXERCISES.map((e) => [e.id, e]))

/** Animação própria publicada (revisada) para um exercício do catálogo, se houver. */
export const publishedAnimation = (exerciseId: string) => {
  const e = EXERCISE_BY_ID.get(exerciseId)
  return e?.review.status === 'revisado' ? e : undefined
}
