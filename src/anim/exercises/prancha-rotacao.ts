import { ARM, LEG, SEG, SIDES, type Side, type Skeleton } from '../body'
import { footFree, jointAngle, mirrorFoot, mirrorZ, trunkFrame, type Foot, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { add, angle, lerp3, mul, sub, unit, v, type V3 } from '../vec'

/*
 * Prancha com rotação (front plank with twist). De bruços apoiado nos antebraços (pitch ≈ +82: cabeça para +x,
 * corpo levemente inclinado dos ombros aos pés); gira o tronco para um lado (twist ±90) até a prancha lateral,
 * com o braço de cima estendido para o teto, e volta. Alterna os lados.
 *
 * Construção (cm, atleta de 175 cm):
 * - O antebraço de apoio fica PARADO no chão: cotovelo em (0, SEG.forearmRest, ∓SEG.shoulderHalf), mão ARM.b à frente. O ombro de apoio
 *   fica exatamente sobre o cotovelo (braço vertical, 90° no cotovelo) em todas as poses-chave; a pelve é
 *   deduzida dele (ombro → peito → pelve pelo referencial do tronco).
 * - A inclinação do tronco (pitch) sai de uma busca: corpo reto do ombro ao tornozelo de apoio, com a ponta do pé
 *   no chão. Os tornozelos são "plantados" à distância exata da perna quase estendida (0,995 do alcance).
 * - twist + = peito para a esquerda: apoia no antebraço DIREITO e o braço esquerdo sobe (pose.test.ts).
 *   O lado direito é o espelho (mirrorPose).
 * O motor não tem um construtor de "antebraço apoiado"; o cotovelo no chão é consequência do ombro sobre o
 * cotovelo + guia do cotovelo para baixo (ver relatório do piloto).
 */

const L = 0.995 * (LEG.a + LEG.b) // perna quase estendida (joelho ≈ 170°+)
const REACH = 0.996 * (ARM.a + ARM.b) // braço estendido (≈ 172°)
const ELBOW_Y = SEG.forearmRest // centro do cotovelo apoiado (espessura do antebraço)
const FOREARM_Y = SEG.forearmRest
const TOE_Y = 1
const SR: V3 = v(0, ELBOW_Y + ARM.a, -SEG.shoulderHalf) // ombro direito (apoio) sobre o cotovelo
const HAND_R: V3 = v(ARM.b, FOREARM_Y, -SEG.shoulderHalf)
const HAND_L_FLOOR: V3 = v(ARM.b, FOREARM_Y, SEG.shoulderHalf)
const DOWN = v(0, -1, 0)
const BACK = v(-1, 0, 0)

type Frame = ReturnType<typeof trunkFrame>
/** Pelve tal que o ombro direito fique em SR. */
const pelvisFor = (f: Frame): V3 => add(sub(SR, mul(f.up, SEG.trunk)), mul(f.left, SEG.shoulderHalf))
/** Ponta do pé: para o lado do peito (chão na prancha, à frente na lateral), um pouco para a cabeça e para baixo. */
// (o componente para baixo também evita que o calcanhar derivado — que o motor põe "embaixo" do tornozelo —
// atravesse o chão quando o pé está de lado na prancha lateral)
const toeDir = (f: Frame): V3 => unit(add(add(f.front, mul(f.up, 0.25)), v(0, -0.5, 0)))
const ankleYFor = (f: Frame) => TOE_Y - SEG.toe * toeDir(f)[1]

/** Pé apoiado: ponta no chão, tornozelo à distância exata da perna a partir do quadril (x calculado). */
function plant(hip: V3, f: Frame, z: number): Foot {
  const y = ankleYFor(f)
  const dy = y - hip[1]
  const dz = z - hip[2]
  return footFree(v(hip[0] - Math.sqrt(Math.max(0, L * L - dy * dy - dz * dz)), y, z), toeDir(f))
}

/** Inclinação que deixa o corpo reto do ombro de apoio ao tornozelo de apoio com a ponta do pé no chão. */
function pitchFor(twist: number): number {
  let lo = 55
  let hi = 95
  for (let i = 0; i < 50; i++) {
    const p = (lo + hi) / 2
    const f = trunkFrame(p, 0, twist)
    const hipR = sub(pelvisFor(f), mul(f.left, SEG.hipHalf))
    const g = hipR[1] - L * f.up[1] - ankleYFor(f)
    if (g > 0) hi = p
    else lo = p
  }
  return (lo + hi) / 2
}

/** Pose girando para a esquerda (apoio no antebraço direito). `arm`: onde está a mão esquerda. */
function plankPose(twist: number, arm: 'chão' | 'meio' | 'teto', staggerL = 0): PoseSpec {
  const pitch = pitchFor(twist)
  const f = trunkFrame(pitch, 0, twist)
  const pelvis = pelvisFor(f)
  const hipL = add(pelvis, mul(f.left, SEG.hipHalf))
  const hipR = sub(pelvis, mul(f.left, SEG.hipHalf))
  const shoulderL = add(SR, mul(f.left, 2 * SEG.shoulderHalf))
  const handL =
    arm === 'chão' ? HAND_L_FLOOR : arm === 'teto' ? add(shoulderL, v(0, REACH, 0)) : add(shoulderL, mul(unit(add(f.left, mul(f.up, 0.15))), REACH))
  return {
    pelvis,
    pitch,
    twist,
    head: 0,
    hands: { L: handL, R: HAND_R },
    feet: { L: plant(hipL, f, hipL[2] + staggerL), R: plant(hipR, f, hipR[2]) },
    elbowPole: { L: arm === 'chão' ? DOWN : BACK, R: DOWN },
  }
}

const mirrorPole = (p?: Partial<Record<Side, V3>>) => p && { L: p.R && mirrorZ(p.R), R: p.L && mirrorZ(p.L) }
/** Mesmo movimento para o outro lado (espelho em z, giro invertido, lados trocados). */
const mirrorPose = (p: PoseSpec): PoseSpec => ({
  ...p,
  pelvis: mirrorZ(p.pelvis),
  twist: -(p.twist ?? 0),
  hands: { L: mirrorZ(p.hands.R), R: mirrorZ(p.hands.L) },
  feet: { L: mirrorFoot(p.feet.R), R: mirrorFoot(p.feet.L) },
  elbowPole: mirrorPole(p.elbowPole),
  kneePole: mirrorPole(p.kneePole),
})

/** Prancha frontal nos antebraços: cotovelos sob os ombros, corpo reto, pontas dos pés no chão. */
const FRONT = plankPose(0, 'chão')
/** Meio do giro: o quadril acompanha o peito; o braço de cima já saiu do chão. */
const MID_L = plankPose(45, 'meio', 8)
/** Prancha lateral: apoio num antebraço, peito de lado, braço de cima estendido para o teto, pé de cima à frente. */
const SIDE_L = plankPose(90, 'teto', 18)
const MID_R = mirrorPose(MID_L)
const SIDE_R = mirrorPose(SIDE_L)

// ───────── restrições próprias ─────────
const FLOOR_TOL = SEG.forearmRest + 2
const onFloor = (s: Skeleton, k: Side) => s.elbow[k][1] <= FLOOR_TOL && s.hand[k][1] <= FLOOR_TOL
const mid = (a: V3, b: V3) => lerp3(a, b, 0.5)
/** Lado de apoio numa prancha lateral: o cotovelo mais baixo. */
const support = (s: Skeleton): Side => (s.elbow.L[1] < s.elbow.R[1] ? 'L' : 'R')

const lateralChecks = (pose: string) => [
  {
    name: `${pose}: ombro de apoio sobre o cotovelo`,
    at: { pose },
    test: (s: Skeleton) => {
      const k = support(s)
      const d = Math.hypot(s.shoulder[k][0] - s.elbow[k][0], s.shoulder[k][2] - s.elbow[k][2])
      return d <= 5 || `ombro ${d.toFixed(1)} cm fora da vertical do cotovelo`
    },
  },
  {
    name: `${pose}: tronco de lado (peito para o lado, não para o chão)`,
    at: { pose },
    test: (s: Skeleton) => Math.abs(angle(s.front, v(0, 1, 0)) - 90) <= 10 || `peito a ${Math.round(angle(s.front, v(0, 1, 0)))}° da vertical (esperado ≈ 90°)`,
  },
  {
    name: `${pose}: braço de cima estendido para o teto`,
    at: { pose },
    test: (s: Skeleton) => {
      const k: Side = support(s) === 'L' ? 'R' : 'L'
      const a = jointAngle(s.shoulder[k], s.elbow[k], s.hand[k])
      const up = angle(sub(s.hand[k], s.shoulder[k]), v(0, 1, 0))
      return (a >= 165 && up <= 15) || `cotovelo a ${Math.round(a)}°, braço a ${Math.round(up)}° da vertical`
    },
  },
]

export const pranchaRotacao: ExerciseSpec = {
  id: '0464',
  datasetId: '0464',
  name: 'Prancha com rotação',
  // de perfil pelo lado esquerdo, um pouco de frente e de cima (como o GIF): mostra o corpo reto e o giro do peito
  camera: { yaw: 70, pitch: 20 },
  phases: [
    { name: 'Rotação', description: 'Gira o corpo inteiro como uma tábua sobre um antebraço e leva o outro braço ao teto.' },
    { name: 'Retorno', description: 'Volta com controle à prancha nos dois antebraços, sem deixar o quadril cair.' },
  ],
  keyPoints: [
    'Corpo reto dos ombros aos pés (quadril não cai nem sobe) durante todo o movimento',
    'Na prancha, os dois antebraços no chão com os cotovelos sob os ombros',
    'Na rotação, o ombro de apoio fica sobre o cotovelo',
    'Na prancha lateral, o peito fica de lado e o braço de cima estende para o teto',
    'Antebraço de apoio e pés sempre no chão',
  ],
  muscles: [
    { phase: 'Rotação', primary: ['obliquos', 'abdomen'], secondary: ['deltoide_anterior', 'deltoide_lateral', 'gluteos'] },
    { phase: 'Retorno', primary: ['abdomen', 'obliquos'], secondary: ['deltoide_anterior', 'gluteos', 'quadriceps'] },
  ],
  muscleSource:
    'McGill — Low Back Disorders, 3ª ed. (Human Kinetics, 2016), prancha frontal e ponte lateral; Delavier — Guia dos Movimentos de Musculação (Manole), prancha; dataset 0464 (alvo: abdômen; secundários: oblíquos, ombros). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'mat', x0: -165, x1: 50 }], // tornozelos em x ≈ −135, mãos em x ≈ 34
  frames: [
    { name: 'Prancha', pose: FRONT, moveMs: 550, holdMs: 600, phase: 'Retorno', ease: 'out', handPath: 'shoulder' },
    { name: 'Girando (esquerda)', pose: MID_L, moveMs: 650, holdMs: 0, phase: 'Rotação', ease: 'in', handPath: 'shoulder' },
    { name: 'Prancha lateral (esquerda)', pose: SIDE_L, moveMs: 350, holdMs: 700, phase: 'Rotação', ease: 'out', handPath: 'shoulder' },
    // volta pela mesma pose do meio: direto da lateral para a frontal, a interpolação abaixava o ombro de apoio
    // braço de cima em arco em volta do ombro (handPath): em linha reta no mundo a mão passaria do alcance
    // tempos: a mão anda ~100 cm entre a prancha e o meio do giro e ~30 cm entre o meio e a lateral
    { pose: MID_L, moveMs: 300, holdMs: 0, phase: 'Retorno', ease: 'in', handPath: 'shoulder' },
    { name: 'Prancha', pose: FRONT, moveMs: 550, holdMs: 600, phase: 'Retorno', ease: 'out', handPath: 'shoulder' },
    { name: 'Girando (direita)', pose: MID_R, moveMs: 650, holdMs: 0, phase: 'Rotação', ease: 'in', handPath: 'shoulder' },
    { name: 'Prancha lateral (direita)', pose: SIDE_R, moveMs: 350, holdMs: 700, phase: 'Rotação', ease: 'out', handPath: 'shoulder' },
    { pose: MID_R, moveMs: 300, holdMs: 0, phase: 'Retorno', ease: 'in', handPath: 'shoulder' },
  ],
  checks: [
    {
      name: 'Corpo reto dos ombros aos pés',
      at: 'all',
      test: (s) => {
        const a = jointAngle(mid(s.shoulder.L, s.shoulder.R), s.pelvis, mid(s.ankle.L, s.ankle.R))
        return a >= 163 || `ombro–quadril–tornozelo a ${Math.round(a)}° (mín. 163°)`
      },
    },
    {
      name: 'Antebraço de apoio no chão',
      at: 'all',
      test: (s) => SIDES.some((k) => onFloor(s, k)) || `nenhum antebraço no chão (cotovelos a ${s.elbow.L[1].toFixed(1)} e ${s.elbow.R[1].toFixed(1)} cm)`,
    },
    {
      name: 'Pés no chão',
      at: 'all',
      test: (s) => {
        for (const k of SIDES) {
          const low = Math.min(s.toe[k][1], s.heel[k][1])
          if (low > 2.5) return `pé (${k}) a ${low.toFixed(1)} cm do chão`
        }
        return true
      },
    },
    {
      name: 'Prancha: os dois antebraços no chão, cotovelos sob os ombros',
      at: { pose: 'Prancha' },
      test: (s) => {
        for (const k of SIDES) {
          if (!onFloor(s, k)) return `antebraço (${k}) fora do chão`
          const d = Math.hypot(s.shoulder[k][0] - s.elbow[k][0], s.shoulder[k][2] - s.elbow[k][2])
          if (d > 5) return `cotovelo (${k}) a ${d.toFixed(1)} cm da vertical do ombro`
        }
        return true
      },
    },
    ...lateralChecks('Prancha lateral (esquerda)'),
    ...lateralChecks('Prancha lateral (direita)'),
  ],
  review: {
    status: 'verificado',
    notes: 'Alterna os dois lados (o GIF mostra só um). Visto da câmera, o giro para a direita mostra as costas.',
  },
}

export default pranchaRotacao
