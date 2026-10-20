import type { Skeleton } from './body'
import { add, lerp3, mul, sub, unit, v, type V3 } from './vec'

/**
 * Biblioteca de aparelhos. Cada aparelho é DADO (posição e medidas reais em cm); o motor desenha e as
 * verificações usam a mesma geometria (o desenho nunca diverge do que é testado).
 * Aparelho novo entra aqui, com teste, antes de ser usado num exercício (ver docs/animacoes/PROCESSO.md).
 */

/** Medidas de referência. */
export const DIM = {
  /** barra olímpica: 220 cm, anilha de 45 cm (raio 22,5), mangas a partir de ±64 cm do centro */
  bar: { halfLength: 110, sleeveFrom: 64, plateRadius: 22.5, plateWidth: 6 },
  /** halter: pegada 14 cm, anilhas de 20 cm */
  dumbbell: { halfGrip: 7, plateRadius: 10, plateWidth: 4 },
  /** banco reto: altura do assento 43 cm, largura 28 cm */
  bench: { height: 43, halfWidth: 14, pad: 6 },
  /** barra fixa: diâmetro 3 cm */
  pullupBar: { radius: 1.5 },
} as const

export type PropSpec =
  /** Barra olímpica; o centro acompanha o ponto médio das mãos (pegada). */
  | { kind: 'barbell'; plates?: 1 | 2 }
  /** Um halter em cada mão, alinhado de lado a lado (eixo z do mundo) ou em pegada neutra (eixo x). */
  | { kind: 'dumbbells'; axis: 'z' | 'x' }
  /** Banco: de x0 a x1 (cm), tampo na altura `height`; `incline` = encosto inclinado (graus) a partir de `hingeX`. */
  | { kind: 'bench'; x0: number; x1: number; height?: number; incline?: { deg: number; hingeX: number } }
  /** Polia: cabo da roldana até a pegada; `handle` desenhado nas mãos. */
  | { kind: 'cable'; pulley: V3; handle: 'bar' | 'rope' | 'single'; column?: { x: number; z: number } }
  /** Barra fixa (eixo z) na altura y, posição x. */
  | { kind: 'pullupBar'; x: number; y: number; halfLength: number }
  /** Leg press 45°: plataforma acompanha os pés; encosto fixo. */
  | { kind: 'legPress'; seat: { x0: number; x1: number; y: number }; back: { hingeX: number; deg: number }; rail: number }
  /** Colchonete no chão (só visual). */
  | { kind: 'mat'; x0: number; x1: number }

/** Caixa sólida (para verificar que o corpo não atravessa o aparelho). */
export interface SolidBox {
  name: string
  min: V3
  max: V3
}

/** Pontos de referência que dependem do quadro (centro da barra, etc.). */
export const midHands = (s: Skeleton): V3 => lerp3(s.hand.L, s.hand.R, 0.5)

/** Sólidos de um aparelho (só os que o corpo NÃO pode atravessar). */
export function solidsOf(p: PropSpec): SolidBox[] {
  switch (p.kind) {
    case 'bench': {
      const h = p.height ?? DIM.bench.height
      return [{ name: 'banco', min: v(p.x0, 0, -DIM.bench.halfWidth), max: v(p.x1, h, DIM.bench.halfWidth) }]
    }
    case 'legPress':
      return [{ name: 'assento do leg press', min: v(p.seat.x0, 0, -25), max: v(p.seat.x1, p.seat.y, 25) }]
    default:
      return []
  }
}

/** Direção do cabo (da pegada para a roldana), para verificar a linha de força. */
export const cableDir = (pulley: V3, hand: V3): V3 => unit(sub(pulley, hand))

/** Ponto da superfície do encosto inclinado a `d` cm da dobradiça (para apoiar costas). */
export const inclinePoint = (hingeX: number, height: number, deg: number, d: number): V3 =>
  add(v(hingeX, height, 0), mul(v(-Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0), d))
