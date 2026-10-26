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
/** Base da puxada: pés na largura do quadril, pontas levemente para fora. */
export const flat = both(footFlat(0, 11, -6), mirrorFoot)
const toes = (lift: number): Record<Side, Foot> => both(footOnToes(0, 11, lift, -6), mirrorFoot)
/** Base do encaixe: os pés "pulam" para fora (≈ largura dos ombros) e as pontas abrem (referência do usuário). */
export const catchFeet = both(footFlat(0, 16, -15), mirrorFoot)
/** Saltinho (fim da segunda puxada): na ponta dos pés e 2,5 cm fora do chão. */
const hopFeet = both(((f: Foot): Foot => ({ ankle: add(f.ankle, v(0, 2.5, 0)), toe: add(f.toe, v(0, 2.5, 0)) }))(footOnToes(0, 11, 9, -6)), mirrorFoot)
/** Pés no ar no meio da passagem por baixo, já indo para a base do encaixe. */
const airFeet = both(footFlat(0, 14, -11, 2.5), mirrorFoot)
// Guias do cotovelo (para onde ele dobra). Cada uma precisa ficar LONGE do eixo ombro→punho daquela pose: com a
// guia quase alinhada com o braço a cinemática inversa não sabe para que lado dobrar e o cotovelo salta de lado.
// Entre poses a guia gira com velocidade angular uniforme (spec.ts), o que permite giros grandes sem salto.
// braços estendidos (barra pendurada): cotovelos para trás
const POLE_BACK = both(v(-1, 0, 0.3), mirrorZ)
// saltinho (braços quase estendidos, pegada pronada): cotovelos para fora
const POLE_OUT = both(v(-0.2, 0.1, 1), mirrorZ)
// passagem por baixo: o corpo cai e os cotovelos dobram ABRINDO para os lados, por baixo da barra (na altura dela o
// antebraço batia na barra por fora das mãos); daí giram para a frente até o rack.
// Par passagem/rack achado por busca no motor (scratch polesearch): sem salto e com os cotovelos sempre a mais de
// 12 cm do meio do corpo (com guias para dentro eles cruzavam à frente do peito)
const POLE_TURN = both(v(0, -0.4, 1), mirrorZ)
// rack (barra em cima do deltoide): cotovelos à frente (~21 cm), um pouco abaixo do ombro e para dentro
export const POLE_RACK = both(v(1, -0.4, -0.3), mirrorZ)
// barra saindo dos ombros (à frente do peito, braços dobrados): cotovelos para baixo e para trás, por baixo da
// barra. Fica entre a guia do rack e a dos braços estendidos (quase opostas: direto de uma para a outra o
// cotovelo saltava) e longe do braço, que aqui aponta para a frente e para baixo
const POLE_DOWN = both(v(-0.6, -0.6, 0.2), mirrorZ)
type Base = Omit<PoseSpec, 'hands'>
export const base = (pelvis: V3, pitch: number, head: number, feet: Record<Side, Foot>, elbowPole: Record<Side, V3>): Base => ({ pelvis, pitch, head, feet, elbowPole })
/** Braços estendidos (`straight` = fração do alcance) segurando a barra sobre o meio do pé (como no terra). */
const hanging = (b: Base, x = BAR_X, straight = 0.996): PoseSpec => ({ ...b, hands: hang(b, x, GRIP_Z, straight) })
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
/**
 * Barra numa ALTURA FIXA no mundo (`y`, cm), `dx` à frente do ombro. Da puxada alta ao encaixe quem manda é a
 * barra: depois da extensão ela sobe só pela inércia, quase para no alto e o corpo é que desce por baixo dela.
 * Com a barra presa ao ombro ela subia junto com o corpo (até a altura do rosto) e caía com ele.
 */
export const barAtY = (b: Base, dx: number, y: number): PoseSpec => {
  const sh = shouldersOf(b).L
  return { ...b, hands: both(v(sh[0] + dx, y, GRIP_Z), mirrorZ) }
}
/**
 * Saltinho (fim da segunda puxada): quem sobe a barra são as pernas e o quadril. O atleta fica na ponta dos pés e
 * sai um pouco do chão com o corpo todo estendido e os braços QUASE estendidos (~140° no cotovelo: a barra é
 * pesada, os braços não a levantam). Depois dele a barra sobe só pela inércia e o corpo entra por baixo; o
 * cotovelo dobra porque o ombro desce e passa pela barra (com os braços puxando a barra, eles dobravam demais,
 * "elásticos").
 */
export const jump = (): PoseSpec => hanging(base(v(0, STAND_Y + 9, 0), -4, -2, hopFeet, POLE_OUT), BAR_X + 5, 0.93)/**
 * Passagem por baixo da barra (turnover): a barra no ponto mais alto (`barY`, quase parada) e o corpo começando a
 * descer por baixo dela (pés no ar indo para a base do encaixe). A pelve é posta para a barra ficar `below` cm
 * abaixo do ombro (~14–20): aí os cotovelos giram para a frente na altura do ombro e o punho começa a virar sob a barra.
 */
export const turnover = (barY: number, below = 20, pitch = 6): PoseSpec => {
  const b0 = base(v(-6, 0, 0), pitch, 0, airFeet, POLE_TURN)
  const pelvisY = barY + below - shouldersOf(b0).L[1]
  return { ...barAtY(base(v(-6, pelvisY, 0), pitch, 0, airFeet, POLE_TURN), 20, barY), rack: { L: 0.5, R: 0.5 } }
}
// power clean: barra ~92 cm no saltinho, sobe pela inércia até ~116 enquanto o corpo começa a cair e o encaixe
// (coxa acima da paralela) a recebe logo abaixo do pico
const JUMP = jump()
const TURNOVER = turnover(116, 18)
/** Barra em cima do deltoide (à frente e acima do ombro): braço perto da horizontal e cotovelo à frente (pose.ts, `rack`). */
export const RACK = { dx: 11, dy: 7.5 }
/** Encaixe (passo 5): barra apoiada na frente dos ombros, cotovelos à frente, agachamento frontal alto, base aberta. */
const CATCH = racked(fromShoulder(base(v(-14, STAND_Y - 33.5, 0), 10, 2, catchFeet, POLE_RACK), RACK.dx + 1, RACK.dy))
/**
 * Barra saindo dos ombros (início da volta): os cotovelos CAEM e a barra desce pela frente do peito; os pés voltam
 * para a base da puxada. Sem esta pose, da barra nos ombros (cotovelos à frente) direto para os braços estendidos
 * (cotovelos para trás), a guia do cotovelo passava por "para cima": os cotovelos subiam por cima da barra.
 */
export const UNRACK = fromShoulder(base(v(-2, STAND_Y - 0.3, 0), 3, 0, flat, POLE_DOWN), 20, -26)
/** Em pé com a barra nos ombros, ainda na base do encaixe. */
export const STAND = racked(fromShoulder(base(v(-2, STAND_Y - 0.6, 0), 2, 0, catchFeet, POLE_RACK), RACK.dx, RACK.dy))
export const fmt = (n: number) => n.toFixed(1).replace('.', ',')
/** Barra (meio das mãos) em relação ao ombro esquerdo/direito médio: [à frente, acima]. */
const barVsShoulder = (s: Skeleton) => {
  const b = midHands(s)
  const sh = [(s.shoulder.L[0] + s.shoulder.R[0]) / 2, (s.shoulder.L[1] + s.shoulder.R[1]) / 2]
  return [b[0] - sh[0], b[1] - sh[1]] as const
}
export const barOnShoulders = (s: Skeleton) => {
  const [dx, dy] = barVsShoulder(s)
  return (dx >= 6 && dx <= 16 && dy >= 2 && dy <= 10) || `barra ${fmt(dx)} cm à frente e ${fmt(dy)} cm acima dos ombros (esperado 6–16 à frente, 2 a 10 acima)`
}
/** Antebraço (cotovelo → punho) em relação à vertical para baixo, graus: 0 = pendurado, 180 = apontando para cima. */
const forearmFromDown = (s: Skeleton, k: Side) => {
  const f = [s.wrist[k][0] - s.elbow[k][0], s.wrist[k][1] - s.elbow[k][1], s.wrist[k][2] - s.elbow[k][2]]
  return (Math.acos(-f[1] / Math.hypot(f[0], f[1], f[2])) * 180) / Math.PI
}
/**
 * Saltinho: pés fora do chão, corpo estendido e braços QUASE estendidos (a barra sobe pelas pernas e pelo quadril;
 * com os braços dobrando aqui o cotovelo ficava "elástico", como se a barra não pesasse).
 */
export const JUMP_CHECKS = [
  { name: 'Pés fora do chão no saltinho', at: { pose: 'Saltinho' }, test: lib.feetOffFloor(1) },
  { name: 'Braços quase estendidos no saltinho (a barra sobe pelas pernas)', at: { pose: 'Saltinho' }, test: lib.elbow(130, 180) },
  { name: 'Joelhos estendidos no saltinho', at: { pose: 'Saltinho' }, test: lib.knee(160, 180) },
]/** Barra nos ombros: antebraços subindo do cotovelo até a mão (contra a gravidade), cotovelo à frente. */
export const forearmsUp = (s: Skeleton) => {
  for (const k of ['L', 'R'] as const) {
    const a = forearmFromDown(s, k)
    if (a < 100) return `antebraço (${k}) a ${Math.round(a)}° da vertical para baixo (esperado ≥ 100°: subindo até a barra)`
  }
  return true
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
    { name: 'Segunda puxada', description: 'Explode o quadril para a frente, sobe na ponta dos pés e dá um saltinho; os braços continuam quase estendidos.' },
    { name: 'Encaixe', description: 'Com a barra subindo pela inércia, entra por baixo dela: os cotovelos dobram para fora e giram para a frente; recebe a barra nos ombros em agachamento alto.' },
    { name: 'Recuperação', description: 'Fica em pé com a barra apoiada nos ombros, cotovelos à frente.' },
    { name: 'Retorno', description: 'Desce a barra pela frente das pernas até o joelho e depois ao chão.' },
  ],
  keyPoints: [
    'Barra sobre o meio do pé e rente ao corpo na puxada',
    'Braços estendidos até a extensão completa (quem puxa são as pernas e o quadril)',
    'Extensão completa: quadril e joelhos estendidos, na ponta dos pés',
    'Saltinho na ponta dos pés com os braços quase estendidos: a barra sobe pelo empurrão das pernas, não pelos braços',
    'Os cotovelos só dobram quando o corpo entra por baixo da barra',
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
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, power clean (fases e músculos: extensores de quadril, joelho e tornozelo; trapézio e deltoides ao entrar sob a barra). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'barbell' }],
  // começa na barra no joelho para o encaixe cair na pose do meio (miniatura do app); a posição inicial fecha
  // o ciclo e a 1ª transição parte dela. `handPath: 'shoulder'`: com os braços estendidos quem leva a barra é
  // o ombro (a mão em arco em volta dele nunca passa do alcance)
  frames: [
    { name: 'Barra no joelho', pose: KNEE, moveMs: 700, holdMs: 0, phase: 'Primeira puxada', ease: 'in', handPath: 'shoulder' },
    { name: 'Barra no meio da coxa', pose: MID_THIGH, moveMs: 320, holdMs: 0, phase: 'Primeira puxada', ease: 'linear', handPath: 'shoulder' },
    { name: 'Extensão', pose: EXTENSION, moveMs: 260, holdMs: 0, phase: 'Segunda puxada', ease: 'linear', handPath: 'shoulder' },
    { name: 'Saltinho', pose: JUMP, moveMs: 200, holdMs: 0, phase: 'Segunda puxada', ease: 'linear' },
    // a virada tem o mesmo "câmera lenta" do resto (em tempo real os cotovelos giravam a ~7 m/s, elásticos)
    { name: 'Passagem por baixo da barra', pose: TURNOVER, moveMs: 400, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Encaixe', pose: CATCH, moveMs: 720, holdMs: 500, phase: 'Encaixe', ease: 'out' },
    { name: 'Em pé com a barra', pose: STAND, moveMs: 750, holdMs: 500, phase: 'Recuperação', ease: 'inout' },
    { name: 'Barra saindo dos ombros', pose: UNRACK, moveMs: 500, holdMs: 0, phase: 'Retorno', ease: 'in' },
    // desce pela frente das pernas até o joelho (direto para as coxas, a barra raspava nelas)
    { name: 'Barra descendo no joelho', pose: KNEE, moveMs: 800, holdMs: 0, phase: 'Retorno', ease: 'linear', handPath: 'shoulder' },
    { name: 'Posição inicial', pose: SETUP, moveMs: 700, holdMs: 500, phase: 'Retorno', ease: 'out', handPath: 'shoulder' },
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
    ...JUMP_CHECKS,
    { name: 'Antebraços subindo até a barra no encaixe', at: { pose: 'Encaixe' }, test: forearmsUp },
    { name: 'Antebraços subindo até a barra em pé', at: { pose: 'Em pé com a barra' }, test: forearmsUp },
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
    {
      name: 'Encaixe acima da paralela (quadril acima do joelho)',
      at: { pose: 'Encaixe' },
      test: (s: Skeleton) => {
        for (const k of ['L', 'R'] as const) {
          const d = s.hip[k][1] - s.knee[k][1]
          if (d < 2) return `quadril (${k}) ${fmt(d)} cm acima do joelho (mín. 2: power clean recebe acima da paralela)`
        }
        return true
      },
    },
    { name: 'Joelhos dobrados no encaixe (recebe a barra agachando)', at: { pose: 'Encaixe' }, test: lib.knee(70, 150) },
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

