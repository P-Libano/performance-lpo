import { SEG, type Skeleton } from './body'
import { add, dot, lerp3, mul, sub, unit, v, type V3 } from './vec'

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
  /** banco reto: altura do assento 43 cm, largura 28 cm; encosto do banco inclinado com 78 cm */
  bench: { height: 43, halfWidth: 14, pad: 6, backLength: 78 },
  /**
   * barra fixa: diâmetro 3 cm; montantes (tubo de 6 cm) nas pontas. `clearance` = folga mínima entre a barra e
   * o centro de uma articulação/osso (≈ raio da cabeça): mais perto que isso, o volume do corpo atravessa a barra.
   */
  pullupBar: { radius: 1.5, post: 3, clearance: SEG.headRadius },
  /**
   * leg press 45°: encosto de 70 cm, assento de 50 cm de largura inclinado 10° (frente mais alta), plataforma
   * 60 × 72 cm com 4 cm de espessura, trilhos fixos a ±28 cm com 150 cm, manoplas a ±31 cm
   */
  legPress: {
    backLength: 70,
    seatHalfWidth: 25,
    seatTilt: 10,
    pad: 8,
    platformHalfHeight: 30,
    platformHalfWidth: 36,
    platformThickness: 4,
    railHalfZ: 28,
    railLength: 150,
    handleZ: 31,
  },
  /** puxada alta: assento de 40 cm de largura; rolos do apoio de coxas (raio 5,5 cm, 18 cm cada, centrados a ±13 cm); torre de 16 cm; barra de 120 cm */
  latPulldown: { seatHalfWidth: 20, pad: 7, rollerRadius: 5.5, rollerHalfLength: 9, rollerZ: 13, tower: 8, barHalfLength: 60 },
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
  /** Barra fixa (eixo z) na altura y, posição x, com montantes até o chão nas pontas. */
  | { kind: 'pullupBar'; x: number; y: number; halfLength: number }
  /**
   * Leg press 45°: assento (x0..x1; `y` = altura na dobradiça do encosto, a frente sobe `DIM.legPress.seatTilt`
   * graus), encosto fixo, trilhos fixos na direção `rail` (graus acima da horizontal) e carro com a plataforma,
   * que se apoia na SOLA dos pés (plano calcanhar–ponta). `handles` = manoplas ao lado do assento.
   */
  | { kind: 'legPress'; seat: { x0: number; x1: number; y: number }; back: { hingeX: number; deg: number }; rail: number; handles?: { x: number; y: number } }
  /**
   * Puxada alta (pulldown): assento (x0..x1, tampo na altura y), rolos do apoio de coxas com o eixo em
   * (thighPad.x, thighPad.y), torre em `towerX` com viga até a roldana, cabo até o meio das mãos e barra longa.
   */
  | { kind: 'latPulldown'; seat: { x0: number; x1: number; y: number }; thighPad: { x: number; y: number }; pulley: V3; towerX: number }
  /** Colchonete no chão (só visual). */
  | { kind: 'mat'; x0: number; x1: number }

/**
 * Sólido (para verificar que o corpo não atravessa o aparelho). `min`/`max` = caixa alinhada aos eixos.
 * Se `obb` existir, a caixa é inclinada (centro, 3 eixos unitários e meias-medidas) e `min`/`max` só a envolvem:
 * use `insideSolid` para testar.
 */
export interface SolidBox {
  name: string
  min: V3
  max: V3
  obb?: { center: V3; axes: readonly [V3, V3, V3]; half: V3 }
}

/** Ponto dentro do sólido, com `margin` cm de tolerância nas faces. */
export function insideSolid(box: SolidBox, p: V3, margin = 1): boolean {
  if (!box.obb) return p.every((c, i) => c > box.min[i] + margin && c < box.max[i] - margin)
  const d = sub(p, box.obb.center)
  return box.obb.axes.every((a, i) => Math.abs(dot(d, a)) < box.obb!.half[i] - margin)
}

/** Pontos de referência que dependem do quadro (centro da barra, etc.). */
export const midHands = (s: Skeleton): V3 => lerp3(s.hand.L, s.hand.R, 0.5)

const aabb = (name: string, min: V3, max: V3): SolidBox => ({ name, min, max })

/** Caixa inclinada a partir do centro, eixos e meias-medidas. */
function obb(name: string, center: V3, axes: readonly [V3, V3, V3], half: V3): SolidBox {
  const ext = [0, 1, 2].map((i) => axes.reduce((acc, a, k) => acc + Math.abs(a[i]) * half[k], 0))
  return { name, min: v(center[0] - ext[0], center[1] - ext[1], center[2] - ext[2]), max: v(center[0] + ext[0], center[1] + ext[1], center[2] + ext[2]), obb: { center, axes, half } }
}

// ───────── leg press: geometria compartilhada (desenho e verificação) ─────────

const rad = (d: number) => (d * Math.PI) / 180
/** Direção do trilho (para onde a plataforma se afasta) e "para cima" no plano da plataforma. */
export const legPressAxes = (p: Extract<PropSpec, { kind: 'legPress' }>) => ({
  rail: v(Math.cos(rad(p.rail)), Math.sin(rad(p.rail)), 0),
  up: v(-Math.sin(rad(p.rail)), Math.cos(rad(p.rail)), 0),
})

/**
 * Plataforma neste quadro: plano perpendicular ao trilho encostado na SOLA (calcanhares e pontas dos pés):
 * fica no ponto da sola mais avançado ao longo do trilho. Devolve o centro da face de apoio.
 */
export function legPressPlatform(p: Extract<PropSpec, { kind: 'legPress' }>, s: Skeleton): { face: V3; rail: V3; up: V3 } {
  const { rail, up } = legPressAxes(p)
  const sole = [s.heel.L, s.toe.L, s.heel.R, s.toe.R]
  const along = Math.max(...sole.map((q) => dot(q, rail)))
  const mid = mul(add(add(sole[0], sole[1]), add(sole[2], sole[3])), 0.25)
  return { face: add(mid, mul(rail, along - dot(mid, rail))), rail, up }
}

/** Sólidos fixos de um aparelho (só os que o corpo NÃO pode atravessar). Os que acompanham o corpo: `solidsAt`. */
export function solidsOf(p: PropSpec): SolidBox[] {
  switch (p.kind) {
    case 'bench': {
      const h = p.height ?? DIM.bench.height
      return [aabb('banco', v(p.x0, 0, -DIM.bench.halfWidth), v(p.x1, h, DIM.bench.halfWidth))]
    }
    case 'legPress': {
      const w = DIM.legPress.seatHalfWidth
      return [aabb('assento do leg press', v(p.seat.x0, 0, -w), v(p.seat.x1, p.seat.y, w))]
    }
    case 'pullupBar': {
      const c = DIM.pullupBar.clearance
      const post = DIM.pullupBar.post
      return [
        aabb('barra fixa', v(p.x - c, p.y - c, -p.halfLength), v(p.x + c, p.y + c, p.halfLength)),
        ...[-1, 1].map((k) => aabb('montante da barra fixa', v(p.x - post, 0, k * p.halfLength - post), v(p.x + post, p.y, k * p.halfLength + post))),
      ]
    }
    case 'latPulldown': {
      const L = DIM.latPulldown
      const zr = L.rollerZ + L.rollerHalfLength
      return [
        aabb('assento da puxada', v(p.seat.x0, 0, -L.seatHalfWidth), v(p.seat.x1, p.seat.y, L.seatHalfWidth)),
        aabb('apoio de coxas', v(p.thighPad.x - L.rollerRadius, p.thighPad.y - L.rollerRadius, -zr), v(p.thighPad.x + L.rollerRadius, p.thighPad.y + L.rollerRadius, zr)),
        aabb('torre da puxada', v(p.towerX - L.tower, 0, -L.tower), v(p.towerX + L.tower, p.pulley[1] + 12, L.tower)),
      ]
    }
    default:
      return []
  }
}

/** Todos os sólidos neste quadro: os fixos e os que acompanham o corpo (plataforma do leg press). */
export function solidsAt(p: PropSpec, s: Skeleton): SolidBox[] {
  const fixed = solidsOf(p)
  if (p.kind !== 'legPress') return fixed
  const { face, rail, up } = legPressPlatform(p, s)
  const D = DIM.legPress
  const t = D.platformThickness / 2
  return [...fixed, obb('plataforma do leg press', add(face, mul(rail, t)), [rail, up, v(0, 0, 1)], v(t, D.platformHalfHeight, D.platformHalfWidth))]
}

/** Direção do cabo (da pegada para a roldana), para verificar a linha de força. */
export const cableDir = (pulley: V3, hand: V3): V3 => unit(sub(pulley, hand))

/** Ponto da superfície do encosto inclinado a `d` cm da dobradiça (para apoiar costas). */
export const inclinePoint = (hingeX: number, height: number, deg: number, d: number): V3 =>
  add(v(hingeX, height, 0), mul(v(-Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0), d))
