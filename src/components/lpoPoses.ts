import type { LpoAnimation } from '../data/lpo'

/**
 * Bonecos das animações de LPO (vista lateral, atleta virado para a direita).
 * Uma pose define quadril, pés, inclinação do tronco e ângulos dos braços; o joelho sai por
 * cinemática inversa (2 segmentos), então os pés ficam sempre no chão entre as poses.
 * Ângulos em graus a partir da vertical para cima; positivo = para a frente.
 * Unidades do viewBox: chão em y = 110; perna em pé ≈ 52.
 */

export interface Pose {
  hip: [number, number]
  /** Pé da frente e de trás: x e quanto está erguido (ponta do pé). */
  front: [number, number]
  back: [number, number]
  torso: number
  upperArm: number
  forearm: number
}

export const GROUND = 110
export const LEN = { thigh: 26, shin: 26, torso: 30, upperArm: 18, forearm: 16, head: 6, plate: 9 }

const STAND: Pose = { hip: [58, 58], front: [60, 0], back: [60, 0], torso: 0, upperArm: 180, forearm: 180 }

const P = (hip: [number, number], torso: number, upperArm: number, forearm: number, lift = 0, front = 60, back = 60, backLift = lift): Pose => ({
  hip,
  front: [front, lift],
  back: [back, backLift],
  torso,
  upperArm,
  forearm,
})

// fases comuns da puxada
const SETUP = P([46, 86], 50, 180, 180)
const KNEE = P([48, 72], 48, 180, 180)
const POWER = P([56, 62], 15, 180, 180)
const EXTENSION = P([58, 56], -12, 175, 175, 6)
const HANG = P([52, 66], 32, 180, 180)
// arranco: puxar-se para baixo da barra e receber acima da cabeça
const SNATCH_UNDER = P([54, 72], 5, 30, 0)
const SNATCH_CATCH = P([44, 90], 25, -5, 0)
const OVERHEAD = P([58, 58], 0, 0, 0)
// arremesso: barra sobre os ombros (rack)
const CLEAN_UNDER = P([52, 76], 8, 75, -40)
const CLEAN_CATCH = P([44, 90], 15, 75, -60)
const RACK = P([58, 58], 0, 78, -80)
const DIP = P([60, 64], 0, 78, -80)
const DRIVE = P([58, 56], 0, 30, 0, 6)
const SPLIT = P([56, 68], 0, -3, 0, 0, 76, 36, 3)

/** [pose, duração da transição até ela em ms, pausa nela em ms] */
export type Frame = [Pose, number, number]

export const SEQUENCES: Record<LpoAnimation, { frames: Frame[]; caption: string }> = {
  snatch: {
    caption: 'Arranco: puxada do chão, tripla extensão e recepção em agachamento com a barra acima da cabeça.',
    frames: [
      [SETUP, 500, 400],
      [KNEE, 500, 0],
      [POWER, 300, 0],
      [EXTENSION, 180, 60],
      [SNATCH_UNDER, 200, 0],
      [SNATCH_CATCH, 220, 450],
      [OVERHEAD, 800, 700],
    ],
  },
  'snatch-hang': {
    caption: 'Arranco suspenso: começa em pé, desce a barra até acima dos joelhos e explode.',
    frames: [
      [STAND, 500, 400],
      [HANG, 500, 150],
      [EXTENSION, 220, 60],
      [SNATCH_UNDER, 200, 0],
      [SNATCH_CATCH, 220, 450],
      [OVERHEAD, 800, 700],
    ],
  },
  clean: {
    caption: 'Clean: puxada do chão, tripla extensão e recepção da barra nos ombros em agachamento frontal.',
    frames: [
      [SETUP, 500, 400],
      [KNEE, 500, 0],
      [POWER, 300, 0],
      [EXTENSION, 180, 60],
      [CLEAN_UNDER, 200, 0],
      [CLEAN_CATCH, 220, 450],
      [RACK, 800, 700],
    ],
  },
  jerk: {
    caption: 'Jerk: flexão curta dos joelhos, impulsão e recepção com as pernas afastadas (split).',
    frames: [
      [RACK, 500, 500],
      [DIP, 350, 80],
      [DRIVE, 160, 40],
      [SPLIT, 220, 600],
      [OVERHEAD, 700, 600],
    ],
  },
  pull: {
    caption: 'Tripla extensão: da posição de potência, estende quadril, joelhos e tornozelos e encolhe os ombros.',
    frames: [
      [POWER, 500, 400],
      [EXTENSION, 250, 300],
      [POWER, 500, 200],
    ],
  },
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)

export function mix(a: Pose, b: Pose, t: number): Pose {
  const e = ease(Math.min(1, Math.max(0, t)))
  const pair = (x: [number, number], y: [number, number]): [number, number] => [lerp(x[0], y[0], e), lerp(x[1], y[1], e)]
  return {
    hip: pair(a.hip, b.hip),
    front: pair(a.front, b.front),
    back: pair(a.back, b.back),
    torso: lerp(a.torso, b.torso, e),
    upperArm: lerp(a.upperArm, b.upperArm, e),
    forearm: lerp(a.forearm, b.forearm, e),
  }
}

export const cycleMs = (frames: Frame[]) => frames.reduce((a, [, move, hold]) => a + move + hold, 0)

/** Pose no instante `ms` do ciclo (a primeira transição parte da última pose: o ciclo fecha). */
export function poseAt(frames: Frame[], ms: number): Pose {
  let t = ms % cycleMs(frames)
  for (let i = 0; i < frames.length; i++) {
    const [pose, move, hold] = frames[i]
    const from = frames[(i - 1 + frames.length) % frames.length][0]
    if (t < move) return mix(from, pose, t / move)
    t -= move
    if (t < hold) return pose
    t -= hold
  }
  return frames[frames.length - 1][0]
}

type Pt = [number, number]
const seg = (o: Pt, deg: number, len: number): Pt => [o[0] + Math.sin((deg * Math.PI) / 180) * len, o[1] - Math.cos((deg * Math.PI) / 180) * len]

/** Joelho entre quadril e tornozelo, sempre à frente (cinemática inversa de 2 segmentos). */
export function knee(hip: Pt, ankle: Pt): Pt {
  const { thigh: a, shin: b } = LEN
  const dx = ankle[0] - hip[0]
  const dy = ankle[1] - hip[1]
  const d = Math.min(Math.hypot(dx, dy), a + b - 0.01)
  const along = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - along * along))
  const ux = dx / d
  const uy = dy / d
  const px = hip[0] + along * ux
  const py = hip[1] + along * uy
  const k1: Pt = [px - h * uy, py + h * ux]
  const k2: Pt = [px + h * uy, py - h * ux]
  return k1[0] >= k2[0] ? k1 : k2
}

export interface Skeleton {
  hip: Pt
  shoulder: Pt
  head: Pt
  elbow: Pt
  hand: Pt
  legs: { ankle: Pt; knee: Pt; toe: Pt }[]
}

export function skeleton(p: Pose): Skeleton {
  const shoulder = seg(p.hip, p.torso, LEN.torso)
  const head = seg(shoulder, p.torso, LEN.head + 3)
  const elbow = seg(shoulder, p.upperArm, LEN.upperArm)
  const hand = seg(elbow, p.forearm, LEN.forearm)
  const legs = [p.back, p.front].map(([x, lift]) => {
    const ankle: Pt = [x, GROUND - 3 - lift]
    return { ankle, knee: knee(p.hip, ankle), toe: [x + 8, GROUND - Math.max(0, lift - 4)] as Pt }
  })
  return { hip: p.hip, shoulder, head, elbow, hand, legs }
}
