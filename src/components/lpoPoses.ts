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
  /**
   * Lado do cotovelo entre quadros: 0 = solução "p" da cinemática (à direita da linha ombro→mão), 1 = a outra.
   * Só a vista 3D usa: no giro o cotovelo passa por fora, pelo lado, em vez de pular de uma solução para a
   * outra. Ausente = o lado que `elbow` escolhe.
   */
  turn?: number
}

export const GROUND = 110
export const LEN = { thigh: 29, shin: 27, torso: 32, upperArm: 20, forearm: 17, neck: 5, head: 6.5, plate: 13, foot: 13 }
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
// a barra apoia nos deltoides, um pouco ACIMA da articulação do ombro: assim o braço dobra com o cotovelo
// à frente e levemente abaixo do ombro (≈ 35° da horizontal), como num rack real, e não apontando para cima
const CLEAN_CATCH = P([40, 88], 12, [55.5, 53.5], 'front')
const RACK = P([59, 51], 0, [66.5, 15.5], 'front')

// jerk
const DIP = P([59, 58], 0, [66.5, 22.5], 'front')
const DRIVE = P([59, 46], 0, [63, -3], 'front', 7)
const SPLIT = P([57, 61], 0, [60, -7.8], 'back', 0, 76, 38, 7)

type Ease = 'in' | 'out' | 'inout'

/**
 * [pose, ms até chegar nela, ms parada nela, nome da fase, curva, arco]. Arco = quanto a barra se afasta para a
 * frente no meio da transição (em linha reta ela passaria por dentro do tronco/ombro).
 */
export type Frame = [Pose, number, number, string, Ease?, number?]

export const SEQUENCES: Record<LpoAnimation, { frames: Frame[]; caption: string }> = {
  snatch: {
    caption: 'Arranco: puxada do chão, tripla extensão e recepção em agachamento com a barra acima da cabeça.',
    frames: [
      [SETUP, 800, 500, 'Posição inicial', 'inout', 12],
      [KNEE, 550, 0, '1ª puxada', 'in'],
      [POWER, 250, 0, 'Transição'],
      [EXTENSION, 170, 120, '2ª puxada', 'in'],
      [SNATCH_UNDER, 200, 0, 'Puxada por baixo', 'out', 8],
      [SNATCH_CATCH, 230, 650, 'Recepção', 'out'],
      [OVERHEAD, 1000, 800, 'Recuperação'],
    ],
  },
  'snatch-hang': {
    caption: 'Arranco suspenso: começa em pé, desce a barra até acima dos joelhos e explode.',
    frames: [
      [STAND_HANG, 700, 500, 'Em pé', 'inout', 12],
      [HANG, 650, 200, 'Suspenso'],
      [EXTENSION, 200, 120, '2ª puxada', 'in'],
      [SNATCH_UNDER, 200, 0, 'Puxada por baixo', 'out', 8],
      [SNATCH_CATCH, 230, 650, 'Recepção', 'out'],
      [OVERHEAD, 1000, 800, 'Recuperação'],
    ],
  },
  clean: {
    caption: 'Clean: puxada do chão, tripla extensão e recepção da barra nos ombros em agachamento frontal.',
    frames: [
      [SETUP, 800, 500, 'Posição inicial', 'inout', 12],
      [KNEE, 550, 0, '1ª puxada', 'in'],
      [POWER, 250, 0, 'Transição'],
      [EXTENSION, 170, 120, '2ª puxada', 'in'],
      [CLEAN_UNDER, 200, 0, 'Giro dos cotovelos', 'out', 5],
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

/** As duas soluções do cotovelo para a pose (sempre na mesma ordem: varia de forma contínua com o braço). */
function elbowSolutions(p: Pose): [Pt, Pt, Skeleton] {
  const s = skeleton(p)
  return [ik(s.shoulder, s.hand, LEN.upperArm, LEN.forearm, (a) => a), ik(s.shoulder, s.hand, LEN.upperArm, LEN.forearm, (_, b) => b), s]
}
const turnOf = (p: Pose) => {
  if (p.turn !== undefined) return p.turn
  const [first, , s] = elbowSolutions(p)
  return dist(s.elbow, first) < 1e-6 ? 0 : 1
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
    // o cotovelo troca de lado no meio do caminho (giro dos cotovelos no clean); na vista 3D o giro é contínuo
    elbow: e < 0.5 ? a.elbow : b.elbow,
    turn: lerp(turnOf(a), turnOf(b), e),
  }
}

export const RETURN_LABEL = 'Volta ao início'

export const cycleMs =(frames: Frame[]) => frames.reduce((a, [, move, hold]) => a + move + hold, 0)

/** Pose e fase no instante `ms` do ciclo (a primeira transição parte da última pose: o ciclo fecha). */
export function frameAt(frames: Frame[], ms: number): { pose: Pose; label: string } {
  let t = ms % cycleMs(frames)
  for (let i = 0; i < frames.length; i++) {
    const [pose, move, hold, label, ease, arc = 0] = frames[i]
    const from = frames[(i - 1 + frames.length) % frames.length][0]
    if (t < move) {
      const p = mix(from, pose, t / move, ease)
      // arco: a barra passa à frente do tronco (na volta, desce à frente do rosto; na puxada por baixo,
      // o pequeno "laço" para a frente que a trajetória real tem)
      if (arc) p.bar = [p.bar[0] + arc * Math.sin((Math.PI * t) / move), p.bar[1]]
      // a volta do fim ao começo não é uma fase do movimento
      return { pose: p, label: i === 0 ? RETURN_LABEL : label }
    }
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

// ───────── vista 3/4 (como os GIFs do dataset) ─────────
//
// O movimento acontece no plano de perfil (x à frente, y para baixo, como no SVG); a largura do corpo
// e a barra ficam no eixo z (positivo = lado de cá, perto da câmera). A câmera fica à frente e à esquerda
// do atleta, um pouco acima (projeção ortográfica): dá para ver as duas anilhas, como nos GIFs da Gym Visual,
// sem perder a leitura da trajetória da barra.

export type P3 = [number, number, number]

export const CAM = { yaw: 38, pitch: 12 }
const CY = Math.cos(rad(CAM.yaw))
const SY = Math.sin(rad(CAM.yaw))
const CP = Math.cos(rad(CAM.pitch))
const SP = Math.sin(rad(CAM.pitch))

/** Ponto 3D → tela (unidades do viewBox). */
export const project = ([x, y, z]: P3): Pt => [x * CY - z * SY, x * SY * SP + y * CP + z * CY * SP]
/** Vetor unitário que aponta para a câmera (para saber o que está de frente para ela). */
export const TO_CAM: P3 = [SY * CP, -SP, CY * CP]

/** Meia-largura de cada junta (z) e da pegada; barra olímpica com anilhas de 45 cm em escala. */
export const HALF = { hip: 6.5, knee: 7, ankle: 7.5, shoulder: 11.5 }
export const GRIP = { snatch: 29, clean: 16 }
export const BAR = { collar: 41, plateIn: 43, plateOut: 48, end: 70 }
export const gripFor = (id: LpoAnimation) => (id === 'snatch' || id === 'snatch-hang' ? GRIP.snatch : GRIP.clean)

export interface Side3 {
  hip: P3
  knee: P3
  ankle: P3
  heel: P3
  toe: P3
  shoulder: P3
  elbow: P3
  hand: P3
}

/** Esqueleto em 3D: lado de lá (z < 0, perna de trás no split) e lado de cá. */
export interface Rig {
  s: Skeleton
  far: Side3
  near: Side3
  grip: number
}

export function rig(p: Pose, grip: number = GRIP.clean): Rig {
  const [first, second, s] = elbowSolutions(p)
  const at = (q: Pt, z: number): P3 => [q[0], q[1], z]
  // giro do cotovelo: as duas soluções da cinemática ficam nas pontas de um círculo em volta da linha
  // ombro–mão; no meio do giro o cotovelo sai para o lado (z), como no movimento de verdade
  const mid: Pt = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
  const phi = Math.PI * Math.min(1, Math.max(0, turnOf(p)))
  const c = Math.cos(phi)
  const elbow2: Pt = [mid[0] + (first[0] - mid[0]) * c, mid[1] + (first[1] - mid[1]) * c]
  const out = (dist(first, second) / 2) * Math.sin(phi)
  const side = (k: -1 | 1): Side3 => {
    const l = s.legs[k < 0 ? 0 : 1]
    return {
      hip: at(s.hip, k * HALF.hip),
      knee: at(l.knee, k * HALF.knee),
      ankle: at(l.ankle, k * HALF.ankle),
      heel: at(l.heel, k * HALF.ankle),
      toe: at(l.toe, k * HALF.ankle),
      shoulder: at(s.shoulder, k * HALF.shoulder),
      // o cotovelo abre entre o ombro e a mão (pegada mais larga que os ombros)
      elbow: at(elbow2, k * (HALF.shoulder + (grip - HALF.shoulder) * 0.55 + out)),
      hand: at(s.hand, k * grip),
    }
  }
  return { s, far: side(-1), near: side(1), grip }
}

/** Pontos de contorno de um quadro (com o raio de cada um), para enquadrar a figura. */
export function outline(r: Rig): [Pt, number][] {
  const pts: [Pt, number][] = []
  for (const sd of [r.far, r.near]) for (const q of Object.values(sd)) pts.push([project(q), 6])
  for (const k of [-1, 1]) {
    const c = r.s.bar
    // anilha: disco no plano xy → a extensão projetada cabe no raio
    pts.push([project([c[0], c[1], k * BAR.plateOut]), LEN.plate + 1])
    pts.push([project([c[0], c[1], k * BAR.plateIn]), LEN.plate + 1])
    pts.push([project([c[0], c[1], k * BAR.end]), 1.5])
  }
  pts.push([project([r.s.head[0], r.s.head[1], 0]), LEN.head + 2])
  return pts
}

export type Box = [number, number, number, number]

/**
 * Enquadramento quadrado de cada animação, calculado varrendo todos os quadros do ciclo: nada sai do
 * quadro e a figura ocupa o máximo dele (como cada GIF do dataset, que é enquadrado no seu movimento).
 */
export function viewBoxFor(id: LpoAnimation): Box {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  const { frames } = SEQUENCES[id]
  const T = cycleMs(frames)
  for (let t = 0; t <= T; t += 20) {
    for (const [[x, y], rr] of outline(rig(poseAt(frames, t), gripFor(id)))) {
      x0 = Math.min(x0, x - rr)
      x1 = Math.max(x1, x + rr)
      y0 = Math.min(y0, y - rr)
      y1 = Math.max(y1, y + rr)
    }
  }
  const pad = 3
  const size = Math.max(x1 - x0, y1 - y0) + 2 * pad
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return [cx - size / 2, cy - size / 2, size, size].map((v) => Math.round(v * 10) / 10) as Box
}

export const VIEWBOX = Object.fromEntries(Object.keys(SEQUENCES).map((id) => [id, viewBoxFor(id as LpoAnimation)])) as Record<LpoAnimation, Box>
