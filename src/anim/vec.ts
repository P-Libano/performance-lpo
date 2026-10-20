/** Vetores 3D (cm). Eixos do mundo: x = à frente do atleta (em pé), y = para cima, z = à esquerda dele. */
export type V3 = readonly [number, number, number]

export const v = (x: number, y: number, z: number): V3 => [x, y, z]
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const dist = (a: V3, b: V3) => len(sub(a, b))
export const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1))
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const DEG = Math.PI / 180

/** Ângulo entre dois vetores (graus). */
export const angle = (a: V3, b: V3) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / DEG

/** Gira `p` em torno do eixo unitário `axis` (graus, regra da mão direita). */
export function rotate(p: V3, axis: V3, deg: number): V3 {
  const k = unit(axis)
  const c = Math.cos(deg * DEG)
  const s = Math.sin(deg * DEG)
  return add(add(mul(p, c), mul(cross(k, p), s)), mul(k, dot(k, p) * (1 - c)))
}

/** Componente de `a` perpendicular a `axis`. */
export const reject = (a: V3, axis: V3): V3 => {
  const u = unit(axis)
  return sub(a, mul(u, dot(a, u)))
}
