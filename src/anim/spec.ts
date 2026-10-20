import type { Skeleton } from './body'
import type { MuscleId } from './muscles'
import { EASE, mixPose, solve, type Ease, type PoseSpec } from './pose'
import type { PropSpec } from './props'

/**
 * Formato de um exercício (um arquivo por exercício em src/anim/exercises/). Ver docs/animacoes/PROCESSO.md:
 * a ficha técnica (fases, pontos-chave, músculos com fonte) vem antes das poses; o status de revisão decide
 * se o app usa esta animação ou o GIF do dataset.
 */

export interface Keyframe {
  /** nome da pose-chave (ex.: "Posição inicial", "Travamento"), para restrições que valem só nela */
  name?: string
  pose: PoseSpec
  /** ms da pose anterior até esta (a 1ª parte da última: o ciclo fecha) */
  moveMs: number
  /** ms parado nesta pose */
  holdMs: number
  /** fase do movimento em que esta pose termina (um dos nomes de `phases`) */
  phase: string
  ease?: Ease
}

export interface Check {
  /** Frase curta, em pt-BR, do que é verificado (aparece no estúdio e nas falhas de teste). */
  name: string
  /** Onde verificar: nas poses-chave (padrão), em todos os quadros, nas poses-chave de uma fase ou numa pose nomeada. */
  at?: 'keyframes' | 'all' | { phase: string } | { pose: string }
  /** `true` = ok; texto = o que deu errado. */
  test: (s: Skeleton) => true | string
}

export type ReviewStatus = 'rascunho' | 'verificado' | 'revisado'

export interface ExerciseSpec {
  /** id do exercício no catálogo do app (dataset, ex.: '0025') ou LPO próprio ('lpo-…') */
  id: string
  /** GIF do dataset usado como referência na revisão (o que esta animação substitui) */
  datasetId: string
  name: string
  /** câmera (graus): giro em torno da vertical e elevação; padrão 3/4 frontal como os GIFs do dataset */
  camera?: { yaw: number; pitch: number }
  phases: { name: string; description: string }[]
  /** pontos técnicos (cada um verificável → vira um `check`) */
  keyPoints: string[]
  /** músculos por fase: principal (vermelho) e secundário (rosa) */
  muscles: { phase: string; primary: MuscleId[]; secondary: MuscleId[] }[]
  /** de onde vêm os músculos (livro, revisão de EMG…) */
  muscleSource: string
  props: PropSpec[]
  frames: Keyframe[]
  checks: Check[]
  review: { status: ReviewStatus; by?: string; date?: string; notes?: string }
}

// ───────── linha do tempo ─────────

export const cycleMs = (spec: Pick<ExerciseSpec, 'frames'>) => spec.frames.reduce((a, f) => a + f.moveMs + f.holdMs, 0)

export interface Sample {
  pose: PoseSpec
  skeleton: Skeleton
  /** fase em curso (a da pose para onde está indo, ou onde está parado) */
  phase: string
  /** índice da pose-chave de destino */
  frame: number
  /** true se está parado numa pose-chave */
  holding: boolean
}

/** Pose no instante `ms` do ciclo (a 1ª transição parte da última pose: o ciclo fecha). */
export function sampleAt(spec: Pick<ExerciseSpec, 'frames'>, ms: number): Sample {
  const T = cycleMs(spec)
  let t = ((ms % T) + T) % T
  const fr = spec.frames
  for (let i = 0; i < fr.length; i++) {
    const f = fr[i]
    if (t < f.moveMs) {
      const from = fr[(i - 1 + fr.length) % fr.length].pose
      const pose = mixPose(from, f.pose, EASE[f.ease ?? 'inout'](t / f.moveMs))
      return { pose, skeleton: solve(pose), phase: f.phase, frame: i, holding: false }
    }
    t -= f.moveMs
    if (t < f.holdMs) return { pose: f.pose, skeleton: solve(f.pose), phase: f.phase, frame: i, holding: true }
    t -= f.holdMs
  }
  const last = fr.length - 1
  return { pose: fr[last].pose, skeleton: solve(fr[last].pose), phase: fr[last].phase, frame: last, holding: true }
}

/** Músculos da fase (para o destaque e o mapa muscular). */
export const musclesOf = (spec: ExerciseSpec, phase: string) =>
  spec.muscles.find((m) => m.phase === phase) ?? { phase, primary: [], secondary: [] }
