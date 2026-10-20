import type { V3 } from './vec'

/**
 * Atleta de referência: 175 cm, proporções de Drillis & Contini (fração da estatura H), em centímetros.
 * Os ossos são rígidos: o comprimento não muda entre quadros (verificado em checks.ts).
 */
export const HEIGHT = 175
const H = HEIGHT

export const SEG = {
  /** quadril (centro da articulação) → joelho */
  thigh: 0.245 * H,
  /** joelho → tornozelo */
  shin: 0.246 * H,
  /** altura do tornozelo acima do chão (pé apoiado) */
  ankleHeight: 0.039 * H,
  /** tornozelo → ponta do pé (na horizontal) e → calcanhar */
  toe: 0.115 * H,
  heel: 0.037 * H,
  /** centro da pelve → linha dos ombros (tronco, sem pescoço) */
  trunk: 0.288 * H,
  /** linha dos ombros → base do pescoço → centro da cabeça */
  neck: 0.034 * H,
  head: 0.075 * H,
  headRadius: 0.06 * H,
  /** ombro → cotovelo → punho → centro da mão (onde segura a barra) */
  upperArm: 0.186 * H,
  forearm: 0.146 * H,
  hand: 0.05 * H,
  /** meia-distância entre as articulações dos ombros e dos quadris */
  shoulderHalf: 0.1 * H,
  hipHalf: 0.05 * H,
} as const

/** Alcance do braço até o centro da mão (cotovelo → mão inclui a mão em linha com o antebraço). */
export const ARM = { a: SEG.upperArm, b: SEG.forearm + SEG.hand }
export const LEG = { a: SEG.thigh, b: SEG.shin }

export type Side = 'L' | 'R'
export const SIDES: readonly Side[] = ['L', 'R']

/** Esqueleto resolvido de um quadro: posições 3D das articulações (cm). */
export interface Skeleton {
  pelvis: V3
  chest: V3
  neck: V3
  head: V3
  /** Referencial do tronco: para cima (pelve → peito), para a frente (peito) e para a esquerda. */
  up: V3
  front: V3
  left: V3
  hip: Record<Side, V3>
  knee: Record<Side, V3>
  ankle: Record<Side, V3>
  heel: Record<Side, V3>
  toe: Record<Side, V3>
  shoulder: Record<Side, V3>
  elbow: Record<Side, V3>
  wrist: Record<Side, V3>
  /** centro da mão (ponto de pegada) */
  hand: Record<Side, V3>
  /** quanto faltou para mão/pé alcançarem o alvo pedido (0 = alcançou), em cm */
  reachError: { hand: Record<Side, number>; foot: Record<Side, number> }
}
