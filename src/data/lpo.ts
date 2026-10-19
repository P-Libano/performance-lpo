import { CURATED_BY_ID, type CuratedExercise } from './curated'
import type { Exercise } from './types'

/**
 * Levantamentos olímpicos (LPO) que o dataset não tem: entradas próprias, com nome e passo a passo
 * em pt-BR e animação vetorial do app no lugar do GIF. Ids com prefixo "lpo-" (nunca colidem com o
 * dataset, que usa 4 dígitos).
 */

export type LpoAnimation = 'snatch' | 'snatch-hang' | 'clean' | 'jerk' | 'pull'

interface LpoDef extends CuratedExercise {
  name: string
  animation: LpoAnimation
  bodyPart: Exercise['bodyPart']
  target: string
  secondary: string[]
  steps: string[]
  /** Pode ocupar o papel principal (básico pesado do dia). */
  principal: boolean
}

const PUXADA = [
  'Pés na largura do quadril, barra sobre o meio do pé, pegada pronada e braços estendidos.',
  'Costas firmes e ombros um pouco à frente da barra; empurre o chão com as pernas sem deixar o quadril subir antes dos ombros.',
  'Com a barra acima dos joelhos, leve o quadril à frente até a posição de potência (barra no meio da coxa).',
]

export const LPO_DEFS: readonly LpoDef[] = [
  {
    id: 'lpo-snatch-chao',
    pt: 'Snatch do chão (arranco)',
    name: 'barbell snatch',
    group: 'posteriores',
    pattern: 'olimpico',
    compound: true,
    principal: true,
    animation: 'snatch',
    bodyPart: 'upper legs',
    target: 'glutes',
    secondary: ['hamstrings', 'quadriceps', 'traps', 'delts'],
    steps: [
      'Pegada larga (arranco): a barra deve ficar na dobra do quadril com os braços estendidos.',
      ...PUXADA,
      'Estenda quadril, joelhos e tornozelos de forma explosiva (tripla extensão) e encolha os ombros.',
      'Puxe o corpo para baixo da barra com os cotovelos altos e receba com os braços travados acima da cabeça, em agachamento.',
      'Levante do agachamento com a barra estável acima da cabeça.',
    ],
  },
  {
    id: 'lpo-snatch-suspenso',
    pt: 'Snatch suspenso (hang snatch)',
    name: 'barbell hang snatch',
    group: 'posteriores',
    pattern: 'olimpico',
    compound: true,
    principal: true,
    animation: 'snatch-hang',
    bodyPart: 'upper legs',
    target: 'glutes',
    secondary: ['hamstrings', 'quadriceps', 'traps', 'delts'],
    steps: [
      'Comece em pé com a barra na pegada de arranco, braços estendidos.',
      'Desça a barra até acima dos joelhos levando o quadril para trás, tronco inclinado e costas firmes.',
      'Estenda quadril, joelhos e tornozelos de forma explosiva e encolha os ombros.',
      'Puxe-se para baixo da barra e receba com os braços travados acima da cabeça, em agachamento.',
      'Levante com a barra estável acima da cabeça.',
    ],
  },
  {
    id: 'lpo-clean-chao',
    pt: 'Clean do chão (arremesso, 1º tempo)',
    name: 'barbell clean',
    group: 'posteriores',
    pattern: 'olimpico',
    compound: true,
    principal: true,
    animation: 'clean',
    bodyPart: 'upper legs',
    target: 'glutes',
    secondary: ['hamstrings', 'quadriceps', 'traps', 'calves'],
    steps: [
      'Pegada um pouco mais larga que os ombros.',
      ...PUXADA,
      'Estenda quadril, joelhos e tornozelos de forma explosiva e encolha os ombros.',
      'Puxe-se para baixo da barra girando os cotovelos à frente e receba a barra sobre os ombros, em agachamento frontal.',
      'Levante do agachamento com os cotovelos altos.',
    ],
  },
  {
    id: 'lpo-jerk',
    pt: 'Jerk (arremesso, 2º tempo)',
    name: 'barbell split jerk',
    group: 'ombros',
    pattern: 'olimpico',
    compound: true,
    principal: true,
    animation: 'jerk',
    bodyPart: 'shoulders',
    target: 'delts',
    secondary: ['triceps', 'quadriceps', 'glutes', 'core'],
    steps: [
      'Barra apoiada nos ombros (posição de rack), cotovelos à frente, pés na largura do quadril.',
      'Flexione levemente os joelhos com o tronco reto (dip), sem deixar o peso ir para a ponta dos pés.',
      'Empurre o chão com força e projete a barra para cima.',
      'Afaste as pernas (uma à frente, outra atrás) e trave os braços com a barra acima da cabeça.',
      'Recolha primeiro o pé da frente, depois o de trás, e estabilize.',
    ],
  },
  {
    id: 'lpo-tripla-extensao',
    pt: 'Tripla extensão (puxada de arranco)',
    name: 'barbell snatch high pull',
    group: 'posteriores',
    pattern: 'olimpico',
    compound: true,
    principal: false,
    animation: 'pull',
    bodyPart: 'upper legs',
    target: 'glutes',
    secondary: ['hamstrings', 'quadriceps', 'traps', 'calves'],
    steps: [
      'Comece na posição de potência: barra no meio da coxa, ombros à frente da barra.',
      'Estenda quadril, joelhos e tornozelos de uma vez, subindo na ponta dos pés.',
      'Encolha os ombros no fim do movimento, braços ainda estendidos.',
      'Volte a barra à coxa com controle e repita.',
    ],
  },
  {
    id: 'lpo-auxiliar-snatch',
    pt: 'Auxiliar do snatch',
    name: 'snatch accessory',
    group: 'posteriores',
    pattern: 'olimpico',
    compound: true,
    principal: false,
    animation: 'snatch-hang',
    bodyPart: 'upper legs',
    target: 'glutes',
    secondary: ['hamstrings', 'quadriceps', 'traps', 'delts'],
    steps: [
      'Variação de apoio ao arranco: power snatch, snatch balance, agachamento com a barra acima da cabeça, puxada etc.',
      'Anote a variação feita em cada semana no campo "variação executada" da grade do ciclo.',
    ],
  },
]

export const LPO_BY_ID: ReadonlyMap<string, LpoDef> = new Map(LPO_DEFS.map((d) => [d.id, d]))

/** Versão que vai para o IndexedDB, no mesmo formato dos exercícios do dataset. */
export const LPO_EXERCISES: readonly Exercise[] = LPO_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  namePt: d.pt,
  bodyPart: d.bodyPart,
  equipment: 'barbell',
  target: d.target,
  muscleGroup: d.secondary[0],
  secondary: d.secondary,
  image: '',
  gif: '',
  steps: { es: [], en: [] },
  attribution: '',
  source: 'custom',
  stepsPt: d.steps,
  animation: d.animation,
}))

/** Metadados curados de um id do dataset ou dos LPO próprios. */
export const curatedInfo = (id: string): CuratedExercise | undefined => CURATED_BY_ID.get(id) ?? LPO_BY_ID.get(id)
