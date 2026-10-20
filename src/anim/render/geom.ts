import { add, cross, dot, len, mul, sub, unit, v, type V3 } from '../vec'
import type { Camera, Pt } from './camera'

/**
 * Geometria de desenho: contornos 2D e superfícies simples (cilindro afunilado, tronco de elipses empilhadas)
 * com recortes só na parte voltada para a câmera (músculos, sombras, linhas de definição).
 */

const DEG = Math.PI / 180

export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const turn = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Pt[]) => {
    const out: Pt[] = []
    for (const q of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    return out.slice(0, -1)
  }
  return [...half(p), ...half([...p].reverse())]
}

export const pathD = (pts: Pt[]) => (pts.length > 2 ? `M${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}Z` : '')
export const polyPts = (pts: Pt[]) => pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')

/** Esferas projetadas (círculos) → contorno convexo: membros com juntas arredondadas. */
export function blob(cam: Camera, spheres: [V3, number][]): Pt[] {
  const pts: Pt[] = []
  for (const [c, r] of spheres) {
    const [x, y] = cam.project(c)
    for (let i = 0; i < 24; i++) pts.push([x + r * Math.cos((i * Math.PI) / 12), y + r * Math.sin((i * Math.PI) / 12)])
  }
  return hull(pts)
}

/** Referencial de um sólido: origem, eixo (comprimento len), anterior (N) e lateral (L). */
export interface Frame3 {
  o: V3
  A: V3
  N: V3
  L: V3
  len: number
}

/** `front` = para onde fica o ângulo 0; `lateral` = para onde fica o ângulo +90 (o sinal de L segue ele). */
export function frameOf(a: V3, b: V3, front: V3, lateral?: V3): Frame3 {
  const d = sub(b, a)
  const length = len(d) || 1
  const A = mul(d, 1 / length)
  let N = sub(front, mul(A, dot(front, A)))
  if (len(N) < 1e-6) N = sub(v(0, 1, 0), mul(A, A[1]))
  if (len(N) < 1e-6) N = v(1, 0, 0)
  N = unit(N)
  let L = cross(A, N)
  if (lateral && dot(L, lateral) < 0) L = mul(L, -1)
  return { o: a, A, N, L, len: length }
}

/** Seção transversal em u (0 = origem, 1 = ponta): meia-profundidade (N), meia-largura (L), deslocamento em N. */
export type Section = { u: number; rN: number; rL: number; c: number }
export type Prof = (u: number) => Section

export const cone =
  (ra: number, rb: number): Prof =>
  (u) => {
    const r = ra + (rb - ra) * Math.min(1, Math.max(0, u))
    return { u, rN: r, rL: r, c: 0 }
  }

export const lofted =
  (secs: Section[]): Prof =>
  (u) => {
    if (u <= secs[0].u) return { ...secs[0], u }
    for (let i = 1; i < secs.length; i++) {
      const [a, b] = [secs[i - 1], secs[i]]
      if (u <= b.u) {
        const t = (u - a.u) / (b.u - a.u)
        return { u, rN: a.rN + (b.rN - a.rN) * t, rL: a.rL + (b.rL - a.rL) * t, c: a.c + (b.c - a.c) * t }
      }
    }
    return { ...secs[secs.length - 1], u }
  }

export const surf = (f: Frame3, s: Section, ang: number): V3 =>
  add(add(add(f.o, mul(f.A, s.u * f.len)), mul(f.N, s.c + s.rN * Math.cos(ang * DEG))), mul(f.L, s.rL * Math.sin(ang * DEG)))

/** Ângulo (graus, 0 = anterior, +90 = lateral L) para onde aponta um vetor, no plano da seção. */
export const angleOf = (f: Frame3, s: Section, dir: V3) => Math.atan2(dot(f.L, dir) / s.rL, dot(f.N, dir) / s.rN) / DEG

/** Traz o ângulo `a` para perto de `ref` (diferença em −180..180). */
const nearAng = (a: number, ref: number) => a - 360 * Math.round((a - ref) / 360)

/** O eixo do sólido aponta quase para a câmera: a seção quase não aparece de lado (recortes ficam ruins). */
const facingAxis = (cam: Camera, f: Frame3) => Math.abs(dot(f.A, cam.toCam)) > 0.985

/**
 * Recorte da superfície entre u0..u1 e ângulos centro ± meia-abertura, só a parte visível.
 * `spindle` afina as pontas (forma de músculo).
 */
export function patch(cam: Camera, f: Frame3, prof: Prof, u0: number, u1: number, center: number, half: number, spindle = true): Pt[] {
  if (facingAxis(cam, f)) return []
  const left: Pt[] = []
  const right: Pt[] = []
  const rows = 8
  for (let i = 0; i <= rows; i++) {
    const u = u0 + ((u1 - u0) * i) / rows
    const s = prof(u)
    const h = spindle ? half * Math.pow(Math.sin((Math.PI * (i + 0.35)) / (rows + 0.7)), 0.7) : half
    const vis = angleOf(f, s, cam.toCam)
    const c = nearAng(center, vis)
    const lo = Math.max(c - h, vis - 89)
    const hi = Math.min(c + h, vis + 89)
    if (hi - lo < 2) continue
    const row: Pt[] = []
    for (let k = 0; k <= 6; k++) row.push(cam.project(surf(f, s, lo + ((hi - lo) * k) / 6)))
    if (!left.length) left.push(...row.slice(0, -1).reverse())
    left.push(row[0])
    right.unshift(row[6])
    if (i === rows) right.unshift(...row.slice(1, -1))
  }
  return left.length + right.length >= 3 ? [...left, ...right] : []
}

/** Linha sobre a superfície num ângulo fixo (separação entre músculos), só onde está visível. */
export function seam(cam: Camera, f: Frame3, prof: Prof, ang: number, u0: number, u1: number): Pt[] {
  if (facingAxis(cam, f)) return []
  const out: Pt[] = []
  for (let i = 0; i <= 6; i++) {
    const s = prof(u0 + ((u1 - u0) * i) / 6)
    const vis = angleOf(f, s, cam.toCam)
    const a = nearAng(ang, vis)
    if (Math.abs(a - vis) < 72) out.push(cam.project(surf(f, s, a)))
  }
  return out
}

/** Luz de cima, da frente e da esquerda da tela (a sombra cai atrás e embaixo, como nos GIFs). */
export const lightOf = (cam: Camera): V3 => unit(add(add(cam.toCam, v(0, 0.9, 0)), mul(cam.right, -0.5)))
