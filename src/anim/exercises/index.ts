import type { ExerciseSpec } from '../spec'

/**
 * Todos os exercícios com animação própria (qualquer status). O app só usa os `revisado`.
 * Cadastro automático: todo arquivo desta pasta com `export default` de um ExerciseSpec entra aqui —
 * para criar um exercício basta criar o arquivo (docs/animacoes/PROCESSO.md).
 */
const modules = import.meta.glob<{ default?: ExerciseSpec }>('./*.ts', { eager: true })

export const EXERCISES: readonly ExerciseSpec[] = Object.entries(modules)
  .filter(([path, m]) => !path.endsWith('/index.ts') && m.default)
  .map(([, m]) => m.default!)
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export const EXERCISE_BY_ID: ReadonlyMap<string, ExerciseSpec> = new Map(EXERCISES.map((e) => [e.id, e]))

/** Animação própria publicada (revisada) para um exercício do catálogo, se houver. */
export const publishedAnimation = (exerciseId: string) => {
  const e = EXERCISE_BY_ID.get(exerciseId)
  return e?.review.status === 'revisado' ? e : undefined
}
