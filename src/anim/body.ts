import type { V3 } from './vec'

/**
 * Atleta de referência: 175 cm, com as medidas do corpo 3D que é desenhado (MakeHuman 1.x, assets CC0),
 * tiradas das articulações do rig dele, em centímetros. Motor e corpo são o mesmo atleta: assim nenhuma
 * junta precisa ser esticada ou compensada no desenho.
 * Os ossos são rígidos: o comprimento não muda entre quadros (verificado em checks.ts).
 */
export const HEIGHT = 175

export const SEG = {
  /** quadril (centro da articulação) → joelho */
  thigh: 43.5,
  /** joelho → tornozelo */
  shin: 44.5,
  /** altura do tornozelo acima do chão (pé apoiado) */
  ankleHeight: 7.2,
  /** tornozelo → ponta do pé (na horizontal) e → calcanhar */
  toe: 19.9,
  heel: 6.1,
  /** centro da pelve → linha dos ombros (tronco, sem pescoço) */
  trunk: 45.5,
  /** linha dos ombros → base do pescoço → centro da cabeça */
  neck: 10.3,
  head: 14.8,
  headRadius: 10.5,
  /** ombro → cotovelo → punho → centro da mão (onde segura a barra) */
  upperArm: 25.8,
  forearm: 26.2,
  hand: 9.4,
  /** palma apoiada (punho dobrado ~90°): centro da palma acima da superfície e punho atrás dele */
  palmHalf: 1.9,
  palmBack: 6.2,
  /** antebraço deitado no apoio (prancha): altura do centro do cotovelo e do punho acima da superfície */
  forearmRest: 3.8,
  /** meia-distância entre as articulações dos ombros e dos quadris */
  shoulderHalf: 22.1,
  hipHalf: 10.8,
} as const

/** Alcance do braço até o centro da mão (cotovelo → mão inclui a mão em linha com o antebraço). */
export const ARM = { a: SEG.upperArm, b: SEG.forearm + SEG.hand }
export const LEG = { a: SEG.thigh, b: SEG.shin }
/** Altura da pelve em pé, pernas retas e pés sob os quadris. Alturas de pose em pé partem daqui. */
export const STAND_Y = SEG.ankleHeight + SEG.thigh + SEG.shin

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
  /** centro da mão (ponto de pegada; com a palma apoiada, o centro da palma) */
  hand: Record<Side, V3>
  /** 0 = mão em linha com o antebraço (pegada/solta); 1 = palma apoiada, punho dobrado */
  palm: Record<Side, number>
  /** quanto faltou para mão/pé alcançarem o alvo pedido (0 = alcançou), em cm */
  reachError: { hand: Record<Side, number>; foot: Record<Side, number> }
}
