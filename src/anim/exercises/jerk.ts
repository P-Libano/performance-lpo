import { STAND_Y, type Side, type Skeleton } from '../body'
import { lib } from '../checks'
import { both, footFlat, footOnToes, mirrorFoot, mirrorZ, pressUp, shouldersOf, type Foot, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { add, sub, unit, v, type V3 } from '../vec'
import { barOnShoulders, base, flat, fmt, forearmsUp, fromShoulder, POLE_RACK, RACK, racked } from './power-clean'

/*
 * Jerk em tesoura (split jerk, arremesso 2º tempo): entrada `lpo-jerk` do catálogo (src/data/lpo.ts).
 * Referência: sequência de arremesso do Fernando Reis, 220 kg (Hookgrip; Documents/mocks-animacao/referencias):
 * barra nos ombros → dip (joelhos dobram um pouco, tronco reto) → impulso (extensão até a ponta dos pés, os pés
 * saem do chão) → recepção em tesoura com os braços travados acima da cabeça (perna esquerda à frente, direita
 * atrás na ponta do pé) → o pé da frente volta, depois o de trás → em pé com a barra acima da cabeça → a barra
 * desce à frente do rosto até os ombros.
 *
 * Pegada do clean (mãos em z = ±30). Assimétrico na tesoura: sem a verificação de simetria.
 */

const GRIP_Z = 30
const lift = (f: Foot, dy: number): Foot => ({ ankle: add(f.ankle, v(0, dy, 0)), toe: add(f.toe, v(0, dy, 0)) })
const hopFeet = both(lift(footOnToes(0, 11, 9, -6), 2.5), mirrorFoot)
/** Tesoura: pé da frente (L) inteiro no chão; pé de trás (R) na ponta, calcanhar no ar. */
const splitFeet: Record<Side, Foot> = { L: footFlat(38, 13, -4), R: mirrorFoot(footOnToes(-68, 13, 10, 4)) }
/** Recuperação, 1º passo: o pé da frente voltou para perto do centro; o de trás ainda atrás, na ponta. */
const recoverFeet: Record<Side, Foot> = { L: footFlat(10, 12, -5), R: mirrorFoot(footOnToes(-48, 13, 10, 4)) }
// braços travados acima da cabeça: cotovelos para fora e para trás
const POLE_LOCK = both(v(-0.6, 0, 1), mirrorZ)
// barra descendo à frente do rosto: cotovelos para a frente e para fora
const POLE_LOWER = both(v(1, -0.2, 0.6), mirrorZ)
const kneeAlong = (feet: Record<Side, Foot>) => ({ L: unit(sub(feet.L.toe, feet.L.ankle)), R: unit(sub(feet.R.toe, feet.R.ankle)) })

/** Barra travada acima da cabeça, em x = `x`. */
const locked = (pelvis: V3, pitch: number, head: number, feet: Record<Side, Foot>, x: number): PoseSpec => {
  const b = { pelvis, pitch, head, feet, elbowPole: POLE_LOCK, kneePole: kneeAlong(feet) }
  return { ...b, hands: pressUp(b, x, GRIP_Z) }
}

/** Barra nos ombros (rack), em pé, pés na largura do quadril. */
const RACK_POSE = racked(fromShoulder(base(v(-2, STAND_Y - 0.6, 0), 2, 0, flat, POLE_RACK), RACK.dx, RACK.dy))
/** Dip: joelhos dobram um pouco com o tronco reto, barra nos ombros. */
const DIP = racked(fromShoulder(base(v(-5, STAND_Y - 6, 0), 3, 0, flat, POLE_RACK), RACK.dx, RACK.dy))
/** Impulso: extensão até a ponta dos pés e os pés saindo do chão; a barra sai dos ombros, os braços começam a empurrar. */
const DRIVE: PoseSpec = (() => {
  const b = { ...base(v(-1, STAND_Y + 8, 0), -2, -8, hopFeet, POLE_RACK), rack: { L: 0.4, R: 0.4 } }
  const sh = shouldersOf(b).L
  return { ...b, hands: both(v(sh[0] + 14, sh[1] + 18, GRIP_Z), mirrorZ) }
})()
/** Recepção em tesoura: braços travados acima da cabeça, barra sobre o meio da base, tronco reto. */
const SPLIT = locked(v(-2, 72, 0), 2, -8, splitFeet, 0)
/** O pé da frente volta primeiro. */
const RECOVER = locked(v(-12, 84, 0), 2, 0, recoverFeet, -5)
/** Em pé com a barra travada acima da cabeça, pés juntos de novo. */
const STAND_OH = locked(v(-2, STAND_Y - 0.6, 0), 2, 0, flat, 6)
/** Volta: a barra desce à frente do rosto (queixo para cima) até os ombros. */
const LOWER: PoseSpec = (() => {
  const b = base(v(-2, STAND_Y - 0.6, 0), 2, -12, flat, POLE_LOWER)
  const sh = shouldersOf(b).L
  return { ...b, hands: both(v(sh[0] + 26, sh[1] + 22, GRIP_Z), mirrorZ) }
})()

const legOf = (s: Skeleton, k: Side) => {
  const a = sub(s.hip[k], s.knee[k])
  const b = sub(s.ankle[k], s.knee[k])
  return (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)) * 180) / Math.PI
}

export const jerk: ExerciseSpec = {
  id: 'lpo-jerk',
  datasetId: 'lpo-jerk',
  name: 'Jerk em tesoura (arremesso, 2º tempo)',
  // 3/4 como a referência: mostra a tesoura das pernas sem a anilha tapar o tronco
  camera: { yaw: 55, pitch: 8 },
  phases: [
    { name: 'Dip', description: 'Com a barra apoiada nos ombros, flexiona levemente os joelhos com o tronco reto, sem deixar o peso ir para a ponta dos pés.' },
    { name: 'Impulso', description: 'Empurra o chão com força até a ponta dos pés e projeta a barra para cima.' },
    { name: 'Recepção', description: 'Afasta as pernas (uma à frente, outra atrás, na ponta do pé) e trava os braços com a barra acima da cabeça.' },
    { name: 'Recuperação', description: 'Recolhe primeiro o pé da frente, depois o de trás, e fica em pé com a barra estável acima da cabeça.' },
    { name: 'Retorno', description: 'Desce a barra à frente do rosto até apoiá-la de novo nos ombros.' },
  ],
  keyPoints: [
    'Barra apoiada nos ombros, cotovelos à frente, pés na largura do quadril',
    'Dip curto com o tronco reto: só os joelhos dobram',
    'Impulso até a ponta dos pés; a barra sai dos ombros empurrada pelas pernas',
    'Tesoura: pé da frente inteiro no chão com o joelho dobrado, pé de trás na ponta; braços travados',
    'Recupera primeiro o pé da frente, depois o de trás',
  ],
  muscles: [
    { phase: 'Dip', primary: ['quadriceps', 'gluteos'], secondary: ['abdomen', 'eretores', 'deltoide_anterior'] },
    { phase: 'Impulso', primary: ['quadriceps', 'gluteos', 'panturrilhas'], secondary: ['deltoide_anterior', 'triceps', 'trapezio'] },
    { phase: 'Recepção', primary: ['deltoide_anterior', 'triceps'], secondary: ['quadriceps', 'gluteos', 'trapezio', 'abdomen'] },
    { phase: 'Recuperação', primary: ['quadriceps', 'gluteos'], secondary: ['deltoide_anterior', 'triceps', 'abdomen'] },
    { phase: 'Retorno', primary: ['deltoide_anterior', 'trapezio'], secondary: ['biceps', 'abdomen'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), push jerk e split jerk (extensores de quadril, joelho e tornozelo no impulso; deltoides e tríceps travando a barra acima da cabeça). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'barbell' }],
  stills: ['Barra nos ombros', 'Dip', 'Impulso', 'Recepção em tesoura', 'Em pé com a barra acima da cabeça'],
  // a tesoura é a pose do meio (miniatura do app)
  frames: [
    { name: 'Barra nos ombros', pose: RACK_POSE, moveMs: 700, holdMs: 600, phase: 'Retorno', ease: 'out' },
    { name: 'Dip', pose: DIP, moveMs: 450, holdMs: 0, phase: 'Dip', ease: 'inout' },
    { name: 'Impulso', pose: DRIVE, moveMs: 260, holdMs: 0, phase: 'Impulso', ease: 'linear' },
    // os braços terminam de estender enquanto o corpo cai na tesoura: barra em linha reta (arco no ombro mudava a pegada)
    { name: 'Recepção em tesoura', pose: SPLIT, moveMs: 380, holdMs: 600, phase: 'Recepção', ease: 'out' },
    { name: 'Pé da frente volta', pose: RECOVER, moveMs: 600, holdMs: 0, phase: 'Recuperação', ease: 'inout', handPath: 'shoulder' },
    { name: 'Em pé com a barra acima da cabeça', pose: STAND_OH, moveMs: 600, holdMs: 500, phase: 'Recuperação', ease: 'inout', handPath: 'shoulder' },
    { name: 'Barra descendo à frente do rosto', pose: LOWER, moveMs: 600, holdMs: 0, phase: 'Retorno', ease: 'in' },
  ],
  checks: [
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Barra apoiada nos ombros', at: { pose: 'Barra nos ombros' }, test: barOnShoulders },
    { name: 'Barra apoiada nos ombros no dip', at: { pose: 'Dip' }, test: barOnShoulders },
    { name: 'Antebraços subindo até a barra nos ombros', at: { pose: 'Barra nos ombros' }, test: forearmsUp },
    { name: 'Tronco reto no dip', at: { pose: 'Dip' }, test: lib.trunk(0, 8) },
    { name: 'Dip curto (joelhos pouco dobrados)', at: { pose: 'Dip' }, test: lib.knee(135, 170) },
    { name: 'Pés apoiados no dip', at: { pose: 'Dip' }, test: lib.feetFlat(0, 1.5) },
    { name: 'Pés fora do chão no impulso', at: { pose: 'Impulso' }, test: lib.feetOffFloor(1) },
    { name: 'Joelhos estendidos no impulso', at: { pose: 'Impulso' }, test: lib.knee(160, 180) },
    ...['Recepção em tesoura', 'Pé da frente volta', 'Em pé com a barra acima da cabeça'].flatMap((pose) => [
      { name: `Braços travados (${pose.toLowerCase()})`, at: { pose }, test: lib.elbow(165, 180) },
      {
        name: `Barra acima da cabeça (${pose.toLowerCase()})`,
        at: { pose },
        test: (s: Skeleton) => {
          const d = s.hand.L[1] - s.head[1]
          return d >= 15 || `barra ${fmt(d)} cm acima do centro da cabeça (mín. 15)`
        },
      },
    ]),
    { name: 'Barra sobre o meio da base na tesoura', at: { pose: 'Recepção em tesoura' }, test: lib.barOverMidfoot(8) },
    { name: 'Pé da frente inteiro no chão na tesoura', at: { pose: 'Recepção em tesoura' }, test: lib.feetFlat(0, 1.5, 'L') },
    {
      name: 'Pé de trás na ponta na tesoura',
      at: { pose: 'Recepção em tesoura' },
      test: (s: Skeleton) => {
        const toe = s.toe.R[1]
        const heel = s.heel.R[1]
        return (toe <= 2 && heel >= 4) || `pé de trás: ponta a ${fmt(toe)} cm e calcanhar a ${fmt(heel)} cm do chão`
      },
    },
    {
      name: 'Joelho da frente dobrado, o de trás quase estendido',
      at: { pose: 'Recepção em tesoura' },
      test: (s: Skeleton) => {
        const f = legOf(s, 'L')
        const b = legOf(s, 'R')
        return (f >= 85 && f <= 130 && b >= 120 && b <= 175) || `joelho da frente ${Math.round(f)}° (85–130), de trás ${Math.round(b)}° (120–175)`
      },
    },
    { name: 'Tronco reto na tesoura', at: { pose: 'Recepção em tesoura' }, test: lib.trunk(0, 10) },
    { name: 'Pés apoiados em pé', at: { pose: 'Em pé com a barra acima da cabeça' }, test: lib.feetFlat(0, 1.5) },
  ],
  review: { status: 'rascunho', notes: 'Referência: sequência de arremesso do Fernando Reis (Hookgrip).' },
}

export default jerk
