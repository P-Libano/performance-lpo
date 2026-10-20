import type { Skeleton } from '../body'
import { PALETTE } from '../palette'
import { DIM, legPressPlatform, midHands, type PropSpec } from '../props'
import { DEG, add, cross, dist, dot, len, mul, sub, unit, v, type V3 } from '../vec'

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
    const L = DIM.bench.backLength
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

const metalBox = (o: V3, a: V3, b: V3, c: V3) => box(o, a, b, c, P.metal, P.metalDark, P.metalDark)
const tube = (a: V3, b: V3, r = 2.4, color: string = P.metalDark): Shape => ({ t: 'rod', a, b, r, color })

function legPress(p: Extract<PropSpec, { kind: 'legPress' }>, s: Skeleton): Shape[] {
  const D = DIM.legPress
  const out: Shape[] = []
  const { seat, back } = p
  const w = D.seatHalfWidth
  // assento inclinado: a superfície passa pela dobradiça (hingeX, y) e sobe para a frente
  const t = D.seatTilt * DEG
  const sDir = v(Math.cos(t), Math.sin(t), 0)
  const sN = v(-Math.sin(t), Math.cos(t), 0)
  const surfAt = (x: number) => v(x, seat.y + (x - back.hingeX) * Math.tan(t), 0)
  const seatLen = (seat.x1 - seat.x0) / Math.cos(t)
  out.push(box(add(add(surfAt(seat.x0), mul(sN, -D.pad)), v(0, 0, -w)), mul(sDir, seatLen), mul(sN, D.pad), v(0, 0, 2 * w)))
  // encosto
  const r = back.deg * DEG
  const bDir = v(-Math.cos(r), Math.sin(r), 0)
  const bN = v(Math.sin(r), Math.cos(r), 0)
  out.push(box(add(v(back.hingeX, seat.y, -w), mul(bN, -D.pad)), mul(bDir, D.backLength), mul(bN, D.pad), v(0, 0, 2 * w)))
  // estrutura do banco: pedestal e escora do encosto
  const lowY = Math.min(surfAt(seat.x0)[1], surfAt(seat.x1)[1]) - D.pad
  out.push(metalBox(v(seat.x0 + 6, 0, -16), v(seat.x1 - seat.x0 - 12, 0, 0), v(0, lowY, 0), v(0, 0, 32)))
  const backMid = add(add(v(back.hingeX, seat.y, 0), mul(bN, -D.pad)), mul(bDir, D.backLength * 0.6))
  out.push(tube(backMid, v(backMid[0] + 8, 0, 0), 2.6))
  // manoplas ao lado do assento
  const hx = p.handles?.x ?? (seat.x0 + seat.x1) / 2
  const hy = p.handles?.y ?? seat.y + 8
  for (const k of [-1, 1]) {
    const z = k * D.handleZ
    out.push(tube(v(hx - 7, hy, z), v(hx + 7, hy, z), 1.8, P.pad))
    out.push(tube(v(hx + 5, hy, z), v(hx + 5, lowY, k * (w - 2)), 1.6))
  }

  // trilhos FIXOS: retas paralelas ao trilho; o carro com a plataforma corre neles
  const { face, rail, up } = legPressPlatform(p, s)
  const hinge = v(back.hingeX, seat.y, 0)
  const s0 = dot(hinge, rail) + 25 // começo dos trilhos (perto do assento)
  const offset = sub(face, mul(rail, dot(face, rail))) // posição da reta (perpendicular ao trilho), fixa
  const railAt = (along: number, z: number) => add(add(add(offset, mul(rail, along)), mul(up, -12)), v(0, 0, z))
  for (const k of [-1, 1]) {
    const z = k * D.railHalfZ
    const a = railAt(s0, z)
    const b = railAt(s0 + D.railLength, z)
    out.push(tube(a, b, 2.8))
    out.push(tube(b, v(b[0], 0, z), 3)) // montante do alto até o chão
    if (a[1] > 1) out.push(tube(a, v(a[0], 0, z), 3))
    out.push(tube(v(Math.min(seat.x0, a[0]) - 5, 2.5, z), v(b[0] + 5, 2.5, z), 2.5)) // base no chão
  }
  // carro (trenó) atrás da plataforma, com os pinos de anilha
  const T = D.platformThickness
  const H = D.platformHalfHeight
  const W = D.platformHalfWidth
  const sled = add(face, mul(rail, T))
  out.push(metalBox(add(add(sled, mul(up, -H * 0.75)), v(0, 0, -D.railHalfZ - 4)), mul(up, H * 1.5), mul(rail, 9), v(0, 0, 2 * D.railHalfZ + 8)))
  for (const k of [-1, 1]) {
    const pin = add(add(sled, mul(rail, 7)), mul(up, -H * 0.45))
    out.push(tube(add(pin, v(0, 0, k * (D.railHalfZ + 4))), add(pin, v(0, 0, k * (D.railHalfZ + 22))), 2.2, P.sleeve))
    out.push({ t: 'disc', c: add(pin, v(0, 0, k * (D.railHalfZ + 12))), axis: Z, r: 15, w: 4, fill: P.plate, rim: P.plateRim, plate: true })
  }
  // plataforma: face de apoio no plano da sola
  out.push(metalBox(add(add(face, mul(up, -H)), v(0, 0, -W)), mul(up, 2 * H), mul(rail, T), v(0, 0, 2 * W)))
  return out
}

function latPulldown(p: Extract<PropSpec, { kind: 'latPulldown' }>, s: Skeleton): Shape[] {
  const L = DIM.latPulldown
  const out: Shape[] = []
  const { seat, thighPad, pulley, towerX } = p
  const w = L.seatHalfWidth
  // assento e pedestal
  out.push(box(v(seat.x0, seat.y - L.pad, -w), v(seat.x1 - seat.x0, 0, 0), v(0, L.pad, 0), v(0, 0, 2 * w)))
  const cx = (seat.x0 + seat.x1) / 2
  out.push(metalBox(v(cx - 5, 0, -5), v(10, 0, 0), v(0, seat.y - L.pad, 0), v(0, 0, 10)))
  // base no chão ligando o pedestal à torre
  out.push(tube(v(seat.x0, 2.5, 0), v(towerX, 2.5, 0), 2.6))
  // apoio de coxas: dois rolos (eixo z) e o braço que desce à frente dos joelhos até a base
  for (const k of [-1, 1])
    out.push({ t: 'disc', c: v(thighPad.x, thighPad.y, k * L.rollerZ), axis: Z, r: L.rollerRadius, w: 2 * L.rollerHalfLength, fill: P.pad, rim: P.padEdge })
  const armTop = v(thighPad.x + 14, thighPad.y + 2, 0)
  out.push(tube(v(thighPad.x, thighPad.y, -L.rollerZ + 4), v(thighPad.x, thighPad.y, L.rollerZ - 4), 1.8))
  out.push(tube(v(thighPad.x, thighPad.y, 0), armTop, 2.2))
  out.push(tube(armTop, v(armTop[0], 2.5, 0), 2.4))
  // torre com a pilha de anilhas voltada para o atleta, viga até a roldana
  const top = pulley[1] + 12
  out.push(metalBox(v(towerX - L.tower, 0, -L.tower), v(2 * L.tower, 0, 0), v(0, top, 0), v(0, 0, 2 * L.tower)))
  out.push(box(v(towerX - L.tower - 9, 12, -12), v(9, 0, 0), v(0, 70, 0), v(0, 0, 24), P.plate, P.plateRim, P.plateRim))
  out.push(metalBox(v(Math.min(pulley[0] - 8, towerX), top - 7, -4), v(Math.abs(towerX - pulley[0]) + 8, 0, 0), v(0, 7, 0), v(0, 0, 8)))
  out.push({ t: 'disc', c: pulley, axis: Z, r: 5, w: 2.5, fill: P.metalDark, rim: P.padEdge })
  out.push({ t: 'disc', c: v(towerX, top - 10, 0), axis: Z, r: 5, w: 2.5, fill: P.metalDark, rim: P.padEdge })
  // cabo e barra longa de puxada (pontas caídas)
  const grip = midHands(s)
  out.push({ t: 'rod', a: pulley, b: grip, r: 0.45, color: P.cable })
  const ax = barAxis(s)
  const H = L.barHalfLength
  for (const k of [-1, 1]) {
    const bend = add(grip, mul(ax, k * (H - 14)))
    out.push(tube(grip, bend, 1.3, P.metal))
    out.push(tube(bend, add(add(grip, mul(ax, k * H)), v(0, -5, 0)), 1.3, P.metal))
  }
  return out
}

function pullupBar(p: Extract<PropSpec, { kind: 'pullupBar' }>): Shape[] {
  const D = DIM.pullupBar
  const out: Shape[] = [{ t: 'rod', a: v(p.x, p.y, -p.halfLength), b: v(p.x, p.y, p.halfLength), r: D.radius, color: P.metal }]
  for (const k of [-1, 1]) {
    const z = k * (p.halfLength + D.post)
    out.push(tube(v(p.x, 0, z), v(p.x, p.y + 4, z), D.post))
    out.push(tube(v(p.x - 28, 2, z), v(p.x + 28, 2, z), D.post)) // pé do montante
  }
  out.push(tube(v(p.x, p.y + 4, -p.halfLength - D.post), v(p.x, p.y + 4, p.halfLength + D.post), 2.2)) // travessa de cima
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
      return pullupBar(p)
    case 'legPress':
      return legPress(p, s)
    case 'latPulldown':
      return latPulldown(p, s)
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
