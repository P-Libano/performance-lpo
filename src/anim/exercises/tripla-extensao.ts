import { STAND_Y, type Skeleton } from '../body'
import { lib } from '../checks'
import { both, footFlat, footOnToes, hang, mirrorFoot, mirrorZ, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { v } from '../vec'

/*
 * Tripla extensão (puxada de arranco a partir da posição de potência): entrada `lpo-tripla-extensao` do
 * catálogo (src/data/lpo.ts). Começa com a barra no meio da coxa (posição de potência), estende quadril, joelhos
 * e tornozelos de uma vez até a ponta dos pés com os braços estendidos e volta a barra à coxa com controle.
 *
 * Mesmas medidas da puxada dos cleans (power-clean.ts): tornozelo em x = 0, meio do pé em x ≈ 7. Pegada de
 * arranco, larga (mãos em z = ±45): com os braços abertos a barra fica mais baixa, perto da dobra do quadril.
 * Simplificação: o encolhimento dos ombros do fim da puxada não existe no esqueleto.
 */

const GRIP_Z = 45
const BAR_X = 7
const flat = both(footFlat(0, 11, -6), mirrorFoot)
const toes = both(footOnToes(0, 11, 9, -6), mirrorFoot)
// braços estendidos e abertos (pegada larga): cotovelos para fora e um pouco para trás
const elbowPole = both(v(-0.6, 0, 1), mirrorZ)

const pose = (pelvis: readonly [number, number, number], pitch: number, head: number, feet: typeof flat, x = BAR_X): PoseSpec => {
  const b = { pelvis, pitch, head, feet, elbowPole }
  return { ...b, hands: hang(b, x, GRIP_Z) }
}

/** Posição de potência: barra no meio da coxa, joelhos dobrados por baixo dela, ombros um pouco à frente. */
const POWER = pose(v(-11, STAND_Y - 7, 0), 20, 4, flat)
/** Extensão: quadril e joelhos estendidos na ponta dos pés, tronco levemente para trás, braços estendidos. */
const EXTENSION = pose(v(-1, STAND_Y + 5, 0), -6, -2, toes, BAR_X + 4)

const fmt = (n: number) => n.toFixed(1).replace('.', ',')

export const triplaExtensao: ExerciseSpec = {
  id: 'lpo-tripla-extensao',
  datasetId: 'lpo-tripla-extensao',
  name: 'Tripla extensão (puxada de arranco)',
  camera: { yaw: 35, pitch: 8 },
  phases: [
    { name: 'Extensão', description: 'Estende quadril, joelhos e tornozelos de uma vez, subindo na ponta dos pés, com os braços estendidos.' },
    { name: 'Retorno', description: 'Volta a barra ao meio da coxa com controle: quadril para trás, joelhos dobrando por baixo da barra.' },
  ],
  keyPoints: [
    'Começa na posição de potência: barra no meio da coxa, ombros um pouco à frente da barra',
    'Pegada larga (arranco), braços estendidos o tempo todo',
    'Extensão completa: quadril e joelhos estendidos, na ponta dos pés',
    'Barra rente ao corpo, sobre o meio do pé',
  ],
  muscles: [
    { phase: 'Extensão', primary: ['gluteos', 'posteriores', 'quadriceps'], secondary: ['panturrilhas', 'trapezio', 'eretores'] },
    { phase: 'Retorno', primary: ['posteriores', 'gluteos'], secondary: ['eretores', 'quadriceps', 'antebraco'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, segunda puxada dos levantamentos olímpicos (extensores de quadril, joelho e tornozelo; trapézio no encolhimento). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'barbell' }],
  stills: ['Posição de potência', 'Extensão'],
  frames: [
    { name: 'Posição de potência', pose: POWER, moveMs: 800, holdMs: 600, phase: 'Retorno', ease: 'inout', handPath: 'shoulder' },
    { name: 'Extensão', pose: EXTENSION, moveMs: 420, holdMs: 400, phase: 'Extensão', ease: 'out', handPath: 'shoulder' },
  ],
  checks: [
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Braços estendidos', at: 'all', test: lib.elbow(160, 180) },
    {
      name: 'Pegada larga de arranco',
      at: 'keyframes',
      test: (s: Skeleton) => {
        const w = s.hand.L[2] - s.hand.R[2]
        return w >= 80 || `mãos a ${fmt(w)} cm uma da outra (pegada de arranco: ≥ 80)`
      },
    },
    { name: 'Barra sobre o meio do pé na posição de potência', at: { pose: 'Posição de potência' }, test: lib.barOverMidfoot(5) },
    { name: 'Pés apoiados na posição de potência', at: { pose: 'Posição de potência' }, test: lib.feetFlat(0, 1.5) },
    { name: 'Joelhos dobrados por baixo da barra na posição de potência', at: { pose: 'Posição de potência' }, test: lib.knee(135, 170) },
    { name: 'Tronco levemente inclinado na posição de potência', at: { pose: 'Posição de potência' }, test: lib.trunkLean(10, 30) },
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
  ],
  review: { status: 'rascunho', notes: 'Mesma puxada dos cleans, com pegada de arranco. Sem GIF do dataset para comparar (o 0776 é a puxada do chão).' },
}

export default triplaExtensao
