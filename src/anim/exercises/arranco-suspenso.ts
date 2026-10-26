import { type Skeleton } from '../body'
import { lib } from '../checks'
import type { ExerciseSpec } from '../spec'
import {
  BOTTOM,
  flat,
  FRONT,
  HIP,
  JUMP,
  MEET,
  pelvisFor,
  POLE_HANG,
  SNATCH_CHECKS,
  SNATCH_MUSCLES,
  SNATCH_SOURCE,
  STAND_OH,
  TURNOVER,
} from './arranco-chao'

/*
 * Arranco suspenso (hang snatch): entrada `lpo-snatch-suspenso` do catálogo (src/data/lpo.ts). Começa em pé com
 * a barra no quadril, desce a barra até logo acima dos joelhos (quadril para trás, costas firmes) e daí faz o
 * mesmo arranco do chão (arranco-chao.ts): saltinho, passagem por baixo, braços travados acima da cabeça,
 * descida até o fundo e recuperação.
 */

/** Posição suspensa: barra logo acima dos joelhos, quadril para trás, tronco inclinado, joelhos levemente dobrados. */
const ABOVE_KNEE = pelvisFor(-24, 40, 6, flat, POLE_HANG, 11, 60, false)

export const arrancoSuspenso: ExerciseSpec = {
  id: 'lpo-snatch-suspenso',
  datasetId: 'lpo-snatch-suspenso',
  name: 'Arranco suspenso (hang snatch)',
  camera: { yaw: 35, pitch: 8 },
  phases: [
    { name: 'Preparação', description: 'Em pé com a barra no quadril, leva o quadril para trás até a barra ficar logo acima dos joelhos, costas firmes.' },
    { name: 'Segunda puxada', description: 'Explode o quadril para a frente, sobe na ponta dos pés e dá um saltinho; os braços continuam quase estendidos.' },
    { name: 'Encaixe', description: 'Com a barra subindo pela inércia, entra por baixo dela com os cotovelos altos e por fora, trava os braços acima da cabeça e desce com a barra até o fundo do agachamento.' },
    { name: 'Recuperação', description: 'Sobe do agachamento com a barra travada acima da cabeça, sobre o meio do pé.' },
    { name: 'Retorno', description: 'Desce a barra à frente do peito até o quadril.' },
  ],
  keyPoints: [
    'Pegada larga de arranco, braços estendidos na posição suspensa',
    'Barra logo acima dos joelhos: quadril para trás, costas firmes, ombros à frente da barra',
    'Saltinho na ponta dos pés com os braços quase estendidos: a barra sobe pelo empurrão das pernas',
    'Cotovelos altos e por fora ao entrar sob a barra; braços travados acima da cabeça',
    'Recepção no fundo do agachamento, barra sobre o meio do pé',
  ],
  muscles: [
    { phase: 'Preparação', primary: ['posteriores', 'gluteos'], secondary: ['eretores', 'trapezio', 'antebraco'] },
    { ...SNATCH_MUSCLES.pull2, primary: [...SNATCH_MUSCLES.pull2.primary], secondary: [...SNATCH_MUSCLES.pull2.secondary] },
    { ...SNATCH_MUSCLES.catch, primary: [...SNATCH_MUSCLES.catch.primary], secondary: [...SNATCH_MUSCLES.catch.secondary] },
    { ...SNATCH_MUSCLES.rec, primary: [...SNATCH_MUSCLES.rec.primary], secondary: [...SNATCH_MUSCLES.rec.secondary] },
    { phase: 'Retorno', primary: ['deltoide_anterior', 'trapezio'], secondary: ['biceps', 'antebraco', 'abdomen'] },
  ],
  muscleSource: SNATCH_SOURCE,
  props: [{ kind: 'barbell' }],
  stills: ['Em pé, barra no quadril', 'Barra acima do joelho', 'Saltinho', 'Fundo do agachamento', 'Em pé com a barra acima da cabeça'],
  // o fundo do agachamento é a pose do meio (miniatura do app)
  frames: [
    { name: 'Barra acima do joelho', pose: ABOVE_KNEE, moveMs: 900, holdMs: 400, phase: 'Preparação', ease: 'inout', handPath: 'shoulder' },
    { name: 'Saltinho', pose: JUMP, moveMs: 560, holdMs: 0, phase: 'Segunda puxada', ease: 'in', handPath: 'shoulder' },
    { name: 'Passagem por baixo da barra', pose: TURNOVER, moveMs: 380, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Encontro com a barra', pose: MEET, moveMs: 420, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Fundo do agachamento', pose: BOTTOM, moveMs: 600, holdMs: 500, phase: 'Encaixe', ease: 'out', handPath: 'shoulder' },
    { name: 'Em pé com a barra acima da cabeça', pose: STAND_OH, moveMs: 1300, holdMs: 500, phase: 'Recuperação', ease: 'inout', handPath: 'shoulder' },
    { name: 'Barra à frente do peito', pose: FRONT, moveMs: 700, holdMs: 0, phase: 'Retorno', ease: 'in' },
    { name: 'Em pé, barra no quadril', pose: HIP, moveMs: 600, holdMs: 400, phase: 'Retorno', ease: 'out' },
  ],
  checks: [
    ...SNATCH_CHECKS,
    ...['Barra acima do joelho', 'Em pé, barra no quadril'].map((pose) => ({ name: `Braços estendidos (${pose.toLowerCase()})`, at: { pose }, test: lib.elbow(160, 180) })),
    ...['Barra acima do joelho', 'Em pé, barra no quadril'].map((pose) => ({ name: `Pés apoiados (${pose.toLowerCase()})`, at: { pose }, test: lib.feetFlat(0, 1.5) })),
    { name: 'Barra sobre o meio do pé na posição suspensa', at: { pose: 'Barra acima do joelho' }, test: lib.barOverMidfoot(6) },
    { name: 'Tronco inclinado na posição suspensa', at: { pose: 'Barra acima do joelho' }, test: lib.trunkLean(25, 55) },
    {
      name: 'Barra acima dos joelhos na posição suspensa',
      at: { pose: 'Barra acima do joelho' },
      test: (s: Skeleton) => {
        const d = (s.hand.L[1] + s.hand.R[1]) / 2 - s.knee.L[1]
        return (d >= 2 && d <= 20) || `barra ${d.toFixed(1).replace('.', ',')} cm acima do joelho (esperado 2–20)`
      },
    },
  ],
  review: { status: 'rascunho', notes: 'Mesmas poses do arranco do chão a partir da posição suspensa.' },
}

export default arrancoSuspenso
