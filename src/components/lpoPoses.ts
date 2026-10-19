import type { LpoAnimation } from '../data/lpo'

/**
 * Animações de LPO: atleta de perfil (virado para a direita), câmera um pouco à frente (3/4 leve).
 *
 * Cada pose diz onde estão o quadril, os pés, a inclinação do tronco e a BARRA; joelhos e cotovelos saem
 * por cinemática inversa de 2 segmentos. Assim a mão sempre segura a barra e dá para verificar em teste
 * o que importa na técnica: barra sobre o meio do pé, rente ao corpo, anilha no chão no início.
 *
 * Unidades do viewBox: chão em y = 110; atleta em pé ≈ 120 de altura; anilha olímpica (45 cm) em escala.
 * Ângulos em graus a partir da vertical para cima; positivo = para a frente.
 */

export type Pt = [number, number]

export interface Pose {
  hip: Pt
  /** Pés: x do tornozelo e quanto o calcanhar está erguido (ponta do pé fica no chão). */
  front: [number, number]
  back: [number, number]
  /** Inclinação do tronco (quadril → ombro). */
  torso: number
  /** Centro da barra (vista de lado = centro da anilha). */
  bar: Pt
  /** Para onde o cotovelo aponta quando o braço dobra: à frente (rack do clean) ou atrás/acima (puxada). */
  elbow: 'front' | 'back'
}

export const GROUND = 110
export const LEN = { thigh: 29, shin: 27, torso: 32, upperArm: 20, forearm: 17, neck: 5, head: 6.5, plate: 13, foot: 13 }
/** Deslocamento do lado de lá do corpo (dá profundidade) e da anilha do outro lado da barra. */
export const DEPTH: Pt = [3, -2]
export const PLATE_DEPTH: Pt = [8, -5]
/** Meio do pé = tornozelo + 3,5 (onde a barra deve passar). */
export const MIDFOOT = 3.5

const P = (hip: Pt, torso: number, bar: Pt, elbow: Pose['elbow'] = 'back', lift = 0, front = 60, back = 60, backLift = lift): Pose => ({
  hip,
  front: [front, lift],
  back: [back, backLift],
  torso,
  bar,
  elbow,
})

// ───────── posições (comuns às puxadas) ─────────
const SETUP = P([40.5, 78.7], 55, [63.5, 97]) // anilha no chão, ombros à frente da barra, braços estendidos
const KNEE = P([42, 61.5], 50, [64, 77.8]) // fim da 1ª puxada: barra passa o joelho, costas no mesmo ângulo
const POWER = P([49, 55], 20, [62, 60.5]) // posição de potência: barra no meio/alto da coxa
const EXTENSION = P([57.5, 46], -8, [58.5, 50.5], 'back', 7) // 2ª puxada: tripla extensão, na ponta dos pés
const HANG = P([48, 57], 33, [64.5, 67.1]) // suspenso: barra logo acima do joelho
const STAND_HANG = P([59, 51], 0, [60, 55.9]) // em pé, barra na coxa (braços estendidos)

// arranco
const SNATCH_UNDER = P([52, 68], 8, [59.5, 21], 'back', 2)
const SNATCH_CATCH = P([40, 88], 28, [62, 23.8])
const OVERHEAD = P([59, 51], 0, [61, -17.9])

// arremesso (clean): barra sobre os ombros, cotovelos altos à frente
const CLEAN_UNDER = P([51, 72], 8, [61, 36], 'front', 2)
const CLEAN_CATCH = P([40, 88], 12, [55, 58.5], 'front')
const RACK = P([59, 51], 0, [66.5, 21.5], 'front')

// jerk
const DIP = P([59, 58], 0, [66.5, 28.5], 'front')
const DRIVE = P([59, 46], 0, [63, -3], 'front', 7)
const SPLIT = P([57, 61], 0, [60, -7.8], 'back', 0, 76, 38, 7)

type Ease = 'in' | 'out' | 'inout'

/** [pose, ms até chegar nela, ms parada nela, nome da fase, curva] */
export type Frame = [Pose, number, number, string, Ease?]

export const SEQUENCES: Record<LpoAnimation, { frames: Frame[]; caption: string }> = {
  snatch: {
    caption: 'Arranco: puxada do chão, tripla extensão e recepção em agachamento com a barra acima da cabeça.',
    frames: [
      [SETUP, 800, 500, 'Posição inicial'],
      [KNEE, 550, 0, '1ª puxada', 'in'],
      [POWER, 250, 0, 'Transição'],
      [EXTENSION, 170, 120, '2ª puxada', 'in'],
      [SNATCH_UNDER, 200, 0, 'Puxada por baixo', 'out'],
      [SNATCH_CATCH, 230, 650, 'Recepção', 'out'],
      [OVERHEAD, 1000, 800, 'Recuperação'],
    ],
  },
  'snatch-hang': {
    caption: 'Arranco suspenso: começa em pé, desce a barra até acima dos joelhos e explode.',
    frames: [
      [STAND_HANG, 700, 500, 'Em pé'],
      [HANG, 650, 200, 'Suspenso'],
      [EXTENSION, 200, 120, '2ª puxada', 'in'],
      [SNATCH_UNDER, 200, 0, 'Puxada por baixo', 'out'],
      [SNATCH_CATCH, 230, 650, 'Recepção', 'out'],
      [OVERHEAD, 1000, 800, 'Recuperação'],
    ],
  },
  clean: {
    caption: 'Clean: puxada do chão, tripla extensão e recepção da barra nos ombros em agachamento frontal.',
    frames: [
      [SETUP, 800, 500, 'Posição inicial'],
      [KNEE, 550, 0, '1ª puxada', 'in'],
      [POWER, 250, 0, 'Transição'],
      [EXTENSION, 170, 120, '2ª puxada', 'in'],
      [CLEAN_UNDER, 200, 0, 'Giro dos cotovelos', 'out'],
      [CLEAN_CATCH, 230, 650, 'Recepção', 'out'],
      [RACK, 1000, 800, 'Recuperação'],
    ],
  },
  jerk: {
    caption: 'Jerk: flexão curta dos joelhos, impulsão e recepção com as pernas afastadas (split).',
    frames: [
      [RACK, 700, 600, 'Rack'],
      [DIP, 380, 100, 'Flexão (dip)', 'out'],
      [DRIVE, 160, 40, 'Impulsão', 'in'],
      [SPLIT, 220, 700, 'Recepção em split', 'out'],
      [OVERHEAD, 800, 700, 'Recuperação'],
    ],
  },
  pull: {
    caption: 'Tripla extensão: da posição de potência, estende quadril, joelhos e tornozelos e encolhe os ombros.',
    frames: [
      [POWER, 600, 500, 'Posição de potência'],
      [EXTENSION, 220, 400, 'Tripla extensão', 'in'],
      [POWER, 600, 200, 'Volta controlada', 'out'],
    ],
  },
}

// ───────── interpolação ─────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const EASE: Record<Ease, (t: number) => number> = {
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => t * t * (3 - 2 * t),
}

export function mix(a: Pose, b: Pose, t: number, ease: Ease = 'inout'): Pose {
  const e = EASE[ease](Math.min(1, Math.max(0, t)))
  const pair = <T extends number[]>(x: T, y: T) => x.map((v, i) => lerp(v, y[i], e)) as T
  return {
    hip: pair(a.hip, b.hip),
    front: pair(a.front, b.front),
    back: pair(a.back, b.back),
    torso: lerp(a.torso, b.torso, e),
    bar: pair(a.bar, b.bar),
    // o cotovelo troca de lado no meio do caminho (giro dos cotovelos no clean)
    elbow: e < 0.5 ? a.elbow : b.elbow,
  }
}

export const RETURN_LABEL = 'Volta ao início'

export const cycleMs =(frames: Frame[]) => frames.reduce((a, [, move, hold]) => a + move + hold, 0)

/** Pose e fase no instante `ms` do ciclo (a primeira transição parte da última pose: o ciclo fecha). */
export function frameAt(frames: Frame[], ms: number): { pose: Pose; label: string } {
  let t = ms % cycleMs(frames)
  for (let i = 0; i < frames.length; i++) {
    const [pose, move, hold, label, ease] = frames[i]
    const from = frames[(i - 1 + frames.length) % frames.length][0]
    // a volta do fim ao começo não é uma fase do movimento
    if (t < move) return { pose: mix(from, pose, t / move, ease), label: i === 0 ? RETURN_LABEL : label }
    t -= move
    if (t < hold) return { pose, label }
    t -= hold
  }
  const last = frames[frames.length - 1]
  return { pose: last[0], label: last[3] }
}

export const poseAt = (frames: Frame[], ms: number) => frameAt(frames, ms).pose

// ───────── cinemática ─────────

const rad = (deg: number) => (deg * Math.PI) / 180
export const seg = (o: Pt, deg: number, len: number): Pt => [o[0] + Math.sin(rad(deg)) * len, o[1] - Math.cos(rad(deg)) * len]
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Junta do meio de uma cadeia de 2 segmentos (a: raiz→meio, b: meio→ponta). Entre as duas soluções,
 * `pick` escolhe. Ponta fora de alcance: o membro estica na direção dela (os testes garantem que não acontece).
 */
export function ik(root: Pt, tip: Pt, a: number, b: number, pick: (p: Pt, q: Pt) => Pt): Pt {
  const dx = tip[0] - root[0]
  const dy = tip[1] - root[1]
  const d = Math.min(Math.max(Math.hypot(dx, dy), 1e-6), a + b - 1e-6)
  const along = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - along * along))
  const n = Math.hypot(dx, dy) || 1
  const ux = dx / n
  const uy = dy / n
  const px = root[0] + along * ux
  const py = root[1] + along * uy
  return pick([px - h * uy, py + h * ux], [px + h * uy, py - h * ux])
}

/** Joelho sempre à frente. */
export const knee = (hip: Pt, ankle: Pt) => ik(hip, ankle, LEN.thigh, LEN.shin, (p, q) => (p[0] >= q[0] ? p : q))

export interface Leg {
  ankle: Pt
  knee: Pt
  heel: Pt
  toe: Pt
}

export interface Skeleton {
  hip: Pt
  shoulder: Pt
  neck: Pt
  head: Pt
  elbow: Pt
  hand: Pt
  /** Lado de lá (perna de trás no split) e lado de cá. */
  legs: [Leg, Leg]
  bar: Pt
  barFar: Pt
}

function leg(hip: Pt, [x, lift]: [number, number]): Leg {
  const ankle: Pt = [x, GROUND - 3 - lift]
  // a ponta do pé fica no chão; o calcanhar sobe junto com o tornozelo
  const toe: Pt = [x + LEN.foot - 3, GROUND]
  const heel: Pt = [x - 3, Math.min(GROUND, ankle[1] + 2.5)]
  return { ankle, knee: knee(hip, ankle), heel, toe }
}

export function skeleton(p: Pose): Skeleton {
  const shoulder = seg(p.hip, p.torso, LEN.torso)
  const neck = seg(shoulder, p.torso, LEN.neck)
  // cabeça à frente do prolongamento do tronco: olhar para a frente e, com a barra no alto,
  // a cabeça passa à frente dos braços ("cabeça pela janela"), como num lockout correto
  const head = add(seg(neck, p.torso, LEN.head), [4, 0])
  const bar = reachable(shoulder, p.bar)
  const front = p.elbow === 'front'
  const elbow = ik(shoulder, bar, LEN.upperArm, LEN.forearm, (a, b) => ((a[0] >= b[0]) === front ? a : b))
  return {
    hip: p.hip,
    shoulder,
    neck,
    head,
    elbow,
    hand: bar,
    legs: [leg(p.hip, p.back), leg(p.hip, p.front)],
    bar,
    barFar: add(bar, PLATE_DEPTH),
  }
}

const ARM_MAX = LEN.upperArm + LEN.forearm - 0.01
const ARM_MIN = Math.abs(LEN.upperArm - LEN.forearm) + 0.01

/**
 * A barra está nas mãos: entre dois quadros-chave, a interpolação linear pode pedir um braço mais longo
 * (ou curto) que o real; aí a barra acompanha a mão, na direção pedida. Os quadros-chave nunca caem
 * aqui (teste "quadros-chave ao alcance").
 */
export function reachable(shoulder: Pt, bar: Pt): Pt {
  const d = dist(shoulder, bar)
  if (d <= ARM_MAX && d >= ARM_MIN) return bar
  const k = Math.min(ARM_MAX, Math.max(ARM_MIN, d)) / (d || 1)
  return [shoulder[0] + (bar[0] - shoulder[0]) * k, shoulder[1] + (bar[1] - shoulder[1]) * k]
}

/** Mesmo esqueleto, deslocado para o lado de lá do corpo. */
export const farSide = (s: Skeleton): Skeleton => {
  const o = (q: Pt) => add(q, DEPTH)
  const l = (g: Leg): Leg => ({ ankle: o(g.ankle), knee: o(g.knee), heel: o(g.heel), toe: o(g.toe) })
  return { ...s, hip: o(s.hip), shoulder: o(s.shoulder), elbow: o(s.elbow), hand: o(s.hand), legs: [l(s.legs[0]), l(s.legs[1])] }
}
