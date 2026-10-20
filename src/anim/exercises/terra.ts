import { lib } from '../checks'
import { both, footFlat, hang, mirrorFoot, mirrorZ, type PoseSpec } from '../pose'
import { DIM } from '../props'
import type { ExerciseSpec } from '../spec'
import { v } from '../vec'

/*
 * EXEMPLO DE REFERÊNCIA do processo (docs/animacoes/PROCESSO.md). Ao criar outro exercício, copie a estrutura:
 * 1) ficha técnica (fases, pontos-chave, músculos com fonte); 2) poses-chave com contatos; 3) restrições.
 *
 * Medidas (cm, atleta de 175 cm): meio do pé em x ≈ 6,8 (tornozelo em x = 0); barra no chão com o centro a
 * 22,5 cm (raio da anilha de 45 cm); pegada logo por fora das pernas (z = ±25).
 * As mãos vêm de `hang()`: braços estendidos, barra sobre o meio do pé; a altura da barra é consequência do
 * quadril e do tronco (como no movimento real).
 */

const GRIP_Z = 25
const BAR_X = 7 // sobre o meio do pé
const feet = both(footFlat(0, 12, -8), mirrorFoot)
// cotovelos estendidos apontando para trás (braços "travados" ao lado do tronco)
const elbowPole = both(v(-1, 0, 0.3), mirrorZ)

const pose = (pelvis: readonly [number, number, number], pitch: number, head: number): PoseSpec => {
  const base = { pelvis, pitch, head, feet, elbowPole }
  return { ...base, hands: hang(base, BAR_X, GRIP_Z) }
}

/** Posição inicial: anilhas no chão, barra sobre o meio do pé, ombros um pouco à frente da barra, costas neutras. */
const SETUP = pose(v(-28.8, 56.4, 0), 50, 10)
/** Barra passando o joelho: o quadril sobe junto com os ombros (ângulo das costas quase igual). */
const KNEE = pose(v(-25.6, 82.4, 0), 45, 8)
/** Barra no meio da coxa: o quadril vem à frente por baixo da barra, tronco mais vertical. */
const MID_THIGH = pose(v(-12.3, 86.1, 0), 25, 4)
/** Travamento: quadril e joelhos estendidos, tronco vertical, barra na coxa. */
const LOCKOUT = pose(v(-2, 92.6, 0), 0, 0)

export const terra: ExerciseSpec = {
  id: '0032',
  datasetId: '0032',
  name: 'Levantamento terra com barra',
  phases: [
    { name: 'Puxada do chão', description: 'Empurra o chão com as pernas; a barra sobe rente às canelas até passar o joelho.' },
    { name: 'Extensão do quadril', description: 'Leva o quadril à frente até ficar em pé, com a barra rente às coxas.' },
    { name: 'Descida', description: 'Quadril para trás primeiro; dobra os joelhos depois que a barra passa por eles.' },
  ],
  keyPoints: [
    'Barra sobre o meio do pé durante todo o movimento',
    'Braços estendidos (não puxa com os braços)',
    'Costas no mesmo ângulo do chão até a barra passar o joelho',
    'Termina com quadril e joelhos estendidos, tronco vertical (sem inclinar para trás)',
    'Pés apoiados por inteiro',
  ],
  muscles: [
    { phase: 'Puxada do chão', primary: ['quadriceps', 'gluteos', 'posteriores'], secondary: ['eretores', 'adutores', 'trapezio', 'antebraco'] },
    { phase: 'Extensão do quadril', primary: ['gluteos', 'posteriores'], secondary: ['eretores', 'quadriceps', 'trapezio', 'antebraco'] },
    { phase: 'Descida', primary: ['posteriores', 'gluteos'], secondary: ['eretores', 'quadriceps', 'antebraco'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), técnica do levantamento terra; distribuição por fase a validar na revisão.',
  props: [{ kind: 'barbell' }],
  frames: [
    { name: 'Posição inicial', pose: SETUP, moveMs: 650, holdMs: 500, phase: 'Descida', ease: 'out' },
    { name: 'Barra no joelho', pose: KNEE, moveMs: 750, holdMs: 0, phase: 'Puxada do chão', ease: 'in' },
    { name: 'Barra no meio da coxa', pose: MID_THIGH, moveMs: 350, holdMs: 0, phase: 'Extensão do quadril', ease: 'linear' },
    { name: 'Travamento', pose: LOCKOUT, moveMs: 400, holdMs: 600, phase: 'Extensão do quadril', ease: 'out' },
    // descida: quadril para trás até a barra passar o joelho, depois dobra os joelhos (mesmas poses da subida)
    { pose: MID_THIGH, moveMs: 450, holdMs: 0, phase: 'Descida', ease: 'in' },
    { pose: KNEE, moveMs: 450, holdMs: 0, phase: 'Descida', ease: 'linear' },
  ],
  checks: [
    { name: 'Barra sobre o meio do pé', at: 'all', test: lib.barOverMidfoot(5) },
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Pés apoiados', at: 'all', test: lib.feetFlat(0, 1.5) },
    { name: 'Braços estendidos', at: 'all', test: lib.elbow(165, 180) },
    {
      name: 'Anilhas no chão na posição inicial',
      at: { pose: 'Posição inicial' },
      test: (s) => Math.abs(s.hand.L[1] - DIM.bar.plateRadius) <= 1.5 || `barra a ${(s.hand.L[1] - DIM.bar.plateRadius).toFixed(1)} cm do chão`,
    },
    { name: 'Costas inclinadas na posição inicial', at: { pose: 'Posição inicial' }, test: lib.trunk(35, 60) },
    { name: 'Costas no mesmo ângulo até o joelho', at: { pose: 'Barra no joelho' }, test: lib.trunk(35, 60) },
    { name: 'Joelhos estendidos no travamento', at: { pose: 'Travamento' }, test: lib.knee(170, 180) },
    { name: 'Tronco vertical no travamento (sem inclinar para trás)', at: { pose: 'Travamento' }, test: lib.trunk(0, 6) },
  ],
  review: { status: 'rascunho' },
}

export default terra
