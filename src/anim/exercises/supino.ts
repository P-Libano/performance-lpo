import { lib } from '../checks'
import { both, footFlat, mirrorFoot, mirrorZ, pressUp, type PoseSpec } from '../pose'
import { DIM, midHands } from '../props'
import type { ExerciseSpec } from '../spec'
import { v } from '../vec'

/*
 * Supino reto com barra. Deitado de costas (pitch −90): cabeça para −x, rosto para cima.
 * Banco de x = −62 a 58, tampo a 43 cm; pelve e peito apoiados (centro 11 cm acima do tampo).
 * Pegada ≈ 1,5× a largura dos ombros (z = ±40). Pés no chão, joelhos dobrados para cima e para fora.
 */

const BENCH_TOP = DIM.bench.height
const BODY_Y = BENCH_TOP + 11
const GRIP_Z = 40
const body = {
  pelvis: v(10, BODY_Y, 0),
  pitch: -90,
  head: 0,
  // joelhos: padrão do motor (dobram na direção das pontas dos pés, que estão viradas para fora)
  feet: both(footFlat(50, 30, -20), mirrorFoot),
}
// cotovelos para baixo (em direção ao chão), um pouco para os pés e para fora: ~45–75° do tronco
const elbowPole = both(v(0.7, -1, 0.6), mirrorZ)

/** Topo: braços estendidos, barra na vertical dos ombros. */
const TOP: PoseSpec = { ...body, elbowPole, hands: pressUp(body, -36, GRIP_Z) }
/** Embaixo: barra toca a parte baixa do peito; antebraços na vertical. */
const BOTTOM: PoseSpec = { ...body, elbowPole, hands: both(v(-29, BODY_Y + 14, GRIP_Z), mirrorZ) }

export const supino: ExerciseSpec = {
  id: '0025',
  datasetId: '0025',
  name: 'Supino reto com barra',
  // do lado dos pés e de cima (como o GIF do dataset): mostra a barra tocando o peito sem a anilha tapar o tronco
  camera: { yaw: 35, pitch: 38 },
  phases: [
    { name: 'Descida', description: 'Desce a barra com controle até tocar a parte baixa do peito.' },
    { name: 'Subida', description: 'Empurra a barra de volta até os braços estenderem, sobre os ombros.' },
  ],
  keyPoints: [
    'Costas e glúteos apoiados no banco, pés no chão',
    'Barra toca a parte baixa do peito',
    'Cotovelos entre 45° e 75° do tronco (sem abrir a 90°)',
    'Antebraços na vertical embaixo',
    'Topo com braços estendidos e barra sobre os ombros',
  ],
  muscles: [
    { phase: 'Descida', primary: ['peitoral'], secondary: ['deltoide_anterior', 'triceps'] },
    { phase: 'Subida', primary: ['peitoral', 'triceps'], secondary: ['deltoide_anterior'] },
  ],
  muscleSource: 'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), técnica do supino reto; distribuição por fase a validar na revisão.',
  props: [{ kind: 'bench', x0: -62, x1: 58 }, { kind: 'barbell' }],
  frames: [
    { name: 'Braços estendidos', pose: TOP, moveMs: 900, holdMs: 500, phase: 'Subida', ease: 'inout' },
    { name: 'Barra no peito', pose: BOTTOM, moveMs: 1400, holdMs: 200, phase: 'Descida', ease: 'inout' },
  ],
  checks: [
    { name: 'Costas apoiadas no banco', at: 'all', test: lib.backOn(BENCH_TOP) },
    { name: 'Pés no chão', at: 'all', test: lib.feetFlat(0, 1.5) },
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Cotovelos a 45–75° do tronco', at: { pose: 'Barra no peito' }, test: lib.elbowFlare(45, 75) },
    { name: 'Antebraços na vertical embaixo', at: { pose: 'Barra no peito' }, test: lib.forearmVertical(15) },
    { name: 'Braços estendidos no topo', at: { pose: 'Braços estendidos' }, test: lib.elbow(165, 180) },
    {
      name: 'Barra sobre os ombros no topo',
      at: { pose: 'Braços estendidos' },
      test: (s) => {
        const dx = midHands(s)[0] - s.shoulder.L[0]
        return Math.abs(dx) <= 6 || `barra a ${dx.toFixed(1)} cm dos ombros`
      },
    },
    {
      name: 'Barra toca a parte baixa do peito',
      at: { pose: 'Barra no peito' },
      test: (s) => {
        const b = midHands(s)
        const h = b[1] - s.chest[1]
        const between = b[0] > s.chest[0] && b[0] < s.pelvis[0]
        return (between && h >= 10 && h <= 18) || `barra a ${h.toFixed(1)} cm acima do peito, x = ${b[0].toFixed(1)}`
      },
    },
  ],
  review: { status: 'verificado', notes: 'Folha de contato conferida; aguarda revisão técnica humana.' },
}

export default supino
