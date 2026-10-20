import { ARM, type Skeleton } from '../body'
import { lib } from '../checks'
import { both, footFlat, mirrorFoot, mirrorZ, solve, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { add, angle, mul, sub, unit, v, type V3 } from '../vec'

/*
 * Elevação lateral com halteres, em pé, pegada neutra embaixo (halteres no eixo x: palmas para o corpo) e
 * palmas para baixo no topo (o eixo do halter continua em x).
 * Em pé: pelve a 92,5 cm, tronco vertical, pés na largura do quadril.
 * O braço sobe de lado (um pouco à frente, ~10°, no plano da escápula) com o cotovelo levemente dobrado e
 * fixo (~165°). A mão é posta na distância ombro–mão que dá esse ângulo; a cinemática inversa põe o cotovelo
 * para trás e, conforme o braço sobe, para cima (guia do cotovelo acompanha a elevação): no topo o cotovelo
 * fica na altura ou acima da mão.
 * O caminho da mão é um arco em torno do ombro; como a interpolação é em linha reta, há poses a cada ~25°.
 */

const feet = both(footFlat(0, 12, -8), mirrorFoot)
const base = { pelvis: v(0, 92.5, 0), pitch: 0, head: 0, feet }
const SHOULDER = solve({ ...base, hands: { L: base.pelvis, R: base.pelvis } } as PoseSpec).shoulder.L
const ELBOW_DEG = 165
const D = Math.sqrt(ARM.a ** 2 + ARM.b ** 2 - 2 * ARM.a * ARM.b * Math.cos((ELBOW_DEG * Math.PI) / 180))
const PLANE = 10 // graus à frente do plano frontal (plano da escápula)

/** Pose com o braço elevado `abd` graus a partir da vertical (0 = pendurado, 90 = paralelo ao chão). */
const raise = (abd: number): PoseSpec => {
  const a = (abd * Math.PI) / 180
  const p = (PLANE * Math.PI) / 180
  const dir = v(Math.sin(a) * Math.sin(p), -Math.cos(a), Math.sin(a) * Math.cos(p))
  const hand: V3 = add(SHOULDER, mul(dir, D))
  // cotovelo para trás e "para cima" no plano de elevação (embaixo isso é para fora; no topo, para cima)
  const pole = unit(add(v(-0.7, 0, 0), mul(v(0, Math.sin(a), Math.cos(a)), 0.7)))
  return { ...base, hands: both(hand, mirrorZ), elbowPole: both(pole, mirrorZ) }
}

/** Embaixo: braços ao lado do corpo, halteres ao lado das coxas. */
const BOTTOM = raise(14)
const LOW = raise(40)
const HIGH = raise(65)
/** Topo: braços paralelos ao chão, cotovelos na altura dos ombros. */
const TOP = raise(88)

const upperArmToTrunk = (s: Skeleton, k: 'L' | 'R') =>
  angle(sub(s.elbow[k], s.shoulder[k]), mul(s.up, -1))

export const elevacaoLateral: ExerciseSpec = {
  id: '0334',
  datasetId: '0334',
  name: 'Elevação lateral com halteres',
  // mais de frente que o padrão (como o GIF do dataset): os dois braços abrem para os lados sem um tapar o outro
  camera: { yaw: 30, pitch: 10 },
  phases: [
    { name: 'Subida', description: 'Com o tronco firme e os cotovelos levemente dobrados, abre os braços para os lados até ficarem paralelos ao chão.' },
    { name: 'Descida', description: 'Desce os braços devagar até ficarem ao lado do corpo.' },
  ],
  keyPoints: [
    'Tronco firme e vertical (sem embalo)',
    'Cotovelos levemente dobrados e fixos durante todo o movimento',
    'Sobe até os braços ficarem paralelos ao chão (cotovelos na altura dos ombros, não acima)',
    'Os cotovelos conduzem: no topo, cotovelo na altura ou acima da mão',
    'Desce até os braços ficarem ao lado do corpo',
  ],
  muscles: [
    { phase: 'Subida', primary: ['deltoide_lateral'], secondary: ['deltoide_anterior', 'trapezio'] },
    { phase: 'Descida', primary: ['deltoide_lateral'], secondary: ['deltoide_anterior', 'trapezio'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, elevação lateral (deltoides, trapézio superior); Delavier, Guia dos Movimentos de Musculação. Distribuição por fase a validar na revisão.',
  props: [{ kind: 'dumbbells', axis: 'x' }],
  frames: [
    { name: 'Braços ao lado do corpo', pose: BOTTOM, moveMs: 500, holdMs: 400, phase: 'Descida', ease: 'out' },
    { pose: LOW, moveMs: 350, holdMs: 0, phase: 'Subida', ease: 'in' },
    { pose: HIGH, moveMs: 300, holdMs: 0, phase: 'Subida', ease: 'linear' },
    { name: 'Braços paralelos ao chão', pose: TOP, moveMs: 350, holdMs: 300, phase: 'Subida', ease: 'out' },
    { pose: HIGH, moveMs: 500, holdMs: 0, phase: 'Descida', ease: 'in' },
    { pose: LOW, moveMs: 450, holdMs: 0, phase: 'Descida', ease: 'linear' },
  ],
  checks: [
    { name: 'Tronco firme e vertical', at: 'all', test: lib.trunk(0, 3) },
    { name: 'Pés apoiados', at: 'all', test: lib.feetFlat(0, 1.5) },
    { name: 'Joelhos estendidos (em pé)', at: 'all', test: lib.knee(165, 180) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Halteres na mesma altura', at: 'all', test: lib.handsLevel(1) },
    { name: 'Cotovelos levemente dobrados (sem travar nem dobrar demais)', at: 'all', test: lib.elbow(145, 172) },
    {
      name: 'Mãos nunca acima dos ombros',
      at: 'all',
      test: (s) => {
        const dy = s.hand.L[1] - s.shoulder.L[1]
        return dy <= 3 || `mão ${dy.toFixed(1)} cm acima do ombro`
      },
    },
    {
      name: 'Braços ao lado do corpo embaixo',
      at: { pose: 'Braços ao lado do corpo' },
      test: (s) => {
        const a = upperArmToTrunk(s, 'L')
        return a <= 25 || `braço a ${Math.round(a)}° do tronco (máx. 25)`
      },
    },
    {
      name: 'Braços paralelos ao chão no topo',
      at: { pose: 'Braços paralelos ao chão' },
      test: (s) => {
        const dy = s.elbow.L[1] - s.shoulder.L[1]
        return Math.abs(dy) <= 6 || `cotovelo ${dy.toFixed(1)} cm em relação ao ombro (máx. ±6)`
      },
    },
    {
      name: 'Cotovelo na altura ou acima da mão no topo',
      at: { pose: 'Braços paralelos ao chão' },
      test: (s) => {
        const dy = s.elbow.L[1] - s.hand.L[1]
        return dy >= -1 || `mão ${(-dy).toFixed(1)} cm acima do cotovelo`
      },
    },
  ],
  review: { status: 'verificado' },
}

export default elevacaoLateral
