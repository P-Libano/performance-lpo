import type { ReactNode } from 'react'
import type { Skeleton } from '../body'
import { PALETTE } from '../palette'
import type { PropSpec } from '../props'
import { add, cross, dist, dot, lerp3, mul, sub, unit, type V3 } from '../vec'
import type { Camera, Pt } from './camera'
import { hull, lightOf, pathD } from './geom'
import { discBasis, shapesOf, type Shape } from './propGeom'

/**
 * Peça de desenho com profundidade: o corpo e os aparelhos viram uma lista dessas peças e são pintados do
 * mais longe para o mais perto da câmera (Figure.tsx). `ref` = ponto 3D que representa a peça (centro).
 */
export interface Prim {
  depth: number
  ref: V3
  node: ReactNode
}

const LINE = 0.7

function boxNode(cam: Camera, sh: Extract<Shape, { t: 'box' }>, key: string): ReactNode {
  const { o, a, b, c } = sh
  const center = add(add(add(o, mul(a, 0.5)), mul(b, 0.5)), mul(c, 0.5))
  const light = lightOf(cam)
  const faces: [V3, V3, V3][] = [
    [o, a, b],
    [add(o, c), a, b],
    [o, a, c],
    [add(o, b), a, c],
    [o, b, c],
    [add(o, a), b, c],
  ]
  const out: ReactNode[] = []
  faces.forEach(([p, e1, e2], i) => {
    let n = unit(cross(e1, e2))
    const mid = add(add(p, mul(e1, 0.5)), mul(e2, 0.5))
    if (dot(n, sub(mid, center)) < 0) n = mul(n, -1)
    if (dot(n, cam.toCam) <= 1e-3) return
    const pts: Pt[] = [p, add(p, e1), add(add(p, e1), e2), add(p, e2)].map(cam.project)
    out.push(<path key={i} d={pathD(pts)} fill={dot(n, light) > 0.35 ? sh.fill : sh.side} stroke={sh.edge} strokeWidth={LINE * 0.8} strokeLinejoin="round" />)
  })
  return <g key={key}>{out}</g>
}

function ellipse(cam: Camera, c: V3, e1: V3, e2: V3, r: number, n = 36): Pt[] {
  return Array.from({ length: n }, (_, i) => cam.project(add(c, add(mul(e1, r * Math.cos((2 * Math.PI * i) / n)), mul(e2, r * Math.sin((2 * Math.PI * i) / n))))))
}

function discNode(cam: Camera, sh: Extract<Shape, { t: 'disc' }>, key: string): ReactNode {
  const [e1, e2] = discBasis(sh.axis)
  const half = mul(sh.axis, sh.w / 2)
  const faceC = dot(sh.axis, cam.toCam) >= 0 ? add(sh.c, half) : sub(sh.c, half)
  const rim = hull([...ellipse(cam, add(sh.c, half), e1, e2, sh.r), ...ellipse(cam, sub(sh.c, half), e1, e2, sh.r)])
  return (
    <g key={key}>
      <path d={pathD(rim)} fill={sh.rim} stroke={sh.rim} strokeWidth={LINE * 0.6} strokeLinejoin="round" />
      <path d={pathD(ellipse(cam, faceC, e1, e2, sh.r))} fill={sh.fill} />
      {sh.plate && (
        <>
          <path d={pathD(ellipse(cam, faceC, e1, e2, sh.r * 0.92))} fill="none" stroke={PALETTE.plateRing} strokeWidth={0.8} />
          <path d={pathD(ellipse(cam, faceC, e1, e2, sh.r * 0.4))} fill="none" stroke={PALETTE.plateRing} strokeWidth={1.1} />
          <path d={pathD(ellipse(cam, faceC, e1, e2, 3.6, 18))} fill={PALETTE.hub} />
        </>
      )}
    </g>
  )
}

/** Tubo cortado em pedaços curtos: cada pedaço entra na ordenação por profundidade (barra passa à frente da canela e atrás do braço do lado de lá). */
function rodPrims(cam: Camera, sh: Extract<Shape, { t: 'rod' }>, key: string): Prim[] {
  const n = Math.max(1, Math.ceil(dist(sh.a, sh.b) / 10))
  const out: Prim[] = []
  for (let i = 0; i < n; i++) {
    const p = lerp3(sh.a, sh.b, i / n)
    const q = lerp3(sh.a, sh.b, (i + 1) / n)
    const [x1, y1] = cam.project(p)
    const [x2, y2] = cam.project(q)
    const mid = lerp3(p, q, 0.5)
    out.push({
      depth: cam.depth(mid),
      ref: mid,
      node: (
        <g key={`${key}-${i}`} strokeLinecap="round">
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PALETTE.line} strokeWidth={2 * sh.r + LINE * 1.2} />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={sh.color} strokeWidth={2 * sh.r} />
        </g>
      ),
    })
  }
  return out
}

/** Centro de uma forma (para ordenar). */
function centerOf(sh: Shape): V3 {
  if (sh.t === 'box') return add(add(add(sh.o, mul(sh.a, 0.5)), mul(sh.b, 0.5)), mul(sh.c, 0.5))
  if (sh.t === 'disc') return sh.c
  return lerp3(sh.a, sh.b, 0.5)
}

/** Peças de desenho de um aparelho neste quadro. */
export function propPrims(cam: Camera, prop: PropSpec, s: Skeleton, key: string): Prim[] {
  const out: Prim[] = []
  shapesOf(prop, s).forEach((sh, i) => {
    const k = `${key}-${i}`
    if (sh.t === 'rod') out.push(...rodPrims(cam, sh, k))
    else {
      const c = centerOf(sh)
      out.push({ depth: cam.depth(c), ref: c, node: sh.t === 'box' ? boxNode(cam, sh, k) : discNode(cam, sh, k) })
    }
  })
  return out
}
