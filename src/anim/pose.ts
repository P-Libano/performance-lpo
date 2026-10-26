import { ARM, LEG, SEG, SIDES, type Side, type Skeleton } from './body'
import { DEG, add, cross, dist, dot, len, lerp3, mul, reject, rotate, sub, unit, v, type V3 } from './vec'

/**
 * Pose = pontos de contato + orientação do tronco. Quem desenha um exercício diz ONDE ficam pelve, mãos e
 * pés; cotovelos e joelhos saem da cinemática inversa (2 ossos + vetor-guia), então o comprimento dos ossos é
 * sempre o real e dá para verificar se a pose é alcançável (reachError).
 */

/**
 * Pé: tornozelo e ponta do pé (onde o pé toca/aponta). O calcanhar é derivado: fica do lado da SOLA, que é o
 * lado para onde a canela aponta (joelho → tornozelo). Em pé é "para baixo"; no leg press a sola fica virada
 * para a plataforma; no búlgaro, o peito do pé de trás apoia no banco. `sole` força a direção da sola.
 */
export interface Foot {
  ankle: V3
  toe: V3
  sole?: V3
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
  /**
   * Giro do tronco em torno do próprio eixo (pelve → peito), em graus; + = o peito vira para a esquerda do
   * atleta. Ex.: prancha com rotação (de bruços → de lado), rotação de tronco.
   */
  twist?: number
  /** Cabeça em relação ao tronco (graus; + = queixo para baixo). */
  head?: number
  /** Centro de cada mão (pegada). Com `palms`, o ponto da superfície sob o centro da palma. */
  hands: Record<Side, V3>
  /**
   * Palma apoiada (chão, banco): 1 = palma inteira na superfície com o punho dobrado (burpee, flexão);
   * 0/ausente = mão em linha com o antebraço. Valores intermediários na transição.
   */
  palms?: Partial<Record<Side, number>>
  /**
   * Barra apoiada na frente dos ombros (encaixe do clean, agachamento frontal): 1 = punho dobrado para trás,
   * 6 cm à frente e 3 cm abaixo da barra, palma para cima sob ela; o centro da mão continua na barra.
   * 0/ausente = mão em linha com o antebraço. Valores intermediários na transição.
   */
  rack?: Partial<Record<Side, number>>
  feet: Record<Side, Foot>
  /** Para onde aponta cada cotovelo/joelho (direção no mundo). Ausente = padrão anatômico. */
  elbowPole?: Partial<Record<Side, V3>>
  kneePole?: Partial<Record<Side, V3>>
}

/** Referencial do tronco a partir de pitch/yaw. */
export function trunkFrame(pitch: number, yaw = 0, twist = 0): { up: V3; front: V3; left: V3 } {
  const Z = v(0, 0, 1)
  const Y = v(0, 1, 0)
  // pitch: gira em torno do eixo esquerdo; positivo leva o "para cima" do tronco para +x (à frente)
  let up = rotate(v(0, 1, 0), Z, -pitch)
  let front = rotate(v(1, 0, 0), Z, -pitch)
  let left = Z
  if (twist) {
    // em torno do próprio eixo: + leva o peito para a esquerda do atleta
    // (rotação positiva em torno de `up` leva a frente para a direita; por isso o sinal invertido)
    front = rotate(front, up, -twist)
    left = rotate(left, up, -twist)
  }
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

// calcanhar no referencial do pé (eixo tornozelo → ponta e a perpendicular para a sola): com o pé apoiado,
// cai no chão SEG.heel atrás do tornozelo
const FOOT_LEN = Math.hypot(SEG.toe, SEG.ankleHeight)
const HEEL_DOWN = (SEG.ankleHeight * (SEG.heel + SEG.toe)) / FOOT_LEN
const HEEL_FWD = (SEG.ankleHeight ** 2 - SEG.heel * SEG.toe) / FOOT_LEN

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

/** Ombros da pose (independem das mãos): base para calcular mãos relativas ao ombro. */
export const shouldersOf = (p: Omit<PoseSpec, 'hands'>): Record<Side, V3> =>
  solve({ ...p, hands: { L: p.pelvis, R: p.pelvis } } as PoseSpec).shoulder

/**
 * Braços estendidos ao lado do corpo (halteres na rosca, afundo, encolhimento): mão na vertical do ombro,
 * deslocada `out` cm para fora (z) e `fwd` cm para a frente (x). Sem precisar calcular o x do ombro à mão.
 */
export function armsAtSides(p: Omit<PoseSpec, 'hands'>, out = 3, fwd = 0, straight = 0.996): Record<Side, V3> {
  const sh = shouldersOf(p)
  const reach = (ARM.a + ARM.b) * straight
  const at = (s: Side): V3 => {
    const k = s === 'L' ? 1 : -1
    return v(sh[s][0] + fwd, sh[s][1] - Math.sqrt(Math.max(0, reach * reach - fwd * fwd - out * out)), sh[s][2] + k * out)
  }
  return { L: at('L'), R: at('R') }
}

/**
 * Espelha a pose inteira (esquerda ↔ direita): troca mãos, pés e guias de lado, inverte z, giro (`yaw`) e
 * rotação do tronco (`twist`). Para exercícios unilaterais/alternados descreverem o outro lado.
 */
export function mirrorPose(p: PoseSpec): PoseSpec {
  const swap = <T>(r: Partial<Record<Side, T>> | undefined, f: (t: T) => T) => (r ? { L: r.R && f(r.R), R: r.L && f(r.L) } : undefined)
  const foot = (f: Foot): Foot => ({ ankle: mirrorZ(f.ankle), toe: mirrorZ(f.toe), ...(f.sole ? { sole: mirrorZ(f.sole) } : {}) })
  return {
    ...p,
    pelvis: mirrorZ(p.pelvis),
    yaw: -(p.yaw ?? 0),
    twist: -(p.twist ?? 0),
    hands: { L: mirrorZ(p.hands.R), R: mirrorZ(p.hands.L) },
    feet: { L: foot(p.feet.R), R: foot(p.feet.L) },
    elbowPole: swap(p.elbowPole, mirrorZ) as PoseSpec['elbowPole'],
    kneePole: swap(p.kneePole, mirrorZ) as PoseSpec['kneePole'],
    ...(p.rack ? { rack: { L: p.rack.R, R: p.rack.L } } : {}),
  }
}

/** Espelha um ponto do lado esquerdo (z+) para o direito. */
export const mirrorZ = (p: V3): V3 => v(p[0], p[1], -p[2])

/** Mãos e pés simétricos a partir do lado esquerdo. */
export const both = <T>(left: T, mirror: (t: T) => T): Record<Side, T> => ({ L: left, R: mirror(left) })
export const mirrorFoot = (f: Foot): Foot => ({ ankle: mirrorZ(f.ankle), toe: mirrorZ(f.toe) })

const sideSign = (s: Side) => (s === 'L' ? 1 : -1)

/** Punho em relação à barra com ela apoiada nos ombros (`rack`), cm. */
const RACK_WRIST = { fwd: 6, down: 3 }

/** Monta o esqueleto de uma pose. */
export function solve(p: PoseSpec): Skeleton {
  const { up, front, left } = trunkFrame(p.pitch, p.yaw, p.twist)
  const pelvis = p.pelvis
  const chest = add(pelvis, mul(up, SEG.trunk))
  const neck = add(chest, mul(up, SEG.neck))
  const headDir = rotate(up, left, -(p.head ?? 0)) // + = queixo para baixo (cabeça gira para a frente)
  const head = add(neck, mul(headDir, SEG.head))

  const out = {} as Omit<Skeleton, 'pelvis' | 'chest' | 'neck' | 'head' | 'up' | 'front' | 'left' | 'palm' | 'reachError'>
  const reachError = { hand: { L: 0, R: 0 }, foot: { L: 0, R: 0 } }
  const palm = { L: 0, R: 0 }
  for (const key of ['hip', 'knee', 'ankle', 'heel', 'toe', 'shoulder', 'elbow', 'wrist', 'hand'] as const) out[key] = {} as Record<Side, V3>

  for (const s of SIDES) {
    const k = sideSign(s)
    // ── perna
    const hip = add(pelvis, mul(left, k * SEG.hipHalf))
    const foot = p.feet[s]
    // padrão: o joelho dobra na direção da ponta do pé (um pouco para fora). NÃO usar a frente do tronco:
    // com o tronco inclinado (terra, agachamento) ela aponta para baixo e o joelho abria para o lado.
    const toeDir = unit(sub(foot.toe, foot.ankle))
    const kneePole = p.kneePole?.[s] ?? add(toeDir, mul(v(-toeDir[2], 0, toeDir[0]), k * 0.1))
    const legIk = ik2(hip, foot.ankle, LEG.a, LEG.b, kneePole)
    const ankle = legIk.tip
    // calcanhar: atrás do tornozelo e do lado da sola. A direção da sola é perpendicular ao pé no plano
    // vertical do pé; o SENTIDO vem da canela (a sola fica do lado para onde a canela aponta), então funciona
    // em pé, deitado, no leg press (sola para a plataforma) e com o pé de trás apoiado no banco.
    const fwd = unit(sub(foot.toe, foot.ankle))
    let down = foot.sole ? reject(foot.sole, fwd) : reject(v(0, -1, 0), fwd)
    if (len(down) < 1e-3) down = reject(mul(front, -1), fwd)
    if (!foot.sole && dot(down, sub(ankle, legIk.mid)) < 0) down = mul(down, -1)
    const heel = add(add(ankle, mul(unit(down), HEEL_DOWN)), mul(fwd, HEEL_FWD))
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
    const w = Math.min(1, Math.max(0, p.palms?.[s] ?? 0))
    const r = Math.min(1, Math.max(0, p.rack?.[s] ?? 0))
    palm[s] = w
    if (r > 0 && w === 0) {
      // barra nos ombros: punho à frente e abaixo da barra (mão dobrada para trás, dedos para o atleta);
      // o braço (ombro → cotovelo → punho) alcança o punho; o centro da mão fica na barra
      const fwdH = unit(len(reject(front, v(0, 1, 0))) >= 0.5 ? reject(front, v(0, 1, 0)) : v(1, 0, 0))
      const wristRack = add(add(p.hands[s], mul(fwdH, RACK_WRIST.fwd)), v(0, -RACK_WRIST.down, 0))
      const wristLine = add(armIk.mid, mul(toHand, SEG.forearm))
      const wristIk = ik2(shoulder, lerp3(wristLine, wristRack, r), ARM.a, SEG.forearm, elbowPole)
      out.elbow[s] = wristIk.mid
      out.wrist[s] = wristIk.tip
      out.hand[s] = lerp3(armIk.tip, p.hands[s], r)
      reachError.hand[s] = wristIk.error + (1 - r) * armIk.error
    } else if (w === 0) {
      out.elbow[s] = armIk.mid
      out.wrist[s] = add(armIk.mid, mul(toHand, SEG.forearm))
      out.hand[s] = armIk.tip
      reachError.hand[s] = armIk.error
    } else {
      // palma apoiada: centro da palma sobre o ponto pedido, dedos para a frente do corpo (no plano do chão),
      // punho atrás dele; o braço (ombro → cotovelo → punho) alcança o punho
      const fwdH = reject(front, v(0, 1, 0))
      const fingers = unit(len(fwdH) >= 0.5 ? fwdH : reject(up, v(0, 1, 0)))
      const palmC = add(p.hands[s], v(0, SEG.palmHalf, 0))
      const wristFlat = sub(palmC, mul(fingers, SEG.palmBack))
      const wristLine = add(armIk.mid, mul(toHand, SEG.forearm))
      const wristIk = ik2(shoulder, lerp3(wristLine, wristFlat, w), ARM.a, SEG.forearm, elbowPole)
      out.elbow[s] = wristIk.mid
      out.wrist[s] = wristIk.tip
      out.hand[s] = lerp3(armIk.tip, palmC, w)
      reachError.hand[s] = wristIk.error + (1 - w) * armIk.error
    }
  }
  return { pelvis, chest, neck, head, up, front, left, ...out, palm, reachError }
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
    twist: lerp(a.twist ?? 0, b.twist ?? 0, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    hands: sidesLerp(a.hands, b.hands, (x, y) => lerp3(x, y, t)),
    ...(a.palms || b.palms ? { palms: { L: lerp(a.palms?.L ?? 0, b.palms?.L ?? 0, t), R: lerp(a.palms?.R ?? 0, b.palms?.R ?? 0, t) } } : {}),
    ...(a.rack || b.rack ? { rack: { L: lerp(a.rack?.L ?? 0, b.rack?.L ?? 0, t), R: lerp(a.rack?.R ?? 0, b.rack?.R ?? 0, t) } } : {}),
    feet: sidesLerp(a.feet, b.feet, (x, y) => ({
      ankle: lerp3(x.ankle, y.ankle, t),
      toe: lerp3(x.toe, y.toe, t),
      ...(x.sole || y.sole ? { sole: lerpPole(x.sole, y.sole, t) } : {}),
    })),
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
