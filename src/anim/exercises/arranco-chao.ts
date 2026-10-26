import { STAND_Y, type Side, type Skeleton } from '../body'
import { lib } from '../checks'
import { both, footFlat, footOnToes, hang, mirrorFoot, mirrorZ, pressUp, shouldersOf, type Foot, type PoseSpec } from '../pose'
import { DIM } from '../props'
import type { ExerciseSpec } from '../spec'
import { add, sub, unit, v, type V3 } from '../vec'
import { catchFeet, JUMP_CHECKS } from './power-clean'

/*
 * Arranco (snatch) do chão: entrada `lpo-snatch-chao` do catálogo (src/data/lpo.ts). Mesma lógica dos cleans
 * (referências do usuário em Documents/mocks-animacao/referencias): a barra sobe pelo empurrão das pernas
 * (ponta dos pés e um saltinho, braços quase estendidos), quase para no alto e o corpo cai por baixo dela; os
 * cotovelos sobem e saem enquanto o ombro desce, os braços travam a barra acima da cabeça num agachamento
 * parcial e o atleta desce com ela até o fundo ("ajuste de altura"), depois sobe com a barra travada.
 *
 * Pegada larga de arranco (mãos em z = ±56). A altura do corpo em cada pose é calculada para a barra ficar onde
 * deve (anilha no chão, acima do joelho, dobra do quadril, pico da barra): `pelvisFor`.
 * Simplificações (as mesmas dos cleans): sem encolhimento dos ombros nem giro dos punhos.
 */

// pegada larga de arranco (mãos ~1,1 m uma da outra): com ela a barra fica mais baixa acima da cabeça
export const GRIP_Z = 56
const BAR_X = 7
export const flat = both(footFlat(0, 11, -6), mirrorFoot)
const toes = both(footOnToes(0, 11, 9, -6), mirrorFoot)
const lift = (f: Foot, dy: number): Foot => ({ ankle: add(f.ankle, v(0, dy, 0)), toe: add(f.toe, v(0, dy, 0)) })
const hopFeet = both(lift(footOnToes(0, 11, 9, -6), 2.5), mirrorFoot)
const airFeet = both(footFlat(0, 14, -11, 2.5), mirrorFoot)
// guias do cotovelo: braços estendidos e abertos (pegada larga) / passagem por baixo (cotovelos altos e por fora)
// / travados acima da cabeça (dobra do cotovelo para a frente)
// (pendurado: cotovelos para trás; para fora, ao baixar a barra de cima da cabeça o antebraço entrava na anilha)
export const POLE_HANG = both(v(-1, 0, 0.4), mirrorZ)
const POLE_PULL = both(v(-0.2, 1, 0.9), mirrorZ)
export const POLE_LOCK = both(v(-0.6, 0, 1), mirrorZ)
const knee = (feet: Record<Side, Foot>) => both(unit(sub(feet.L.toe, feet.L.ankle)), mirrorZ)

type Base = Omit<PoseSpec, 'hands'>
const base = (pelvis: V3, pitch: number, head: number, feet: Record<Side, Foot>, elbowPole: Record<Side, V3>): Base => ({ pelvis, pitch, head, feet, elbowPole, kneePole: knee(feet) })
/** Braços estendidos para baixo (barra pendurada) ou para cima (travada), em x = `x`. */
const hands = (b: Base, x: number, up: boolean, straight = 0.996) => (up ? pressUp(b, x, GRIP_Z, straight) : hang(b, x, GRIP_Z, straight))

/** Altura da pelve que põe a barra (braços estendidos) na altura `barY`: busca binária (a barra sobe com a pelve). */
export function pelvisFor(x: number, pitch: number, head: number, feet: Record<Side, Foot>, pole: Record<Side, V3>, barX: number, barY: number, up: boolean, straight = 0.99): PoseSpec {
  let lo = 20
  let hi = STAND_Y + 12
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const y = hands(base(v(x, mid, 0), pitch, head, feet, pole), barX, up, straight).L[1]
    if (y > barY) hi = mid
    else lo = mid
  }
  const b = base(v(x, (lo + hi) / 2, 0), pitch, head, feet, pole)
  return { ...b, hands: hands(b, barX, up, straight) }
}

/** Posição inicial: anilhas no chão, pegada larga, quadril um pouco mais baixo que no clean. */
export const SETUP = pelvisFor(-29, 52, 10, flat, POLE_HANG, BAR_X + 3, DIM.bar.plateRadius, false)
/**
 * Barra passando o joelho: o quadril sobe junto com os ombros e os joelhos recuam (canela quase vertical) para a
 * barra passar à frente deles (com o quadril baixo os joelhos ficavam na frente da barra).
 */
export const KNEE = pelvisFor(-31, 50, 8, flat, POLE_HANG, BAR_X + 4, 52, false)
/** Barra na dobra do quadril (posição de potência do arranco): tronco mais vertical, joelhos por baixo da barra. */
export const POWER = pelvisFor(-9, 14, 4, flat, POLE_HANG, BAR_X + 4, 76, false)
/** Extensão: na ponta dos pés, quadril e joelhos estendidos, braços estendidos. */
export const EXTENSION: PoseSpec = (() => {
  const b = base(v(-1, STAND_Y + 5, 0), -6, -2, toes, POLE_HANG)
  return { ...b, hands: hang(b, BAR_X + 4, GRIP_Z, 0.99) }
})()
/** Saltinho: pés fora do chão, corpo estendido, braços quase estendidos (a barra sobe pelas pernas). */
export const JUMP: PoseSpec = (() => {
  const b = base(v(0, STAND_Y + 9, 0), -4, -2, hopFeet, POLE_HANG)
  return { ...b, hands: hang(b, BAR_X + 5, GRIP_Z, 0.93) }
})()

/** Em pé, barra travada acima da cabeça (sobre o meio do pé). */
export const STAND_OH: PoseSpec = (() => {
  const b = base(v(-2, STAND_Y - 0.6, 0), 2, 0, catchFeet, POLE_LOCK)
  return { ...b, hands: pressUp(b, BAR_X, GRIP_Z) }
})()
/** Fundo: agachamento completo com a barra travada acima da cabeça (como o agachamento overhead). */
export const BOTTOM: PoseSpec = (() => {
  const b = base(v(-19, 37, 0), 24, -6, catchFeet, POLE_LOCK)
  return { ...b, hands: pressUp(b, BAR_X, GRIP_Z) }
})()
const BOTTOM_BAR = BOTTOM.hands.L[1]
/** Encontro: os braços travam a barra num agachamento parcial, ~6 cm acima de onde ela fica no fundo. */
export const MEET = pelvisFor(-12, 14, -16, catchFeet, POLE_LOCK, BAR_X + 4, BOTTOM_BAR + 6, true, 0.996) // um pouco à frente: travando direto sobre o meio do pé a barra passava pela cabeça
/** Pico da barra (logo antes de travar os braços). */
export const PEAK = BOTTOM_BAR + 8
/**
 * Passagem por baixo: a barra no pico, quase parada, à frente do rosto; o corpo caindo (pés no ar, indo para a
 * base do encaixe); os cotovelos altos e por fora, puxando o corpo para baixo da barra.
 */
export const TURNOVER: PoseSpec = (() => {
  // queixo para cima: a cabeça sai do caminho da barra, que passa por cima dela
  const b0 = base(v(-6, 0, 0), 6, -14, airFeet, POLE_PULL)
  const sh0 = shouldersOf(b0).L
  // a barra 8 cm abaixo do ombro (puxada alta de arranco): o corpo começando a cair, cotovelos altos e por fora
  const pelvisY = PEAK - 3 + 8 - sh0[1]
  const b = base(v(-6, pelvisY, 0), 6, -14, airFeet, POLE_PULL)
  const sh = shouldersOf(b).L
  return { ...b, hands: both(v(sh[0] + 20, PEAK - 3, GRIP_Z), mirrorZ) }
})()
/**
 * Volta, 1º passo: a barra desce de cima da cabeça para a frente do peito, cotovelos para baixo (direto para o
 * quadril ela passaria pelo rosto; com a mão em arco em volta do ombro o braço abria para o lado e a barra
 * "esticava").
 */
export const FRONT: PoseSpec = (() => {
  const b = base(v(-2, STAND_Y - 0.6, 0), 3, 0, flat, both(v(-0.6, -0.6, 0.2), mirrorZ))
  const sh = shouldersOf(b).L
  return { ...b, hands: both(v(sh[0] + 28, sh[1] - 12, GRIP_Z), mirrorZ) }
})()
/** Volta: barra desce até o quadril (braços estendidos). */
export const HIP: PoseSpec = (() => {
  const b = base(v(-2, STAND_Y - 0.15, 0), 0, 0, flat, POLE_HANG)
  return { ...b, hands: hang(b, BAR_X + 3, GRIP_Z, 0.99) }
})()

export const fmt = (n: number) => n.toFixed(1).replace('.', ',')
/** Braços travados acima da cabeça: cotovelos estendidos e a barra acima da cabeça. */
export const LOCK_CHECKS = (poses: string[]) =>
  poses.flatMap((pose) => [
    { name: `Braços travados (${pose.toLowerCase()})`, at: { pose }, test: lib.elbow(165, 180) },
    {
      name: `Barra acima da cabeça (${pose.toLowerCase()})`,
      at: { pose },
      test: (s: Skeleton) => {
        const d = s.hand.L[1] - s.head[1]
        return d >= 15 || `barra ${fmt(d)} cm acima do centro da cabeça (mín. 15)`
      },
    },
  ])
export const SNATCH_CHECKS = [
  { name: 'Barra nivelada', at: 'all' as const, test: lib.handsLevel(1) },
  { name: 'Movimento simétrico', at: 'all' as const, test: lib.symmetric(1) },
  ...JUMP_CHECKS,
  ...LOCK_CHECKS(['Encontro com a barra', 'Fundo do agachamento', 'Em pé com a barra acima da cabeça']),
  {
    name: 'Cotovelos altos e por fora ao entrar sob a barra',
    at: { pose: 'Passagem por baixo da barra' },
    test: (s: Skeleton) => {
      for (const k of ['L', 'R'] as const) {
        const out = Math.abs(s.elbow[k][2]) - Math.abs(s.shoulder[k][2])
        const up = s.elbow[k][1] - s.shoulder[k][1]
        if (out < 5 || up < -8) return `cotovelo (${k}) ${fmt(out)} cm por fora e ${fmt(up)} cm acima do ombro`
      }
      return true
    },
  },
  {
    name: 'Quadril abaixo dos joelhos no fundo',
    at: { pose: 'Fundo do agachamento' },
    test: (s: Skeleton) => {
      for (const k of ['L', 'R'] as const) {
        const d = s.knee[k][1] - s.hip[k][1]
        if (d < 2) return `quadril (${k}) ${fmt(-d)} cm acima do joelho`
      }
      return true
    },
  },
  { name: 'Barra sobre o meio do pé no fundo', at: { pose: 'Fundo do agachamento' }, test: lib.barOverMidfoot(8) },
  { name: 'Pés apoiados no fundo', at: { pose: 'Fundo do agachamento' }, test: lib.feetFlat(0, 1.5) },
  { name: 'Joelhos na direção das pontas dos pés no fundo', at: { pose: 'Fundo do agachamento' }, test: lib.kneeTracksFoot(20) },
]
export const SNATCH_MUSCLES = {
  pull1: { phase: 'Primeira puxada', primary: ['quadriceps', 'gluteos'], secondary: ['posteriores', 'eretores', 'trapezio', 'antebraco'] },
  pull2: { phase: 'Segunda puxada', primary: ['gluteos', 'posteriores', 'quadriceps'], secondary: ['panturrilhas', 'trapezio', 'eretores'] },
  catch: { phase: 'Encaixe', primary: ['trapezio', 'deltoide_lateral', 'quadriceps'], secondary: ['deltoide_anterior', 'triceps', 'gluteos', 'abdomen'] },
  rec: { phase: 'Recuperação', primary: ['quadriceps', 'gluteos'], secondary: ['deltoide_anterior', 'trapezio', 'abdomen', 'eretores'] },
  ret: { phase: 'Retorno', primary: ['posteriores', 'gluteos'], secondary: ['eretores', 'antebraco'] },
} as const
export const SNATCH_SOURCE =
  'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, levantamentos olímpicos (extensores de quadril, joelho e tornozelo nas puxadas; trapézio e deltoides ao entrar sob a barra; deltoides, tríceps e tronco estabilizando a barra acima da cabeça). Distribuição por fase a validar na revisão.'

export const arrancoChao: ExerciseSpec = {
  id: 'lpo-snatch-chao',
  datasetId: 'lpo-snatch-chao',
  name: 'Arranco do chão (snatch)',
  camera: { yaw: 35, pitch: 8 },
  phases: [
    { name: 'Primeira puxada', description: 'Empurra o chão com as pernas; a barra sobe rente às canelas até a dobra do quadril, braços estendidos e pegada larga.' },
    { name: 'Segunda puxada', description: 'Explode o quadril para a frente, sobe na ponta dos pés e dá um saltinho; os braços continuam quase estendidos.' },
    { name: 'Encaixe', description: 'Com a barra subindo pela inércia, entra por baixo dela com os cotovelos altos e por fora, trava os braços acima da cabeça e desce com a barra até o fundo do agachamento.' },
    { name: 'Recuperação', description: 'Sobe do agachamento com a barra travada acima da cabeça, sobre o meio do pé.' },
    { name: 'Retorno', description: 'Desce a barra até o quadril e depois ao chão.' },
  ],
  keyPoints: [
    'Pegada larga: a barra fica na dobra do quadril com os braços estendidos',
    'Barra sobre o meio do pé e rente ao corpo na puxada',
    'Saltinho na ponta dos pés com os braços quase estendidos: a barra sobe pelo empurrão das pernas',
    'Cotovelos altos e por fora ao entrar sob a barra; braços travados acima da cabeça',
    'Recepção no fundo do agachamento, barra sobre o meio do pé',
  ],
  muscles: [SNATCH_MUSCLES.pull1, SNATCH_MUSCLES.pull2, SNATCH_MUSCLES.catch, SNATCH_MUSCLES.rec, SNATCH_MUSCLES.ret].map((m) => ({ ...m, primary: [...m.primary], secondary: [...m.secondary] })),
  muscleSource: SNATCH_SOURCE,
  props: [{ kind: 'barbell' }],
  stills: ['Posição inicial', 'Barra na dobra do quadril', 'Saltinho', 'Fundo do agachamento', 'Em pé com a barra acima da cabeça'],
  // o fundo do agachamento é a pose do meio (miniatura do app); `handPath: 'shoulder'` nas transições com os
  // braços estendidos ou travados (a barra acompanha o ombro)
  frames: [
    { name: 'Barra no joelho', pose: KNEE, moveMs: 700, holdMs: 0, phase: 'Primeira puxada', ease: 'in', handPath: 'shoulder' },
    { name: 'Barra na dobra do quadril', pose: POWER, moveMs: 320, holdMs: 0, phase: 'Primeira puxada', ease: 'linear', handPath: 'shoulder' },
    // da posição de potência ao saltinho os calcanhares sobem (extensão na ponta dos pés) e os pés saem do chão
    { name: 'Saltinho', pose: JUMP, moveMs: 440, holdMs: 0, phase: 'Segunda puxada', ease: 'linear', handPath: 'shoulder' },
    { name: 'Passagem por baixo da barra', pose: TURNOVER, moveMs: 380, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Encontro com a barra', pose: MEET, moveMs: 420, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Fundo do agachamento', pose: BOTTOM, moveMs: 600, holdMs: 500, phase: 'Encaixe', ease: 'out', handPath: 'shoulder' },
    { name: 'Em pé com a barra acima da cabeça', pose: STAND_OH, moveMs: 1300, holdMs: 500, phase: 'Recuperação', ease: 'inout', handPath: 'shoulder' },
    { name: 'Barra à frente do peito', pose: FRONT, moveMs: 700, holdMs: 0, phase: 'Retorno', ease: 'in' },
    // da frente do peito direto para o joelho, por fora das coxas (do quadril para o chão a barra passava pelos joelhos)
    { name: 'Barra descendo no joelho', pose: KNEE, moveMs: 700, holdMs: 0, phase: 'Retorno', ease: 'linear' },
    { name: 'Posição inicial', pose: SETUP, moveMs: 800, holdMs: 500, phase: 'Retorno', ease: 'out', handPath: 'shoulder' },
  ],  checks: [
    ...SNATCH_CHECKS,
    {
      name: 'Anilhas no chão na posição inicial',
      at: { pose: 'Posição inicial' },
      test: (s: Skeleton) => Math.abs(s.hand.L[1] - DIM.bar.plateRadius) <= 1.5 || `barra a ${fmt(s.hand.L[1] - DIM.bar.plateRadius)} cm do chão`,
    },
    { name: 'Barra sobre o meio do pé na primeira puxada', at: { phase: 'Primeira puxada' }, test: lib.barOverMidfoot(5) },
    ...['Posição inicial', 'Barra no joelho', 'Barra na dobra do quadril'].map((pose) => ({ name: `Braços estendidos (${pose.toLowerCase()})`, at: { pose }, test: lib.elbow(160, 180) })),
    { name: 'Pés apoiados na posição inicial', at: { pose: 'Posição inicial' }, test: lib.feetFlat(0, 1.5) },
  ],
  review: { status: 'rascunho', notes: 'Mesma lógica dos cleans (saltinho, barra quase parada no alto, ajuste de altura), com a recepção acima da cabeça.' },
}

export default arrancoChao
