import { ADVANCED_IDS, CURATED, NEEDS_BAR_IDS, type CuratedExercise, type MuscleGroup } from '../data/curated'
import { LPO_DEFS } from '../data/lpo'
import type { ExerciseMeta, MuscleMass } from './types'

/**
 * Metadados de programação derivados do catálogo curado + listas explícitas.
 * Critérios em docs/programacao.md ("Papéis no catálogo").
 */

/** Os básicos com barra: podem ocupar slot `principal`. */
export const PRINCIPAL_IDS: ReadonlySet<string> = new Set([
  '0043', // agachamento livre
  '0042', // agachamento frontal
  '0025', // supino reto barra
  '0047', // supino inclinado barra
  '0032', // terra
  '0085', // terra romeno barra
  '0811', // terra trap bar
  '0117', // terra sumô
  '0091', // desenvolvimento sentado barra
  '1457', // desenvolvimento militar em pé
  '0027', // remada curvada barra
  '3017', // remada Pendlay
])

export const UNILATERAL_IDS: ReadonlySet<string> = new Set([
  '0292', '1476', '1759', '2368', '0410', '0336', '0054', '0381', '1460', '0431',
  '1757', '0795', '0409', '0297', '0333', '3161',
])

/** Compostos bilaterais que mesmo assim não fazem sentido abaixo de 6 reps (fáceis demais ou instáveis). */
export const NOT_LOW_REP_IDS: ReadonlySet<string> = new Set([
  '0662', '1311', '0279', '0493', // flexões
  '0499', '2300', '3165', // remadas invertida/toalha
  '1685', '3132', // agachamentos de peso corporal
  '0259', '0283', '0129', // flexão fechada, diamante, mergulho no banco
  '0196', // pull-through
  '1409', // elevação pélvica com barra
])

export const MASS: Record<MuscleGroup, MuscleMass> = {
  quadriceps: 'grande',
  posteriores: 'grande',
  gluteos: 'grande',
  costas: 'grande',
  peito: 'media',
  ombros: 'media',
  trapezio: 'media',
  biceps: 'pequena',
  triceps: 'pequena',
  panturrilhas: 'pequena',
  abdomen: 'pequena',
  antebracos: 'pequena',
  condicionamento: 'grande',
}

export function metaFor(c: CuratedExercise): ExerciseMeta {
  const role =
    c.group === 'condicionamento' ? 'condicionamento' : PRINCIPAL_IDS.has(c.id) ? 'principal' : c.compound ? 'composto' : 'isolador'
  const unilateral = UNILATERAL_IDS.has(c.id)
  return {
    id: c.id,
    pt: c.pt,
    group: c.group,
    pattern: c.pattern,
    role,
    unilateral,
    massaMuscular: MASS[c.group],
    adequadoBaixasReps: (role === 'principal' || role === 'composto') && !unilateral && !NOT_LOW_REP_IDS.has(c.id),
    avancado: ADVANCED_IDS.has(c.id) || undefined,
    precisaBarra: NEEDS_BAR_IDS.has(c.id) || undefined,
  }
}

/** LPO próprios: técnicos (avançado), bilaterais e feitos em poucas reps. */
const lpoMeta = (d: (typeof LPO_DEFS)[number]): ExerciseMeta => ({
  id: d.id,
  pt: d.pt,
  group: d.group,
  pattern: d.pattern,
  role: d.principal ? 'principal' : 'composto',
  unilateral: false,
  massaMuscular: MASS[d.group],
  adequadoBaixasReps: true,
  avancado: true,
})

export const META: readonly ExerciseMeta[] = [...CURATED.map(metaFor), ...LPO_DEFS.map(lpoMeta)]
export const META_BY_ID: ReadonlyMap<string, ExerciseMeta> = new Map(META.map((m) => [m.id, m]))

/** O papel `principal` também serve em slot `composto`. */
export function fitsRole(m: ExerciseMeta, slotRole: ExerciseMeta['role']): boolean {
  if (slotRole === 'composto') return m.role === 'composto' || m.role === 'principal'
  return m.role === slotRole
}
