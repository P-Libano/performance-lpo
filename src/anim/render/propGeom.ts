import type { Skeleton } from '../body'
import { PALETTE } from '../palette'
import { DIM, midHands, type PropSpec } from '../props'
import { DEG, add, cross, dist, len, mul, sub, unit, v, type V3 } from '../vec'

/**
 * Geometria 3D dos aparelhos (cm), a partir de PropSpec + esqueleto do quadro. Sem câmera: o mesmo resultado
 * serve para desenhar (props.tsx) e para enquadrar (camera.ts). Medidas de `DIM` (props.ts).
 */

export type Shape =
  /** caixa: canto `o` e arestas a, b, c (pode ser inclinada) */
  | { t: 'box'; o: V3; a: V3; b: V3; c: V3; fill: string; side: string; edge: string }
  /** disco (anilha, roldana): centro, eixo (normal), raio, espessura */
  | { t: 'disc'; c: V3; axis: V3; r: number; w: number; fill: string; rim: string; plate?: boolean }
  /** cilindro fino (barra, cabo, tubo) */
  | { t: 'rod'; a: V3; b: V3; r: number; color: string }

const Z = v(0, 0, 1)
const P = PALETTE

/** Eixo da barra: de mão direita para mão esquerda (≈ z quando as mãos estão niveladas). */
function barAxis(s: Skeleton): V3 {
  const d = sub(s.hand.L, s.hand.R)
  return len(d) > 5 ? unit(d) : Z
}

function barbell(s: Skeleton, plates: number): Shape[] {
  const c = midHands(s)
  const ax = barAxis(s)
  const at = (k: number) => add(c, mul(ax, k))
  const { halfLength, sleeveFrom, plateRadius, plateWidth } = DIM.bar
  const out: Shape[] = [{ t: 'rod', a: at(-sleeveFrom), b: at(sleeveFrom), r: 1.4, color: P.bar }]
  for (const k of [-1, 1]) {
    out.push({ t: 'disc', c: at(k * (sleeveFrom - 1)), axis: ax, r: 3.2, w: 2, fill: P.sleeve, rim: P.metalDark })
    for (let i = 0; i < plates; i++)
      out.push({ t: 'disc', c: at(k * (sleeveFrom + plateWidth * (i + 0.5) + 0.5)), axis: ax, r: plateRadius - i * 2.5, w: plateWidth, fill: P.plate, rim: P.plateRim, plate: true })
    out.push({ t: 'rod', a: at(k * sleeveFrom), b: at(k * halfLength), r: 2.5, color: P.sleeve })
  }
  return out
}

function dumbbells(s: Skeleton, axis: 'z' | 'x'): Shape[] {
  const ax = axis === 'z' ? Z : v(1, 0, 0)
  const { halfGrip, plateRadius, plateWidth } = DIM.dumbbell
  const out: Shape[] = []
  for (const h of [s.hand.L, s.hand.R]) {
    out.push({ t: 'rod', a: add(h, mul(ax, -halfGrip - 2)), b: add(h, mul(ax, halfGrip + 2)), r: 1.6, color: P.metal })
    for (const k of [-1, 1]) {
      out.push({ t: 'disc', c: add(h, mul(ax, k * (halfGrip + plateWidth / 2))), axis: ax, r: plateRadius, w: plateWidth, fill: P.plate, rim: P.plateRim })
      out.push({ t: 'disc', c: add(h, mul(ax, k * (halfGrip + plateWidth * 1.5))), axis: ax, r: plateRadius * 0.82, w: plateWidth, fill: P.plate, rim: P.plateRim })
    }
  }
  return out
}

const box = (o: V3, a: V3, b: V3, c: V3, fill: string = P.pad, side: string = P.padEdge, edge: string = P.padEdge): Shape => ({ t: 'box', o, a, b, c, fill, side, edge })

function bench(p: Extract<PropSpec, { kind: 'bench' }>): Shape[] {
  const h = p.height ?? DIM.bench.height
  const w = DIM.bench.halfWidth
  const pad = DIM.bench.pad
  const out: Shape[] = []
  const seatFrom = p.incline ? p.incline.hingeX : p.x0
  out.push(box(v(seatFrom, h - pad, -w), v(p.x1 - seatFrom, 0, 0), v(0, pad, 0), v(0, 0, 2 * w)))
  if (p.incline) {
    const r = p.incline.deg * DEG
    const dir = v(-Math.cos(r), Math.sin(r), 0)
    const n = v(Math.sin(r), Math.cos(r), 0)
    const L = 78
    const o = add(v(p.incline.hingeX, h, -w), mul(n, -pad))
    out.push(box(o, mul(dir, L), mul(n, pad), v(0, 0, 2 * w)))
    // escora do encosto até o chão
    const mid = add(v(p.incline.hingeX, h - pad, 0), mul(dir, L * 0.55))
    out.push({ t: 'rod', a: mid, b: v(mid[0], 0, 0), r: 2.2, color: P.metalDark })
  }
  // pés do banco (tubo) nas pontas do assento
  const legX = [seatFrom + 4, p.x1 - 4]
  if (!p.incline) legX[0] = p.x0 + 4
  for (const x of legX) out.push(box(v(x - 2.5, 0, -w + 2), v(5, 0, 0), v(0, h - pad, 0), v(0, 0, 2 * w - 4), P.metal, P.metalDark, P.metalDark))
  out.push({ t: 'rod', a: v(legX[0], 8, 0), b: v(legX[1], 8, 0), r: 2, color: P.metalDark })
  return out
}

function cable(p: Extract<PropSpec, { kind: 'cable' }>, s: Skeleton): Shape[] {
  const out: Shape[] = []
  if (p.column) out.push(box(v(p.column.x - 6, 0, p.column.z - 6), v(12, 0, 0), v(0, Math.max(p.pulley[1] + 15, 60), 0), v(0, 0, 12), P.metal, P.metalDark, P.metalDark))
  out.push({ t: 'disc', c: p.pulley, axis: Z, r: 4.5, w: 2.5, fill: P.metalDark, rim: P.padEdge })
  const near = dist(s.hand.L, p.pulley) <= dist(s.hand.R, p.pulley) ? s.hand.L : s.hand.R
  const grip = p.handle === 'single' ? near : midHands(s)
  out.push({ t: 'rod', a: p.pulley, b: grip, r: 0.45, color: P.cable })
  if (p.handle === 'bar') {
    const ax = barAxis(s)
    const half = Math.max(dist(s.hand.L, s.hand.R) / 2 + 6, 20)
    out.push({ t: 'rod', a: add(grip, mul(ax, -half)), b: add(grip, mul(ax, half)), r: 1.3, color: P.metal })
  } else if (p.handle === 'rope') {
    for (const h of [s.hand.L, s.hand.R]) out.push({ t: 'rod', a: grip, b: h, r: 1.3, color: P.cable })
  } else {
    out.push({ t: 'rod', a: add(grip, v(0, 0, -6)), b: add(grip, v(0, 0, 6)), r: 1.3, color: P.metal })
  }
  return out
}

function legPress(p: Extract<PropSpec, { kind: 'legPress' }>, s: Skeleton): Shape[] {
  const out: Shape[] = []
  const { seat, back } = p
  out.push(box(v(seat.x0, seat.y - 8, -25), v(seat.x1 - seat.x0, 0, 0), v(0, 8, 0), v(0, 0, 50)))
  out.push(box(v(seat.x0 + 8, 0, -18), v(seat.x1 - seat.x0 - 16, 0, 0), v(0, seat.y - 8, 0), v(0, 0, 36), P.metal, P.metalDark, P.metalDark))
  const r = back.deg * DEG
  const dir = v(-Math.cos(r), Math.sin(r), 0)
  const n = v(Math.sin(r), Math.cos(r), 0)
  out.push(box(add(v(back.hingeX, seat.y, -25), mul(n, -8)), mul(dir, 70), mul(n, 8), v(0, 0, 50)))
  // plataforma: plano perpendicular ao trilho, encostado na sola dos pés
  const rail = v(Math.cos(p.rail * DEG), Math.sin(p.rail * DEG), 0)
  const upIn = v(-Math.sin(p.rail * DEG), Math.cos(p.rail * DEG), 0)
  const sole = mul(add(add(s.heel.L, s.toe.L), add(s.heel.R, s.toe.R)), 0.25)
  out.push(box(add(add(sole, mul(upIn, -30)), v(0, 0, -36)), mul(upIn, 60), mul(rail, 4), v(0, 0, 72), P.metal, P.metalDark, P.metalDark))
  // trilhos: atrás da plataforma (do lado oposto ao atleta) e abaixo do centro dela
  for (const z of [-22, 22]) {
    const base = add(add(add(sole, mul(rail, 8)), mul(upIn, -18)), v(0, 0, z))
    out.push({ t: 'rod', a: add(base, mul(rail, -10)), b: add(base, mul(rail, 70)), r: 2.4, color: P.metalDark })
  }
  return out
}

/** Formas 3D de um aparelho neste quadro. */
export function shapesOf(p: PropSpec, s: Skeleton): Shape[] {
  switch (p.kind) {
    case 'barbell':
      return barbell(s, p.plates ?? 1)
    case 'dumbbells':
      return dumbbells(s, p.axis)
    case 'bench':
      return bench(p)
    case 'cable':
      return cable(p, s)
    case 'pullupBar':
      return [
        { t: 'rod', a: v(p.x, p.y, -p.halfLength), b: v(p.x, p.y, p.halfLength), r: DIM.pullupBar.radius, color: P.metal },
        { t: 'disc', c: v(p.x, p.y, -p.halfLength), axis: Z, r: 3, w: 2, fill: P.metalDark, rim: P.padEdge },
        { t: 'disc', c: v(p.x, p.y, p.halfLength), axis: Z, r: 3, w: 2, fill: P.metalDark, rim: P.padEdge },
      ]
    case 'legPress':
      return legPress(p, s)
    case 'mat':
      return [box(v(p.x0, 0, -32), v(p.x1 - p.x0, 0, 0), v(0, 1.5, 0), v(0, 0, 64), P.floor, P.detail, P.detail)]
  }
}

/** Dois vetores unitários perpendiculares ao eixo de um disco. */
export function discBasis(axis: V3): [V3, V3] {
  const ref = Math.abs(axis[1]) < 0.9 ? v(0, 1, 0) : v(1, 0, 0)
  const e1 = unit(cross(axis, ref))
  return [e1, unit(cross(axis, e1))]
}

/** Pontos de contorno de uma forma (para enquadrar). */
export function shapePoints(sh: Shape): V3[] {
  switch (sh.t) {
    case 'box': {
      const pts: V3[] = []
      for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) pts.push(add(add(add(sh.o, mul(sh.a, i)), mul(sh.b, j)), mul(sh.c, k)))
      return pts
    }
    case 'disc': {
      const [e1, e2] = discBasis(sh.axis)
      const pts: V3[] = []
      for (let i = 0; i < 12; i++) {
        const q = add(mul(e1, Math.cos((i * Math.PI) / 6) * sh.r), mul(e2, Math.sin((i * Math.PI) / 6) * sh.r))
        pts.push(add(add(sh.c, q), mul(sh.axis, sh.w / 2)), add(add(sh.c, q), mul(sh.axis, -sh.w / 2)))
      }
      return pts
    }
    case 'rod':
      return [sh.a, sh.b]
  }
}
