import { STAND_Y, type Side, type Skeleton } from '../body'
import { lib } from '../checks'
import { both, mirrorZ, pressUp, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { sub, unit, v } from '../vec'
import { catchFeet } from './power-clean'

/*
 * Agachamento com a barra acima da cabeça (overhead squat): animação da entrada `lpo-auxiliar-snatch` do
 * catálogo (src/data/lpo.ts; a montagem atual também usa o GIF de agachamento overhead). É a recepção do arranco:
 * barra travada acima da cabeça com a pegada larga de arranco, sobre o meio do pé, descendo ao fundo do
 * agachamento com o tronco bem vertical.
 *
 * Medidas: tornozelo em x = 0, meio do pé em x ≈ 7; base do encaixe dos cleans (pés ~ largura dos ombros,
 * pontas a 15°); pegada de arranco em z = ±45. As mãos vêm de `pressUp` (braços estendidos para cima): a barra
 * fica sobre o meio do pé e a altura sai do alcance do braço a partir do ombro.
 */

const GRIP_Z = 45
const BAR_X = 7
// braços travados acima da cabeça: cotovelos para trás e para fora (a dobra do cotovelo voltada para a frente)
const elbowPole = both(v(-0.6, 0, 1), mirrorZ)
// joelhos na linha da ponta do pé (base aberta)
const kneePole = both(unit(sub(catchFeet.L.toe, catchFeet.L.ankle)), mirrorZ)

const pose = (pelvis: readonly [number, number, number], pitch: number, head: number): PoseSpec => {
  const b = { pelvis, pitch, head, feet: catchFeet, elbowPole, kneePole }
  return { ...b, hands: pressUp(b, BAR_X, GRIP_Z) }
}

/** Em pé, barra travada acima da cabeça, sobre o meio do pé. */
const TOP = pose(v(-2, STAND_Y - 0.6, 0), 2, 0)
/** Fundo: quadril abaixo dos joelhos, tronco bem vertical, barra ainda sobre o meio do pé (braços travados). */
const BOTTOM = pose(v(-18, 41, 0), 20, -4)

const fmt = (n: number) => n.toFixed(1).replace('.', ',')
const kneeAngle = (s: Skeleton, k: Side) => {
  const a = sub(s.hip[k], s.knee[k])
  const b = sub(s.ankle[k], s.knee[k])
  return (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)) * 180) / Math.PI
}

export const agachamentoOverhead: ExerciseSpec = {
  id: 'lpo-auxiliar-snatch',
  datasetId: 'lpo-auxiliar-snatch',
  name: 'Agachamento overhead (auxiliar do arranco)',
  camera: { yaw: 35, pitch: 8 },
  phases: [
    { name: 'Descida', description: 'Com a barra travada acima da cabeça, desce até o fundo do agachamento mantendo o tronco vertical e a barra sobre o meio do pé.' },
    { name: 'Subida', description: 'Sobe empurrando o chão, braços travados, sem a barra sair da linha do meio do pé.' },
  ],
  keyPoints: [
    'Pegada larga (arranco) e braços travados o tempo todo',
    'Barra sobre o meio do pé do início ao fim',
    'Tronco bem vertical, peito aberto',
    'Fundo com o quadril abaixo dos joelhos',
    'Joelhos na direção das pontas dos pés, pés inteiros no chão',
  ],
  muscles: [
    { phase: 'Descida', primary: ['quadriceps', 'gluteos'], secondary: ['deltoide_anterior', 'trapezio', 'abdomen', 'eretores'] },
    { phase: 'Subida', primary: ['quadriceps', 'gluteos'], secondary: ['adutores', 'deltoide_anterior', 'trapezio', 'abdomen'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), agachamento e recepção do arranco (extensores de quadril e joelho; deltoides, trapézio e tronco estabilizando a barra acima da cabeça). Distribuição por fase a validar na revisão.',
  props: [{ kind: 'barbell' }],
  stills: ['Em pé, barra acima da cabeça', 'Fundo do agachamento'],
  // braços travados: a barra acompanha o ombro (em linha reta no mundo o cotovelo dobrava no meio do caminho)
  frames: [
    { name: 'Em pé, barra acima da cabeça', pose: TOP, moveMs: 1300, holdMs: 600, phase: 'Subida', ease: 'inout', handPath: 'shoulder' },
    { name: 'Fundo do agachamento', pose: BOTTOM, moveMs: 1600, holdMs: 500, phase: 'Descida', ease: 'inout', handPath: 'shoulder' },
  ],
  checks: [
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Braços travados acima da cabeça', at: 'all', test: lib.elbow(165, 180) },
    { name: 'Barra sobre o meio do pé', at: 'all', test: lib.barOverMidfoot(6) },
    { name: 'Pés apoiados', at: 'all', test: lib.feetFlat(0, 1.5) },
    {
      name: 'Barra acima da cabeça',
      at: 'all',
      test: (s: Skeleton) => {
        const d = s.hand.L[1] - s.head[1]
        return d >= 15 || `barra ${fmt(d)} cm acima do centro da cabeça (mín. 15)`
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
    { name: 'Tronco bem vertical no fundo', at: { pose: 'Fundo do agachamento' }, test: lib.trunkLean(5, 30) },
    { name: 'Joelhos na direção das pontas dos pés no fundo', at: { pose: 'Fundo do agachamento' }, test: lib.kneeTracksFoot(20) },
    {
      name: 'Joelhos estendidos em pé',
      at: { pose: 'Em pé, barra acima da cabeça' },
      test: (s: Skeleton) => {
        for (const k of ['L', 'R'] as const) if (kneeAngle(s, k) < 165) return `joelho (${k}) a ${Math.round(kneeAngle(s, k))}°`
        return true
      },
    },
  ],
  review: { status: 'rascunho', notes: 'Recepção do arranco (barra acima da cabeça), base para o arranco do chão e suspenso.' },
}

export default agachamentoOverhead
