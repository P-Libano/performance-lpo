import { CURATED_BY_ID, type CuratedExercise } from './curated'
import type { Exercise } from './types'

/**
 * Levantamentos olímpicos (LPO) que o dataset não tem: entradas próprias, com nome e passo a passo
 * em pt-BR. A mídia vem do próprio dataset, por partes: GIFs de movimentos que compõem o LPO
 * (ex.: snatch pull + overhead squat), tocados em sequência — mesmo estilo dos demais exercícios.
 * A animação vetorial do app fica de reserva (GIF indisponível). Ids com prefixo "lpo-" (nunca
 * colidem com o dataset, que usa 4 dígitos).
 */

export type LpoAnimation = 'snatch' | 'snatch-hang' | 'clean' | 'jerk' | 'pull'

/** Parte do movimento: exercício do dataset cuja mídia mostra aquele trecho. */
export interface LpoPart {
  id: string
  label: string
}

/** GIFs do dataset usados nas montagens (todos existem no dataset; ver lpo.test). */
const SNATCH_PULL: LpoPart = { id: '0776', label: 'Puxada (snatch pull)' }
const OVERHEAD_SQUAT: LpoPart = { id: '0069', label: 'Recepção: agachamento overhead' }
const POWER_CLEAN: LpoPart = { id: '0648', label: 'Puxada e encaixe (power clean)' }
const FRONT_SQUAT: LpoPart = { id: '0029', label: 'Recepção: agachamento frontal' }
const SQUAT_JERK: LpoPart = { id: '0786', label: 'Jerk (recepção em agachamento)' }

interface LpoDef extends CuratedExercise {
  name: string
  animation: LpoAnimation
  parts: LpoPart[]
  /** O que a montagem não mostra (aparece sob o GIF). */
  mediaNote?: string
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
    parts: [SNATCH_PULL, OVERHEAD_SQUAT],
    mediaNote: 'Montagem com GIFs do dataset: a puxada e a recepção. A passagem da barra do quadril para cima da cabeça não aparece.',
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
    parts: [SNATCH_PULL, OVERHEAD_SQUAT],
    mediaNote:
      'Montagem com GIFs do dataset: a puxada (que no GIF sai do chão; no suspenso, comece com a barra acima dos joelhos) e a recepção.',
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
    parts: [POWER_CLEAN, FRONT_SQUAT],
    mediaNote: 'Montagem com GIFs do dataset: power clean (encaixe em pé) e o agachamento frontal da recepção completa.',
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
    parts: [SQUAT_JERK],
    mediaNote: 'GIF do dataset: squat jerk (recepção em agachamento). No split jerk, a recepção é com uma perna à frente e outra atrás.',
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
    parts: [{ ...SNATCH_PULL, label: 'Tripla extensão (snatch pull)' }],
    mediaNote: 'GIF do dataset: snatch pull, a puxada completa até a extensão.',
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
    parts: [{ ...OVERHEAD_SQUAT, label: 'Agachamento overhead' }],
    mediaNote: 'GIF do dataset: agachamento overhead, uma das variações auxiliares do arranco.',
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

/** Ids do dataset cuja mídia os LPO usam. */
export const LPO_MEDIA_IDS: readonly string[] = [...new Set(LPO_DEFS.flatMap((d) => d.parts.map((p) => p.id)))]

/**
 * LPO com a mídia das partes, tirada dos exercícios do dataset (caminhos e atribuição vêm de lá, então
 * acompanham atualizações do dataset). Parte sem par no catálogo fica de fora; sem nenhuma, só a animação.
 */
export function lpoWithMedia(datasetById: (id: string) => Exercise | undefined): Exercise[] {
  return LPO_EXERCISES.map((e) => {
    const parts = LPO_BY_ID.get(e.id)!
      .parts.map((p) => ({ p, src: datasetById(p.id) }))
      .filter((x): x is { p: LpoPart; src: Exercise } => !!x.src?.gif)
      .map(({ p, src }) => ({ from: src.id, gif: src.gif, image: src.image, label: p.label }))
    if (!parts.length) return e
    const first = datasetById(parts[0].from)!
    return { ...e, image: parts[0].image, gif: parts[0].gif, attribution: first.attribution, parts }
  })
}

/** Metadados curados de um id do dataset ou dos LPO próprios. */
export const curatedInfo = (id: string): CuratedExercise | undefined => CURATED_BY_ID.get(id) ?? LPO_BY_ID.get(id)
