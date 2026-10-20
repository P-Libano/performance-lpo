import { lib } from '../checks'
import { ARM, LEG, SEG, SIDES, STAND_Y, type Skeleton } from '../body'
import { armsAtSides, both, footFlat, footFree, jointAngle, mirrorFoot, mirrorZ, pressUp, trunkFrame, type Foot, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { add, angle, dist, lerp3, mul, sub, unit, v, type V3 } from '../vec'

/*
 * Burpee (sem flexão, como o GIF do dataset 1160): em pé → agacha e apoia as mãos no chão → lança os pés para
 * trás até a prancha alta → traz os pés de volta → salta com os braços acima da cabeça → aterrissa em pé.
 *
 * Medidas (cm, atleta de 175 cm): tornozelos em x = 0 em pé; palmas apoiadas no chão (`palms`, punho dobrado)
 * em x = 38, z = ±22, as MESMAS nos dois agachamentos e na prancha (mãos não deslizam).
 * Prancha alta: braços estendidos com os ombros entre o punho e o centro da palma; a inclinação do tronco sai de uma
 * busca para o corpo ficar reto até as pontas dos pés no chão. Salto: pés ≈ 7 cm acima do chão (pé "solto").
 */

const L = 0.995 * (LEG.a + LEG.b) // perna quase estendida
const REACH = 0.996 * (ARM.a + ARM.b)
/** ombro → punho com o braço estendido (palma apoiada: a mão não está em linha com o antebraço) */
const REACH_WRIST = 0.996 * (ARM.a + SEG.forearm)
const HX = 38
const HZ = 22
const PALMS = { L: 1, R: 1 }
const TOE_Y = 1
const STANCE = both(footFlat(0, 12, -8), mirrorFoot)
const kneeOut = both(v(1, 0, 0.45), mirrorZ) // joelhos na direção das pontas dos pés (não para dentro)

// ───────── prancha alta ─────────
const CHEST_PLANK = v(HX - SEG.palmBack / 2, SEG.palmHalf + Math.sqrt(REACH_WRIST * REACH_WRIST - (SEG.palmBack / 2) ** 2 - (HZ - SEG.shoulderHalf) ** 2), 0)
type Frame = ReturnType<typeof trunkFrame>
const toeDir = (f: Frame): V3 => unit(add(add(f.front, mul(f.up, 0.25)), v(0, -0.5, 0)))
const ankleYFor = (f: Frame) => TOE_Y - SEG.toe * toeDir(f)[1]
function plankPitch(): number {
  let lo = 40
  let hi = 90
  for (let i = 0; i < 50; i++) {
    const p = (lo + hi) / 2
    const f = trunkFrame(p)
    const g = CHEST_PLANK[1] - (SEG.trunk + L) * f.up[1] - ankleYFor(f)
    if (g > 0) hi = p
    else lo = p
  }
  return (lo + hi) / 2
}
const PLANK_PITCH = plankPitch()
const plankFeet = (): Record<'L' | 'R', Foot> => {
  const f = trunkFrame(PLANK_PITCH)
  const pelvis = sub(CHEST_PLANK, mul(f.up, SEG.trunk))
  const foot = (k: 1 | -1): Foot => {
    const hip = add(pelvis, v(0, 0, k * SEG.hipHalf))
    const y = ankleYFor(f)
    const dy = y - hip[1]
    return footFree(v(hip[0] - Math.sqrt(L * L - dy * dy), y, hip[2]), toeDir(f))
  }
  return { L: foot(1), R: foot(-1) }
}
const plankBase = { pelvis: sub(CHEST_PLANK, mul(trunkFrame(PLANK_PITCH).up, SEG.trunk)), pitch: PLANK_PITCH, head: -10, feet: plankFeet() }
/** Pontos do chão sob o centro das palmas (os mesmos do agachamento à prancha) e o centro das palmas. */
const HANDS = both(v(HX, 0, HZ), mirrorZ)
const PALM_C = both(v(HX, SEG.palmHalf, HZ), mirrorZ)
/** Prancha alta: braços estendidos com os ombros sobre as mãos, corpo reto, pontas dos pés no chão. */
const PLANK: PoseSpec = { ...plankBase, hands: HANDS, palms: PALMS, elbowPole: both(v(-1, 0, 0.3), mirrorZ) }

/*
 * Braço livre (sem segurar nada): as transições em que a mão sai do chão ou vai para o alto usam
 * handPath: 'shoulder' (arco em volta do ombro), senão a reta no mundo faria a mão passar por dentro do ombro.
 * Com isso os braços descem junto ao corpo na aterrissagem, como no GIF. Com o limite de 6 poses, a
 * aterrissagem faz o papel do "em pé".
 */
const shoulderL = (pelvis: V3, pitch: number) => add(add(pelvis, mul(trunkFrame(pitch).up, SEG.trunk)), v(0, 0, SEG.shoulderHalf))

/** Aterrissagem / em pé: tronco ereto, joelhos destravados, braços ao lado do corpo. */
const LAND_BASE = { pelvis: v(-4, STAND_Y - 3.25, 0), pitch: 6, head: 0, feet: STANCE, kneePole: kneeOut }
const LAND: PoseSpec = { ...LAND_BASE, hands: armsAtSides(LAND_BASE, 9, 4) }

/** Descendo: quadril para trás e para baixo, braços indo à frente dos joelhos (não passam por dentro das pernas). */
const DESC_BASE = { pelvis: v(-12, STAND_Y - 22, 0), pitch: 40, head: -15, feet: STANCE, kneePole: kneeOut }
const DESC: PoseSpec = { ...DESC_BASE, hands: both(add(shoulderL(DESC_BASE.pelvis, 40), mul(unit(v(0.8, -0.6, 0)), REACH)), mirrorZ) }

/** Subindo do agachamento: quadril e joelhos estendendo, braços passando à frente rumo ao alto. */
const RISE_BASE = { pelvis: v(-8, STAND_Y - 14.75, 0), pitch: 20, head: -5, feet: STANCE, kneePole: kneeOut }
const RISE: PoseSpec = { ...RISE_BASE, hands: both(add(shoulderL(RISE_BASE.pelvis, 20), mul(unit(v(0.85, 0.45, 0.1)), REACH)), mirrorZ) }

/** Agachado com as mãos no chão à frente dos pés: quadril baixo, calcanhares no chão, olhar à frente. */
const SQUAT: PoseSpec = { pelvis: v(-12, 42, 0), pitch: 75, head: -25, feet: STANCE, kneePole: kneeOut, hands: HANDS, palms: PALMS, elbowPole: both(v(-1, 0, 0.5), mirrorZ) }

/** No ar: corpo estendido, braços acima da cabeça, pés fora do chão. */
const AIR_Y = STAND_Y + 15.25
const AIR_BASE = {
  pelvis: v(-2, AIR_Y, 0),
  pitch: 0,
  head: 0,
  feet: both(footFree(v(-2, AIR_Y - Math.sqrt(L * L - (12 - SEG.hipHalf) ** 2), 12), v(1, -1.3, 0)), mirrorFoot),
  kneePole: kneeOut,
}
// braços acima da cabeça, um pouco abertos (mãos a z = ±24); subida e descida em arco (handPath 'shoulder')
const AIR: PoseSpec = { ...AIR_BASE, hands: pressUp(AIR_BASE, 4, 24) }

// ───────── restrições próprias ─────────
const mid = (a: V3, b: V3) => lerp3(a, b, 0.5)
const bodyLine = (min: number) => (s: Skeleton) => {
  const a = jointAngle(mid(s.shoulder.L, s.shoulder.R), s.pelvis, mid(s.ankle.L, s.ankle.R))
  return a >= min || `ombro–quadril–tornozelo a ${Math.round(a)}° (mín. ${min}°)`
}
const SQUATS = ['Agachado (mãos no chão)', 'Agachado (pés de volta)']

export const burpee: ExerciseSpec = {
  id: '1160',
  datasetId: '1160',
  name: 'Burpee',
  // 3/4 frontal-esquerdo, como o GIF do dataset: mostra o salto, o agachamento e a prancha sem nada tapar
  camera: { yaw: 52, pitch: 12 },
  phases: [
    { name: 'Descida', description: 'Agacha e apoia as mãos no chão à frente dos pés, na largura dos ombros.' },
    { name: 'Pés para trás', description: 'Com o peso nas mãos, lança os pés para trás até a prancha com o corpo reto.' },
    { name: 'Pés de volta', description: 'Traz os pés de volta para perto das mãos, em agachamento.' },
    { name: 'Salto', description: 'Estende quadril e joelhos e salta com os braços acima da cabeça.' },
    { name: 'Aterrissagem', description: 'Aterrissa com os joelhos destravados e volta à posição em pé.' },
  ],
  keyPoints: [
    'Mãos apoiadas no chão na largura dos ombros, no mesmo lugar do agachamento à prancha',
    'Prancha com o corpo reto (quadril não cai) e ombros sobre as mãos, braços estendidos',
    'Agachamento com os calcanhares no chão e joelhos na direção das pontas dos pés',
    'Salto com quadril e joelhos estendidos e braços acima da cabeça',
    'Termina em pé, com o tronco ereto',
  ],
  muscles: [
    { phase: 'Descida', primary: ['quadriceps', 'gluteos'], secondary: ['posteriores', 'eretores'] },
    { phase: 'Pés para trás', primary: ['abdomen', 'deltoide_anterior'], secondary: ['peitoral', 'triceps', 'quadriceps'] },
    { phase: 'Pés de volta', primary: ['abdomen', 'quadriceps'], secondary: ['deltoide_anterior', 'obliquos'] },
    { phase: 'Salto', primary: ['quadriceps', 'gluteos', 'panturrilhas'], secondary: ['posteriores', 'deltoide_anterior'] },
    { phase: 'Aterrissagem', primary: ['quadriceps', 'gluteos'], secondary: ['panturrilhas', 'posteriores'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), exercícios pliométricos (salto vertical) e de peso corporal; dataset 1160 (secundários: quadríceps, posteriores, panturrilhas, ombros, peitoral). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'mat', x0: -150, x1: 60 }],
  frames: [
    // ordem girada para a prancha ser a pose do meio (frames[3]): é o quadro parado/miniatura do app
    // (AnimPlayer.stillMs) e a "vista oposta" da folha; precisa ter holdMs > 0 (render.test.ts)
    { name: 'Aterrissagem (em pé)', pose: LAND, moveMs: 400, holdMs: 500, phase: 'Aterrissagem', ease: 'in', handPath: 'shoulder' },
    { name: 'Descendo', pose: DESC, moveMs: 350, holdMs: 0, phase: 'Descida', ease: 'in', handPath: 'shoulder' },
    { name: SQUATS[0], pose: SQUAT, moveMs: 350, holdMs: 100, phase: 'Descida', ease: 'out' },
    { name: 'Prancha', pose: PLANK, moveMs: 400, holdMs: 250, phase: 'Pés para trás', ease: 'out' },
    { name: SQUATS[1], pose: SQUAT, moveMs: 400, holdMs: 100, phase: 'Pés de volta', ease: 'out' },
    { name: 'Subindo', pose: RISE, moveMs: 300, holdMs: 0, phase: 'Salto', ease: 'in', handPath: 'shoulder' },
    { name: 'No ar', pose: AIR, moveMs: 250, holdMs: 100, phase: 'Salto', ease: 'out', handPath: 'shoulder' },
  ],
  checks: [
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Aterrissagem: pés apoiados', at: { pose: 'Aterrissagem (em pé)' }, test: lib.feetFlat(0, 1.5) },
    { name: 'Aterrissagem: joelhos destravados (nem travados nem agachado)', at: { pose: 'Aterrissagem (em pé)' }, test: lib.knee(145, 175) },
    { name: 'Aterrissagem: tronco ereto', at: { pose: 'Aterrissagem (em pé)' }, test: lib.trunk(0, 10) },
    { name: 'Subindo: pés apoiados (empurra o chão)', at: { pose: 'Subindo' }, test: lib.feetFlat(0, 1.5) },
    ...SQUATS.flatMap((pose) => [
      { name: `${pose}: calcanhares no chão`, at: { pose }, test: lib.feetFlat(0, 1.5) },
      { name: `${pose}: mãos no chão, no lugar da prancha`, at: { pose }, test: lib.handsAt(PALM_C, 1) },
      { name: `${pose}: agachamento fundo`, at: { pose }, test: lib.knee(30, 100) },
    ]),
    { name: 'Prancha: mãos no mesmo lugar', at: { pose: 'Prancha' }, test: lib.handsAt(PALM_C, 1) },
    { name: 'Prancha: corpo reto', at: { pose: 'Prancha' }, test: bodyLine(168) },
    { name: 'Prancha: braços estendidos', at: { pose: 'Prancha' }, test: lib.elbow(165, 180) },
    {
      name: 'Prancha: ombros sobre as mãos',
      at: { pose: 'Prancha' },
      test: (s) => {
        const dx = mid(s.shoulder.L, s.shoulder.R)[0] - mid(s.hand.L, s.hand.R)[0]
        return Math.abs(dx) <= 6 || `ombros ${dx.toFixed(1)} cm ${dx > 0 ? 'à frente' : 'atrás'} das mãos`
      },
    },
    {
      name: 'Prancha: pontas dos pés no chão',
      at: { pose: 'Prancha' },
      test: (s) => SIDES.every((k) => Math.abs(s.toe[k][1] - TOE_Y) <= 1.5) || 'pontas dos pés fora do chão',
    },
    {
      name: 'No ar: pés fora do chão',
      at: { pose: 'No ar' },
      test: (s) => {
        for (const k of SIDES) {
          const low = Math.min(s.toe[k][1], s.heel[k][1])
          if (low < 3) return `pé (${k}) a ${low.toFixed(1)} cm do chão (mín. 3)`
        }
        return true
      },
    },
    { name: 'No ar: joelhos estendidos', at: { pose: 'No ar' }, test: lib.knee(165, 180) },
    { name: 'No ar: corpo estendido', at: { pose: 'No ar' }, test: lib.trunk(0, 5) },
    {
      name: 'No ar: braços estendidos acima da cabeça',
      at: { pose: 'No ar' },
      test: (s) => {
        for (const k of SIDES) {
          const a = jointAngle(s.shoulder[k], s.elbow[k], s.hand[k])
          const up = angle(sub(s.hand[k], s.shoulder[k]), v(0, 1, 0))
          if (a < 160 || up > 20 || s.hand[k][1] < s.head[1] + 10) return `braço (${k}): cotovelo ${Math.round(a)}°, ${Math.round(up)}° da vertical`
        }
        return true
      },
    },
    {
      name: 'Mãos não atravessam o tronco',
      at: 'all',
      test: (s) => SIDES.every((k) => dist(s.hand[k], s.pelvis) > 12 && dist(s.hand[k], s.chest) > 12) || 'mão dentro do tronco',
    },
  ],
  review: {
    status: 'verificado',
    notes:
      'Aterrissagem faz o papel do "em pé" (limite de 6 poses). Braços livres em arco em volta do ombro (handPath "shoulder") na subida, no salto, na aterrissagem e na ida ao chão: terminam junto ao corpo na aterrissagem, como no GIF; no meio da descida passam abertos à frente/ao lado. Sem flexão, como o GIF.',
  },
}

export default burpee
