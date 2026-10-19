/**
 * Tipos do dataset hasaneyldrm/exercises-dataset (data/exercises.schema.json).
 * O dataset NÃO tem português: nomes só em inglês e instruções em
 * en/es/it/tr/ru/zh/hi/pl/ko/fr. Nomes em pt-BR vêm do catálogo curado.
 */

export const DATASET_LANGS = ['en', 'es', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko', 'fr'] as const
export type DatasetLang = (typeof DATASET_LANGS)[number]

export const BODY_PARTS = [
  'back',
  'cardio',
  'chest',
  'lower arms',
  'lower legs',
  'neck',
  'shoulders',
  'upper arms',
  'upper legs',
  'waist',
] as const
export type BodyPart = (typeof BODY_PARTS)[number]

/** Registro bruto, exatamente como vem de data/exercises.json. */
export interface RawExercise {
  id: string // "0001" (4 dígitos, não contíguos)
  name: string
  category: string // espelha body_part
  body_part: BodyPart
  equipment: string // "dumbbell", "body weight", ...
  instructions: Record<DatasetLang, string>
  instruction_steps: Record<DatasetLang, string[]>
  muscle_group: string // sinergista principal
  secondary_muscles: string[]
  target: string // músculo-alvo primário
  media_id: string
  image: string // "images/0001-2gPfomN.jpg" (180x180)
  gif_url: string // "videos/0001-2gPfomN.gif" (180x180)
  attribution: string // "© Gym visual — https://gymvisual.com/"
  created_at: string
}

/** Idiomas de instrução que guardamos localmente (o mais próximo do pt + inglês). */
export type StoredLang = 'es' | 'en'

/** Versão enxuta guardada no IndexedDB e usada pelo app. */
export interface Exercise {
  id: string
  name: string // inglês (original)
  namePt?: string // pt-BR, quando curado
  bodyPart: BodyPart
  equipment: string
  target: string
  muscleGroup: string
  secondary: string[]
  image: string // caminho relativo no repo
  gif: string // caminho relativo no repo
  steps: Record<StoredLang, string[]>
  attribution: string
  /** 'custom' = criado no app (LPO e exercícios importados que não casaram com o dataset); sobrevive à atualização do catálogo. */
  source?: 'custom'
  /** Passo a passo em pt-BR (só exercícios próprios). */
  stepsPt?: string[]
  /** Animação própria (vetorial): reserva quando os GIFs não carregam. */
  animation?: string
  /**
   * LPO sem GIF próprio no dataset: GIFs de partes do movimento (ex.: snatch pull → overhead squat),
   * tocados em sequência. `from` = id do exercício do dataset de onde vem a mídia.
   */
  parts?: { from: string; gif: string; image: string; label: string }[]
}
