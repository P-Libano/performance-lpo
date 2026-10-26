import { type Skeleton } from '../body'
import { lib } from '../checks'
import type { ExerciseSpec } from '../spec'
import { both, mirrorZ, type PoseSpec } from '../pose'
import { sub, unit, v } from '../vec'
import { barOnShoulders, base, EXTENSION, flat, fmt, fromShoulder, HIGH_PULL, KNEE, MID_THIGH, POLE_RACK, RACK, racked, SETUP, STAND, STRAIGHT_ARMS, turnover } from './power-clean'

/*
 * Clean completo (arremesso do chão, LPO): mesma puxada do power clean (power-clean.ts), mas a barra é recebida
 * no FUNDO do agachamento frontal (coxa abaixo da paralela) e o atleta sobe com ela nos ombros.
 * É a animação da entrada `lpo-clean-chao` do catálogo (src/data/lpo.ts).
 *
 * Medidas e simplificações: as do power clean (sem encolhimento de ombros; os pés não saltam para a base de
 * agachamento — ficam na largura da puxada).
 */

// joelhos na linha da ponta do pé em todas as poses (no fundo do agachamento o padrão abria demais); a mesma
// guia em todas evita salto quando a interpolação passa de uma pose com guia para outra sem
const kneePole = both(unit(sub(flat.L.toe, flat.L.ankle)), mirrorZ)
const K = (p: PoseSpec): PoseSpec => ({ ...p, kneePole })

/** Encaixe no fundo: quadril abaixo dos joelhos, tronco quase vertical, cotovelos altos à frente, barra nos ombros,
 * queixo para cima (com o tronco inclinado, a barra no deltoide fica logo abaixo do queixo). */
const CATCH_DEEP = K(racked(fromShoulder(base(v(-20, 41, 0), 24, -10, flat, POLE_RACK), RACK.dx + 2, RACK.dy)))
/** Passagem por baixo da barra: como no power clean, com o corpo já mais baixo (vai ao fundo). */
const TURNOVER = K(turnover(18))

export const clean: ExerciseSpec = {
  id: 'lpo-clean-chao',
  datasetId: 'lpo-clean-chao',
  name: 'Clean (arremesso do chão)',
  camera: { yaw: 35, pitch: 8 },
  phases: [
    { name: 'Primeira puxada', description: 'Empurra o chão com as pernas; a barra sobe rente às canelas até o meio da coxa, braços estendidos.' },
    { name: 'Segunda puxada', description: 'Explode o quadril para a frente e sobe na ponta dos pés; os braços continuam soltos.' },
    { name: 'Encaixe', description: 'Puxa os cotovelos para cima e mergulha por baixo da barra, recebendo-a nos ombros no fundo do agachamento frontal.' },
    { name: 'Recuperação', description: 'Sobe do agachamento frontal com a barra nos ombros e os cotovelos altos.' },
    { name: 'Retorno', description: 'Desce a barra pela frente das pernas até o joelho e depois ao chão.' },
  ],
  keyPoints: [
    'Barra sobre o meio do pé e rente ao corpo na puxada',
    'Braços estendidos até a extensão completa (quem puxa são as pernas e o quadril)',
    'Extensão completa: quadril e joelhos estendidos, na ponta dos pés',
    'Cotovelos altos e por fora na puxada alta',
    'Recepção no fundo do agachamento frontal: quadril abaixo dos joelhos, tronco quase vertical',
    'Cotovelos à frente e barra apoiada nos ombros do encaixe até ficar em pé',
  ],
  muscles: [
    { phase: 'Primeira puxada', primary: ['quadriceps', 'gluteos'], secondary: ['posteriores', 'eretores', 'trapezio', 'antebraco'] },
    { phase: 'Segunda puxada', primary: ['gluteos', 'posteriores', 'quadriceps'], secondary: ['panturrilhas', 'trapezio', 'eretores'] },
    { phase: 'Encaixe', primary: ['trapezio', 'quadriceps'], secondary: ['deltoide_anterior', 'deltoide_lateral', 'gluteos', 'abdomen'] },
    { phase: 'Recuperação', primary: ['quadriceps', 'gluteos'], secondary: ['adutores', 'eretores', 'abdomen'] },
    { phase: 'Retorno', primary: ['posteriores', 'gluteos'], secondary: ['eretores', 'antebraco'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, power clean e agachamento frontal (extensores de quadril, joelho e tornozelo; trapézio e deltoides na puxada alta; quadríceps e glúteos na subida do agachamento). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'barbell' }],
  // mesma ordem do power clean: o encaixe é a pose do meio (miniatura do app)
  frames: [
    { name: 'Barra no meio da coxa', pose: K(MID_THIGH), moveMs: 320, holdMs: 0, phase: 'Primeira puxada', ease: 'linear' },
    { name: 'Extensão', pose: K(EXTENSION), moveMs: 260, holdMs: 0, phase: 'Segunda puxada', ease: 'linear' },
    { name: 'Puxada alta', pose: K(HIGH_PULL), moveMs: 220, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Passagem por baixo da barra', pose: TURNOVER, moveMs: 220, holdMs: 0, phase: 'Encaixe', ease: 'linear' },
    { name: 'Encaixe no fundo', pose: CATCH_DEEP, moveMs: 340, holdMs: 500, phase: 'Encaixe', ease: 'out' },
    { name: 'Em pé com a barra', pose: K(STAND), moveMs: 1300, holdMs: 500, phase: 'Recuperação', ease: 'inout' },
    { name: 'Barra descendo no joelho', pose: K(KNEE), moveMs: 900, holdMs: 0, phase: 'Retorno', ease: 'in', handPath: 'shoulder' },
    { name: 'Posição inicial', pose: K(SETUP), moveMs: 700, holdMs: 500, phase: 'Retorno', ease: 'out' },
    { name: 'Barra no joelho', pose: K(KNEE), moveMs: 700, holdMs: 0, phase: 'Primeira puxada', ease: 'in', handPath: 'shoulder' },
  ],  checks: [
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Barra sobre o meio do pé na primeira puxada', at: { phase: 'Primeira puxada' }, test: lib.barOverMidfoot(5) },
    ...STRAIGHT_ARMS.map((pose) => ({ name: `Braços estendidos (${pose.toLowerCase()})`, at: { pose }, test: lib.elbow(160, 180) })),
    ...['Posição inicial', 'Encaixe no fundo', 'Em pé com a barra'].map((pose) => ({ name: `Pés apoiados (${pose.toLowerCase()})`, at: { pose }, test: lib.feetFlat(0, 1.5) })),
    {
      name: 'Na ponta dos pés na extensão',
      at: { pose: 'Extensão' },
      test: (s: Skeleton) => {
        const lift = Math.min(s.heel.L[1], s.heel.R[1])
        return lift >= 4 || `calcanhar a ${fmt(lift)} cm do chão (mín. 4)`
      },
    },
    { name: 'Joelhos estendidos na extensão', at: { pose: 'Extensão' }, test: lib.knee(160, 180) },
    { name: 'Barra apoiada nos ombros no encaixe', at: { pose: 'Encaixe no fundo' }, test: barOnShoulders },
    { name: 'Barra apoiada nos ombros em pé', at: { pose: 'Em pé com a barra' }, test: barOnShoulders },
    {
      name: 'Quadril abaixo dos joelhos no encaixe (coxa abaixo da paralela)',
      at: { pose: 'Encaixe no fundo' },
      test: (s: Skeleton) => {
        for (const k of ['L', 'R'] as const) {
          const d = s.knee[k][1] - s.hip[k][1]
          if (d < 2) return `quadril (${k}) ${fmt(-d)} cm acima do joelho`
        }
        return true
      },
    },
    { name: 'Tronco quase vertical no encaixe (agachamento frontal)', at: { pose: 'Encaixe no fundo' }, test: lib.trunkLean(5, 35) },
    {
      name: 'Cotovelos à frente no encaixe',
      at: { pose: 'Encaixe no fundo' },
      test: (s: Skeleton) => {
        for (const k of ['L', 'R'] as const) {
          const fwd = s.elbow[k][0] - s.shoulder[k][0]
          if (fwd < 8) return `cotovelo (${k}) ${fmt(fwd)} cm à frente do ombro (mín. 8)`
        }
        return true
      },
    },
    { name: 'Barra sobre o meio do pé no encaixe', at: { pose: 'Encaixe no fundo' }, test: lib.barOverMidfoot(8) },
    { name: 'Joelhos na direção das pontas dos pés no encaixe', at: { pose: 'Encaixe no fundo' }, test: lib.kneeTracksFoot(20) },
    { name: 'Joelhos estendidos em pé', at: { pose: 'Em pé com a barra' }, test: lib.knee(165, 180) },
  ],
  review: {
    status: 'rascunho',
    notes: 'Puxada igual à do power clean (referência journalmenu.com); encaixe no fundo do agachamento frontal.',
  },
}

export default clean
