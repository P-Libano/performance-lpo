import { STAND_Y, type Side, type Skeleton } from '../body'
import { lib } from '../checks'
import { both, footFlat, footOnToes, hang, mirrorFoot, mirrorZ, shouldersOf, type Foot, type PoseSpec } from '../pose'
import { DIM, midHands } from '../props'
import type { ExerciseSpec } from '../spec'
import { add, v, type V3 } from '../vec'

/*
 * Power clean (arremesso de potência, LPO): barra do chão até os ombros, com encaixe em agachamento frontal alto.
 * Referência visual: sequência "Power Clean" do journalmenu.com (5 passos: terra até o meio da coxa; braços
 * soltos e estendidos; quadril explode e ombros sobem; cotovelos puxam alto e passam por baixo da barra;
 * encaixe em agachamento frontal alto).
 *
 * Medidas (cm, atleta de 175 cm), mesmas do terra (terra.ts): tornozelo em x = 0, meio do pé em x ≈ 7, pegada
 * em z = ±30 (a barra é rígida: a distância entre as mãos é a mesma em todas as poses). Até a extensão as mãos
 * vêm de `hang()` (braços estendidos); da puxada alta em diante, de pontos relativos ao ombro.
 *
 * As poses e verificações da puxada são exportadas: o clean completo (clean.ts) usa as mesmas.
 *
 * Simplificações conscientes: (1) o encolhimento dos ombros (passo 3) não existe no esqueleto; (2) os pés não
 * saem do chão nem abrem no encaixe (no movimento real eles "pulam" para a base de agachamento).
 */

const GRIP_Z = 30
const BAR_X = 7 // sobre o meio do pé
export const flat = both(footFlat(0, 11, -6), mirrorFoot)
const toes = (lift: number): Record<Side, Foot> => both(footOnToes(0, 11, lift, -6), mirrorFoot)
// braços estendidos: cotovelos para trás; puxada alta: para cima e para fora; encaixe: à frente (sob a barra)
const POLE_BACK = both(v(-1, 0, 0.3), mirrorZ)
const POLE_HIGH = both(v(-0.2, 1, 0.9), mirrorZ)
export const POLE_RACK = both(v(1, 0.35, 0.3), mirrorZ)

type Base = Omit<PoseSpec, 'hands'>
export const base = (pelvis: V3, pitch: number, head: number, feet: Record<Side, Foot>, elbowPole: Record<Side, V3>): Base => ({ pelvis, pitch, head, feet, elbowPole })
/** Braços estendidos segurando a barra sobre o meio do pé (como no terra). */
const hanging = (b: Base, x = BAR_X): PoseSpec => ({ ...b, hands: hang(b, x, GRIP_Z) })
/** Barra num ponto relativo ao ombro (dx à frente, dy acima), na largura da pegada. */
export const fromShoulder = (b: Base, dx: number, dy: number): PoseSpec => {
  const sh = shouldersOf(b).L
  const p = add(sh, v(dx, dy, 0))
  return { ...b, hands: both(v(p[0], p[1], GRIP_Z), mirrorZ) }
}

/** Barra apoiada nos ombros: punho dobrado para trás sob a barra (`rack`). */
export const racked = (p: PoseSpec): PoseSpec => ({ ...p, rack: { L: 1, R: 1 } })

/** Posição inicial: anilhas no chão, ombros um pouco à frente da barra, costas neutras (= terra). */
export const SETUP = hanging(base(v(-30, 60, 0), 58, 10, flat, POLE_BACK))
/** Barra passando o joelho: o quadril sobe junto com os ombros (= terra). */
export const KNEE = hanging(base(v(-25.6, STAND_Y - 10.4, 0), 45, 8, flat, POLE_BACK))
/** Barra no meio da coxa ("posição de potência"): joelhos voltam a dobrar por baixo da barra, tronco mais vertical. */
export const MID_THIGH = hanging(base(v(-11, STAND_Y - 8, 0), 20, 4, flat, POLE_BACK))
/** Extensão (passo 3): quadril e joelhos estendidos na ponta dos pés, tronco levemente para trás, braços soltos. */
export const EXTENSION = hanging(base(v(-1, STAND_Y + 5, 0), -6, -2, toes(9), POLE_BACK), BAR_X + 4)
/** Puxada alta (passo 4): cotovelos altos e por fora, barra subindo rente ao peito, ainda na ponta dos pés. */
export const HIGH_PULL = fromShoulder(base(v(-2, STAND_Y + 2, 0), -4, -2, toes(6), POLE_HIGH), 15, -20)
/** Encaixe (passo 5): barra apoiada na frente dos ombros, cotovelos à frente, agachamento frontal alto. */
const CATCH = racked(fromShoulder(base(v(-13, STAND_Y - 24, 0), 12, 2, flat, POLE_RACK), 12, 1))
/** Em pé com a barra nos ombros. */
export const STAND = racked(fromShoulder(base(v(-2, STAND_Y - 0.3, 0), 2, 0, flat, POLE_RACK), 12, 1))

export const fmt = (n: number) => n.toFixed(1).replace('.', ',')
/** Barra (meio das mãos) em relação ao ombro esquerdo/direito médio: [à frente, acima]. */
const barVsShoulder = (s: Skeleton) => {
  const b = midHands(s)
  const sh = [(s.shoulder.L[0] + s.shoulder.R[0]) / 2, (s.shoulder.L[1] + s.shoulder.R[1]) / 2]
  return [b[0] - sh[0], b[1] - sh[1]] as const
}
export const barOnShoulders = (s: Skeleton) => {
  const [dx, dy] = barVsShoulder(s)
  return (dx >= 4 && dx <= 18 && dy >= -6 && dy <= 5) || `barra ${fmt(dx)} cm à frente e ${fmt(dy)} cm acima dos ombros (esperado 4–18 à frente, −6 a 5)`
}
export const STRAIGHT_ARMS = ['Posição inicial', 'Barra no joelho', 'Barra no meio da coxa', 'Extensão']

export const powerClean: ExerciseSpec = {
  id: 'lpo-power-clean',
  datasetId: 'lpo-power-clean',
  name: 'Power clean',
  // 3/4 de frente, como a referência: de perfil a anilha da frente tapa o tronco e os braços
  camera: { yaw: 35, pitch: 8 },
  phases: [
    { name: 'Primeira puxada', description: 'Empurra o chão com as pernas; a barra sobe rente às canelas até o meio da coxa, braços estendidos.' },
    { name: 'Segunda puxada', description: 'Explode o quadril para a frente e sobe na ponta dos pés; os braços continuam soltos.' },
    { name: 'Encaixe', description: 'Puxa os cotovelos para cima e passa-os por baixo da barra; recebe a barra nos ombros em agachamento alto.' },
    { name: 'Recuperação', description: 'Fica em pé com a barra apoiada nos ombros, cotovelos à frente.' },
    { name: 'Retorno', description: 'Desce a barra pela frente das pernas até o joelho e depois ao chão.' },
  ],
  keyPoints: [
    'Barra sobre o meio do pé e rente ao corpo na puxada',
    'Braços estendidos até a extensão completa (quem puxa são as pernas e o quadril)',
    'Extensão completa: quadril e joelhos estendidos, na ponta dos pés',
    'Cotovelos altos e por fora na puxada alta',
    'Encaixe com a barra apoiada na frente dos ombros e cotovelos à frente',
    'Recepção em agachamento alto (coxa acima da paralela)',
  ],
  muscles: [
    { phase: 'Primeira puxada', primary: ['quadriceps', 'gluteos'], secondary: ['posteriores', 'eretores', 'trapezio', 'antebraco'] },
    { phase: 'Segunda puxada', primary: ['gluteos', 'posteriores', 'quadriceps'], secondary: ['panturrilhas', 'trapezio', 'eretores'] },
    { phase: 'Encaixe', primary: ['trapezio', 'quadriceps'], secondary: ['deltoide_anterior', 'deltoide_lateral', 'gluteos', 'abdomen'] },
    { phase: 'Recuperação', primary: ['quadriceps', 'gluteos'], secondary: ['abdomen', 'eretores', 'deltoide_anterior'] },
    { phase: 'Retorno', primary: ['posteriores', 'gluteos'], secondary: ['eretores', 'antebraco'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, power clean (fases e músculos: extensores de quadril, joelho e tornozelo; trapézio e deltoides na puxada alta). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'barbell' }],
  // começa na barra passando o joelho para o encaixe cair na pose do meio (miniatura do app); o ciclo fecha
  // na posição inicial, de onde parte a primeira transição. `handPath: 'shoulder'`: com os braços
  // estendidos quem leva a barra é o ombro (a mão em arco em volta dele nunca passa do alcance)
  frames: [
    { name: 'Barra no joelho', pose: KNEE, moveMs: 700, holdMs: 0, phase: 'Primeira puxada', ease: 'in', handPath: 'shoulder' },
    { name: 'Barra no meio da coxa', pose: MID_THIGH, moveMs: 320, holdMs: 0, phase: 'Primeira puxada', ease: 'linear' },
    { name: 'Extensão', pose: EXTENSION, moveMs: 220, holdMs: 0, phase: 'Segunda puxada', ease: 'linear' },
    { name: 'Puxada alta', pose: HIGH_PULL, moveMs: 200, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Encaixe', pose: CATCH, moveMs: 240, holdMs: 450, phase: 'Encaixe', ease: 'out' },
    { name: 'Em pé com a barra', pose: STAND, moveMs: 750, holdMs: 500, phase: 'Recuperação', ease: 'inout' },
    // desce pela frente das pernas até o joelho (direto para as coxas, a barra raspava nelas)
    { name: 'Barra descendo no joelho', pose: KNEE, moveMs: 900, holdMs: 0, phase: 'Retorno', ease: 'in', handPath: 'shoulder' },
    { name: 'Posição inicial', pose: SETUP, moveMs: 700, holdMs: 500, phase: 'Retorno', ease: 'out' },
  ],  checks: [
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Barra sobre o meio do pé na primeira puxada', at: { phase: 'Primeira puxada' }, test: lib.barOverMidfoot(5) },
    ...STRAIGHT_ARMS.map((pose) => ({ name: `Braços estendidos (${pose.toLowerCase()})`, at: { pose }, test: lib.elbow(160, 180) })),
    {
      name: 'Anilhas no chão na posição inicial',
      at: { pose: 'Posição inicial' },
      test: (s: Skeleton) => Math.abs(s.hand.L[1] - DIM.bar.plateRadius) <= 1.5 || `barra a ${fmt(s.hand.L[1] - DIM.bar.plateRadius)} cm do chão`,
    },
    ...['Posição inicial', 'Encaixe', 'Em pé com a barra'].map((pose) => ({ name: `Pés apoiados (${pose.toLowerCase()})`, at: { pose }, test: lib.feetFlat(0, 1.5) })),
    {
      name: 'Na ponta dos pés na extensão',
      at: { pose: 'Extensão' },
      test: (s: Skeleton) => {
        const lift = Math.min(s.heel.L[1], s.heel.R[1])
        return lift >= 4 || `calcanhar a ${fmt(lift)} cm do chão (mín. 4)`
      },
    },
    { name: 'Joelhos estendidos na extensão', at: { pose: 'Extensão' }, test: lib.knee(160, 180) },
    { name: 'Tronco vertical ou levemente para trás na extensão', at: { pose: 'Extensão' }, test: lib.trunkLean(-15, 3) },
    {
      name: 'Cotovelos altos e por fora na puxada alta',
      at: { pose: 'Puxada alta' },
      test: (s: Skeleton) => {
        for (const k of ['L', 'R'] as const) {
          const above = s.elbow[k][1] - s.hand[k][1]
          const out = Math.abs(s.elbow[k][2]) - Math.abs(s.shoulder[k][2])
          if (above < 3 || out < 3) return `cotovelo (${k}) ${fmt(above)} cm acima da mão e ${fmt(out)} cm por fora do ombro`
        }
        return true
      },
    },
    { name: 'Barra apoiada nos ombros no encaixe', at: { pose: 'Encaixe' }, test: barOnShoulders },
    { name: 'Barra apoiada nos ombros em pé', at: { pose: 'Em pé com a barra' }, test: barOnShoulders },
    {
      name: 'Cotovelos à frente no encaixe (braço perto da horizontal)',
      at: { pose: 'Encaixe' },
      test: (s: Skeleton) => {
        for (const k of ['L', 'R'] as const) {
          const fwd = s.elbow[k][0] - s.shoulder[k][0]
          const below = s.shoulder[k][1] - s.elbow[k][1]
          if (fwd < 10 || below > 16) return `cotovelo (${k}) ${fmt(fwd)} cm à frente e ${fmt(below)} cm abaixo do ombro`
        }
        return true
      },
    },
    { name: 'Encaixe em agachamento alto (coxa acima da paralela)', at: { pose: 'Encaixe' }, test: lib.knee(95, 150) },
    { name: 'Barra sobre o meio do pé no encaixe', at: { pose: 'Encaixe' }, test: lib.barOverMidfoot(8) },
    { name: 'Joelhos estendidos em pé', at: { pose: 'Em pé com a barra' }, test: lib.knee(165, 180) },
    { name: 'Joelhos na direção das pontas dos pés no encaixe', at: { pose: 'Encaixe' }, test: lib.kneeTracksFoot(20) },
  ],
  review: {
    status: 'rascunho',
    notes: 'Primeira versão a partir da sequência de referência enviada pelo usuário (journalmenu.com). Sem GIF do dataset para comparar.',
  },
}

export default powerClean

