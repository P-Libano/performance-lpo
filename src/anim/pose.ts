import { ARM, LEG, SEG, SIDES, type Side, type Skeleton } from './body'
import { DEG, add, cross, dist, len, lerp3, mul, reject, rotate, sub, unit, v, type V3 } from './vec'

/**
 * Pose = pontos de contato + orientação do tronco. Quem desenha um exercício diz ONDE ficam pelve, mãos e
 * pés; cotovelos e joelhos saem da cinemática inversa (2 ossos + vetor-guia), então o comprimento dos ossos é
 * sempre o real e dá para verificar se a pose é alcançável (reachError).
 */

/** Pé: tornozelo e ponta do pé (onde o pé toca/aponta). O calcanhar é derivado. */
export interface Foot {
  ankle: V3
  toe: V3
}

export interface PoseSpec {
  /** Centro da pelve (cm). */
  pelvis: V3
  /**
   * Inclinação do tronco (graus): 0 = em pé; +45 = inclinado à frente (terra); +90 = deitado de bruços
   * (cabeça para +x, prancha); −90 = deitado de costas (cabeça para −x, supino).
   */
  pitch: number
  /** Giro do corpo todo em torno da vertical (graus; + = vira para a esquerda). */
  yaw?: number
  /** Cabeça em relação ao tronco (graus; + = queixo para baixo). */
  head?: number
  /** Centro de cada mão (pegada). */
  hands: Record<Side, V3>
  feet: Record<Side, Foot>
  /** Para onde aponta cada cotovelo/joelho (direção no mundo). Ausente = padrão anatômico. */
  elbowPole?: Partial<Record<Side, V3>>
  kneePole?: Partial<Record<Side, V3>>
}

/** Referencial do tronco a partir de pitch/yaw. */
export function trunkFrame(pitch: number, yaw = 0): { up: V3; front: V3; left: V3 } {
  const Z = v(0, 0, 1)
  const Y = v(0, 1, 0)
  // pitch: gira em torno do eixo esquerdo; positivo leva o "para cima" do tronco para +x (à frente)
  let up = rotate(v(0, 1, 0), Z, -pitch)
  let front = rotate(v(1, 0, 0), Z, -pitch)
  let left = Z
  if (yaw) {
    up = rotate(up, Y, yaw)
    front = rotate(front, Y, yaw)
    left = rotate(left, Y, yaw)
  }
  return { up, front, left }
}

/**
 * Cinemática inversa de 2 ossos em 3D: junta do meio entre raiz e alvo, dobrando na direção do `pole`.
 * Alvo fora de alcance: estica na direção dele e devolve quanto faltou (`error`, cm).
 */
export function ik2(root: V3, target: V3, a: number, b: number, pole: V3): { mid: V3; tip: V3; error: number } {
  const d0 = dist(root, target)
  const dir = unit(sub(target, root))
  const d = Math.min(Math.max(d0, Math.abs(a - b) + 1e-3), a + b - 1e-3)
  const error = d0 > a + b ? d0 - (a + b) : d0 < Math.abs(a - b) ? Math.abs(a - b) - d0 : 0
  const along = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - along * along))
  let bend = reject(pole, dir)
  if (len(bend) < 1e-6) bend = reject(v(0, 1, 0), dir) // guia paralelo ao membro: qualquer perpendicular
  if (len(bend) < 1e-6) bend = reject(v(1, 0, 0), dir)
  const mid = add(add(root, mul(dir, along)), mul(unit(bend), h))
  const tip = add(root, mul(dir, d))
  return { mid, tip, error }
}

/** Pé apoiado no chão: tornozelo na altura dele, ponta à frente (direção `heading` em graus, 0 = +x). */
export function footFlat(x: number, z: number, heading = 0, floorY = 0): Foot {
  const f = rotate(v(1, 0, 0), v(0, 1, 0), heading)
  const ankle = v(x, floorY + SEG.ankleHeight, z)
  return { ankle, toe: add(v(x, floorY, z), mul(f, SEG.toe)) }
}

/** Pé na ponta (calcanhar erguido `lift` cm). A ponta fica parada; o tornozelo sobe e recua. */
export function footOnToes(x: number, z: number, lift: number, heading = 0, floorY = 0): Foot {
  const flat = footFlat(x, z, heading, floorY)
  // o pé gira em torno da ponta (que fica no chão) até o calcanhar subir `lift`
  const alpha = Math.asin(Math.min(1, lift / (SEG.toe + SEG.heel))) / DEG
  const lateral = rotate(v(0, 0, 1), v(0, 1, 0), heading)
  return { ankle: add(flat.toe, rotate(sub(flat.ankle, flat.toe), lateral, -alpha)), toe: flat.toe }
}

/** Pé "solto" (pendurado, deitado): ponta na direção `dir` a partir do tornozelo. */
export const footFree = (ankle: V3, dir: V3): Foot => ({ ankle, toe: add(ankle, mul(unit(dir), SEG.toe)) })

/**
 * Mãos penduradas com os braços estendidos (terra, remada, encolhimento): dado onde a pegada fica na
 * horizontal (x, z), calcula a altura que deixa o braço reto (`straight` = fração do alcance; 0,996 ≈ 172°).
 * Evita errar "à mão" a altura da barra — braço quase reto é um erro comum de pose.
 */
export function hang(p: Omit<PoseSpec, 'hands'>, x: number, z: number, straight = 0.996, dir: -1 | 1 = -1): Record<Side, V3> {
  const s = solve({ ...p, hands: { L: p.pelvis, R: p.pelvis } } as PoseSpec)
  const reach = (ARM.a + ARM.b) * straight
  const at = (side: Side, zz: number): V3 => {
    const sh = s.shoulder[side]
    const dx = x - sh[0]
    const dz = zz - sh[2]
    return v(x, sh[1] + dir * Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz)), zz)
  }
  return { L: at('L', z), R: at('R', -z) }
}

/** Braços estendidos para CIMA (topo do supino, desenvolvimento, barra acima da cabeça). */
export const pressUp = (p: Omit<PoseSpec, 'hands'>, x: number, z: number, straight = 0.996) => hang(p, x, z, straight, 1)

/** Espelha um ponto do lado esquerdo (z+) para o direito. */
export const mirrorZ = (p: V3): V3 => v(p[0], p[1], -p[2])

/** Mãos e pés simétricos a partir do lado esquerdo. */
export const both = <T>(left: T, mirror: (t: T) => T): Record<Side, T> => ({ L: left, R: mirror(left) })
export const mirrorFoot = (f: Foot): Foot => ({ ankle: mirrorZ(f.ankle), toe: mirrorZ(f.toe) })

const sideSign = (s: Side) => (s === 'L' ? 1 : -1)

/** Monta o esqueleto de uma pose. */
export function solve(p: PoseSpec): Skeleton {
  const { up, front, left } = trunkFrame(p.pitch, p.yaw)
  const pelvis = p.pelvis
  const chest = add(pelvis, mul(up, SEG.trunk))
  const neck = add(chest, mul(up, SEG.neck))
  const headDir = rotate(up, left, -(p.head ?? 0)) // + = queixo para baixo (cabeça gira para a frente)
  const head = add(neck, mul(headDir, SEG.head))

  const out = {} as Omit<Skeleton, 'pelvis' | 'chest' | 'neck' | 'head' | 'up' | 'front' | 'left' | 'reachError'>
  const reachError = { hand: { L: 0, R: 0 }, foot: { L: 0, R: 0 } }
  for (const key of ['hip', 'knee', 'ankle', 'heel', 'toe', 'shoulder', 'elbow', 'wrist', 'hand'] as const) out[key] = {} as Record<Side, V3>

  for (const s of SIDES) {
    const k = sideSign(s)
    // ── perna
    const hip = add(pelvis, mul(left, k * SEG.hipHalf))
    const foot = p.feet[s]
    const kneePole = p.kneePole?.[s] ?? add(front, mul(left, k * 0.25))
    const legIk = ik2(hip, foot.ankle, LEG.a, LEG.b, kneePole)
    const ankle = legIk.tip
    // calcanhar: atrás e abaixo do tornozelo, no plano que contém o pé e a vertical do mundo
    const fwd = unit(sub(foot.toe, foot.ankle))
    let down = reject(v(0, -1, 0), fwd)
    if (len(down) < 1e-3) down = reject(mul(front, -1), fwd)
    const heel = add(add(ankle, mul(unit(down), 8.5)), mul(fwd, -4))
    out.hip[s] = hip
    out.knee[s] = legIk.mid
    out.ankle[s] = ankle
    out.heel[s] = heel
    out.toe[s] = add(ankle, sub(foot.toe, foot.ankle))
    reachError.foot[s] = legIk.error

    // ── braço
    const shoulder = add(chest, mul(left, k * SEG.shoulderHalf))
    const elbowPole = p.elbowPole?.[s] ?? add(add(mul(up, -1), mul(left, k * 0.6)), mul(front, -0.3))
    const armIk = ik2(shoulder, p.hands[s], ARM.a, ARM.b, elbowPole)
    const toHand = unit(sub(armIk.tip, armIk.mid))
    out.shoulder[s] = shoulder
    out.elbow[s] = armIk.mid
    out.wrist[s] = add(armIk.mid, mul(toHand, SEG.forearm))
    out.hand[s] = armIk.tip
    reachError.hand[s] = armIk.error
  }
  return { pelvis, chest, neck, head, up, front, left, ...out, reachError }
}

// ───────── interpolação ─────────

export type Ease = 'in' | 'out' | 'inout' | 'linear'
export const EASE: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => t * t * (3 - 2 * t),
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpPole = (a: V3 | undefined, b: V3 | undefined, t: number) => (a && b ? lerp3(unit(a), unit(b), t) : (b ?? a))
const sidesLerp = <T>(a: Record<Side, T>, b: Record<Side, T>, f: (x: T, y: T) => T): Record<Side, T> => ({ L: f(a.L, b.L), R: f(a.R, b.R) })

/** Pose intermediária (t já com a curva aplicada). */
export function mixPose(a: PoseSpec, b: PoseSpec, t: number): PoseSpec {
  const pole = (x?: Partial<Record<Side, V3>>, y?: Partial<Record<Side, V3>>) =>
    x || y ? { L: lerpPole(x?.L, y?.L, t), R: lerpPole(x?.R, y?.R, t) } : undefined
  return {
    pelvis: lerp3(a.pelvis, b.pelvis, t),
    pitch: lerp(a.pitch, b.pitch, t),
    yaw: lerp(a.yaw ?? 0, b.yaw ?? 0, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    hands: sidesLerp(a.hands, b.hands, (x, y) => lerp3(x, y, t)),
    feet: sidesLerp(a.feet, b.feet, (x, y) => ({ ankle: lerp3(x.ankle, y.ankle, t), toe: lerp3(x.toe, y.toe, t) })),
    elbowPole: pole(a.elbowPole, b.elbowPole),
    kneePole: pole(a.kneePole, b.kneePole),
  }
}

/** Ângulo interno de uma articulação (graus): 180 = reta. */
export const jointAngle = (a: V3, mid: V3, b: V3) => {
  const u = unit(sub(a, mid))
  const w = unit(sub(b, mid))
  return Math.acos(Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1] + u[2] * w[2]))) / DEG
}

export { cross }
