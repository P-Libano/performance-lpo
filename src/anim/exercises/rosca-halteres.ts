import { ARM, SEG } from '../body'
import { lib } from '../checks'
import { both, footFlat, jointAngle, mirrorFoot, mirrorZ, solve, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { add, angle, mul, reject, unit, v, type V3 } from '../vec'

/*
 * Rosca com halteres (bíceps), em pé, pegada supinada (palmas para a frente: halteres no eixo z).
 * Em pé: pelve a 92,5 cm, tronco vertical, pés na largura do quadril (como o travamento do terra).
 * O braço (ombro → cotovelo) fica parado, quase vertical e um pouco para fora; só o antebraço gira em torno
 * do cotovelo. As mãos são calculadas a partir do cotovelo e do ângulo dele (`hand(θ)`), então o comprimento
 * dos ossos é exato e a cinemática inversa devolve o mesmo cotovelo (guia do cotovelo para trás, −x).
 * O caminho da mão é um arco; como a interpolação é em linha reta, há poses intermediárias a cada ~45°.
 */

const feet = both(footFlat(0, 12, -8), mirrorFoot)
const base = { pelvis: v(0, 92.5, 0), pitch: 0, head: 0, feet }
const SHOULDER = solve({ ...base, hands: { L: base.pelvis, R: base.pelvis } } as PoseSpec).shoulder.L
// braço parado: quase vertical, levemente para fora (o halter não bate na coxa) e um nada à frente
const UPPER = unit(v(0.04, -1, 0.14))
const ELBOW = add(SHOULDER, mul(UPPER, SEG.upperArm))
// direção "para a frente" no plano em que o antebraço gira
const FWD = unit(reject(v(1, 0, 0), UPPER))
const elbowPole = both(v(-1, 0, 0), mirrorZ)

/** Pose com o cotovelo no ângulo interno `deg` (180 = braço estendido). */
const curl = (deg: number): PoseSpec => {
  const bend = (180 - deg) * (Math.PI / 180)
  const dir = add(mul(UPPER, Math.cos(bend)), mul(FWD, Math.sin(bend)))
  const hand: V3 = add(ELBOW, mul(dir, ARM.b))
  return { ...base, elbowPole, hands: both(hand, mirrorZ) }
}

/** Embaixo: braços estendidos (sem travar), halteres ao lado das coxas. */
const BOTTOM = curl(170)
const LOW = curl(130)
/** Antebraço na horizontal. */
const MID = curl(90)
/** Topo: bíceps contraído, halteres perto da altura dos ombros. */
const TOP = curl(42)

export const roscaHalteres: ExerciseSpec = {
  id: '0294',
  datasetId: '0294',
  name: 'Rosca com halteres',
  // mais de frente que o padrão (como o GIF do dataset): no padrão (yaw 52) os dois halteres, no eixo z, ficam
  // quase alinhados na tela e se sobrepõem; com yaw 30 cada halter aparece do seu lado e o antebraço subindo
  // ainda é visível de 3/4
  camera: { yaw: 30, pitch: 10 },
  phases: [
    { name: 'Subida', description: 'Com os cotovelos parados ao lado do corpo e as palmas para a frente, dobra os cotovelos até os halteres chegarem perto dos ombros.' },
    { name: 'Descida', description: 'Desce os halteres devagar até os braços estenderem de novo.' },
  ],
  keyPoints: [
    'Em pé, tronco parado (sem balançar o corpo para subir o peso)',
    'Cotovelos junto ao tronco: o braço fica parado e só o antebraço se move',
    'Embaixo, braços estendidos (amplitude completa)',
    'No topo, cotovelo bem dobrado e halteres perto da altura dos ombros',
    'Os dois braços sobem juntos e na mesma altura',
  ],
  muscles: [
    { phase: 'Subida', primary: ['biceps'], secondary: ['antebraco', 'deltoide_anterior'] },
    { phase: 'Descida', primary: ['biceps'], secondary: ['antebraco'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, rosca bíceps (bíceps braquial, braquial, braquiorradial); Delavier, Guia dos Movimentos de Musculação. Braquial/braquiorradial mapeados para bíceps/antebraço; distribuição por fase a validar na revisão.',
  props: [{ kind: 'dumbbells', axis: 'z' }],
  frames: [
    { name: 'Braços estendidos', pose: BOTTOM, moveMs: 550, holdMs: 400, phase: 'Descida', ease: 'out' },
    { pose: LOW, moveMs: 350, holdMs: 0, phase: 'Subida', ease: 'in' },
    { name: 'Antebraço na horizontal', pose: MID, moveMs: 300, holdMs: 0, phase: 'Subida', ease: 'linear' },
    { name: 'Topo', pose: TOP, moveMs: 350, holdMs: 400, phase: 'Subida', ease: 'out' },
    { pose: MID, moveMs: 550, holdMs: 0, phase: 'Descida', ease: 'in' },
    { pose: LOW, moveMs: 500, holdMs: 0, phase: 'Descida', ease: 'linear' },
  ],
  checks: [
    { name: 'Tronco parado e vertical', at: 'all', test: lib.trunk(0, 3) },
    { name: 'Pés apoiados', at: 'all', test: lib.feetFlat(0, 1.5) },
    { name: 'Joelhos estendidos (em pé)', at: 'all', test: lib.knee(165, 180) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Halteres na mesma altura', at: 'all', test: lib.handsLevel(1) },
    {
      name: 'Cotovelos junto ao tronco (braço parado)',
      at: 'all',
      test: (s) => {
        for (const k of ['L', 'R'] as const) {
          const a = angle(v(s.elbow[k][0] - s.shoulder[k][0], s.elbow[k][1] - s.shoulder[k][1], s.elbow[k][2] - s.shoulder[k][2]), v(0, -1, 0))
          if (a > 15) return `braço (${k}) a ${Math.round(a)}° da vertical (máx. 15)`
          const dx = s.elbow[k][0] - s.shoulder[k][0]
          if (dx > 6) return `cotovelo (${k}) ${dx.toFixed(1)} cm à frente do ombro (máx. 6)`
        }
        return true
      },
    },
    { name: 'Braços estendidos embaixo', at: { pose: 'Braços estendidos' }, test: lib.elbow(160, 180) },
    { name: 'Cotovelo bem dobrado no topo', at: { pose: 'Topo' }, test: lib.elbow(30, 55) },
    {
      name: 'Halteres perto da altura dos ombros no topo',
      at: { pose: 'Topo' },
      test: (s) => {
        const dy = s.hand.L[1] - s.shoulder.L[1]
        return (dy >= -15 && dy <= 0) || `halter ${dy.toFixed(1)} cm em relação ao ombro (esperado −15 a 0)`
      },
    },
    {
      name: 'Cotovelo a ~90° no meio da subida (antebraço na horizontal)',
      at: { pose: 'Antebraço na horizontal' },
      test: (s) => {
        const a = jointAngle(s.shoulder.L, s.elbow.L, s.hand.L)
        return Math.abs(a - 90) <= 5 || `cotovelo a ${Math.round(a)}° (esperado ~90°)`
      },
    },
  ],
  review: { status: 'verificado' },
}

export default roscaHalteres
