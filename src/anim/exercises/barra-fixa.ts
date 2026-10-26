import { ARM, SEG } from '../body'
import { lib } from '../checks'
import { both, footFree, mirrorFoot, mirrorZ, solve, type PoseSpec } from '../pose'
import type { ExerciseSpec } from '../spec'
import { add, angle, v, type V3 } from '../vec'

/*
 * Barra fixa pronada (pull-up). Barra fixa no eixo z, em x = 0, a 225 cm do chão; pegada pronada aberta
 * (mãos em z = ±40). O atleta olha para +x; joelhos dobrados a ~90° com os pés para trás (como no GIF do
 * dataset, sem cruzar os tornozelos para manter a simetria).
 *
 * As mãos ficam PRESAS na barra e o corpo é que se move. O construtor de poses não tem isso (hang/pressUp
 * calculam a mão a partir do corpo); `hangFrom` abaixo faz o inverso: acha a altura da pelve que deixa os
 * braços estendidos com as mãos na barra. Pedido registrado para a biblioteca (pose.ts).
 */

const BAR = { x: 0, y: 225 }
const GRIP_Z = 40
const HANDS = both(v(BAR.x, BAR.y, GRIP_Z), mirrorZ)
// cotovelos para fora e para baixo, um pouco à frente (pegada pronada aberta)
const elbowPole = both(v(0.35, -1, 1), mirrorZ)
const kneePole = both(v(1, 0, 0.15), mirrorZ)

/** Corpo pendurado: pés soltos atrás (joelhos ~90°), relativos à pelve. */
const body = (pelvis: V3, pitch: number, head: number): Omit<PoseSpec, 'hands'> => ({
  pelvis,
  pitch,
  head,
  feet: both(footFree(add(pelvis, v(-14, -58, 9)), v(-0.5, -1, 0)), mirrorFoot),
  elbowPole,
  kneePole,
})

/** Inverso de pressUp: altura da pelve que deixa os braços estendidos (straight × alcance) com as mãos na barra. */
function hangFrom(px: number, pitch: number, head: number, straight = 0.996): PoseSpec {
  const s = solve({ ...body(v(px, 0, 0), pitch, head), hands: HANDS })
  const sh = s.shoulder.L
  const reach = (ARM.a + ARM.b) * straight
  const dy = Math.sqrt(reach * reach - (BAR.x - sh[0]) ** 2 - (GRIP_Z - sh[2]) ** 2)
  return { ...body(v(px, BAR.y - dy - sh[1], 0), pitch, head), hands: HANDS }
}

/** Pendurado: braços estendidos, corpo quase vertical sob a barra. */
const BOTTOM = hangFrom(0, -4, 0)
/** Topo: queixo acima da barra, peito perto dela, tronco levemente inclinado para trás. */
const TOP: PoseSpec = { ...body(v(-4, BAR.y - 54.7, 0), -15, -5), hands: HANDS }

/** Queixo: abaixo e um pouco à frente do centro da cabeça. */
const chinY = (s: { head: V3 }) => s.head[1] - 0.7 * SEG.headRadius

export const barraFixa: ExerciseSpec = {
  id: '0652',
  datasetId: '0652',
  name: 'Barra fixa pronada',
  camera: { yaw: 150, pitch: 12 },
  phases: [
    { name: 'Subida', description: 'Puxa o corpo levando os cotovelos para baixo até o queixo passar a barra.' },
    { name: 'Descida', description: 'Desce com controle até os braços estenderem por completo.' },
  ],
  keyPoints: [
    'Pegada pronada, um pouco mais aberta que os ombros, mãos fixas na barra',
    'Começa e termina com os braços estendidos (amplitude completa)',
    'Queixo passa acima da barra no topo',
    'Corpo sem balanço: tronco quase vertical, pés fora do chão',
    'Cabeça passa por trás da barra (o peito vai em direção a ela)',
  ],
  muscles: [
    { phase: 'Subida', primary: ['dorsal'], secondary: ['biceps', 'romboides', 'trapezio', 'deltoide_posterior', 'antebraco', 'abdomen'] },
    { phase: 'Descida', primary: ['dorsal'], secondary: ['biceps', 'antebraco'] },
  ],
  muscleSource:
    'Delavier — Guia dos Movimentos de Musculação (Strength Training Anatomy, 3ª ed., 2010), "barra fixa pegada aberta": grande dorsal, redondo maior, romboides, trapézio, bíceps e braquial; abdômen como estabilizador e distribuição por fase são interpretação, a validar na revisão.',
  props: [{ kind: 'pullupBar', x: BAR.x, y: BAR.y, halfLength: 60 }],
  frames: [
    { name: 'Pendurado', pose: BOTTOM, moveMs: 1500, holdMs: 400, phase: 'Descida', ease: 'inout' },
    { name: 'Queixo acima da barra', pose: TOP, moveMs: 1100, holdMs: 300, phase: 'Subida', ease: 'inout' },
  ],
  checks: [
    { name: 'Mãos na barra', at: 'all', test: lib.handsAt(HANDS, 1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    {
      name: 'Pés fora do chão',
      at: 'all',
      test: (s) => {
        const y = Math.min(s.toe.L[1], s.toe.R[1], s.heel.L[1], s.heel.R[1])
        return y >= 10 || `pé a ${y.toFixed(1)} cm do chão`
      },
    },
    { name: 'Corpo sem balanço (tronco quase vertical)', at: 'all', test: lib.trunk(0, 20) },
    {
      name: 'Cabeça passa por trás da barra',
      at: 'all',
      test: (s) => {
        const d = Math.hypot(s.head[0] - BAR.x, s.head[1] - BAR.y)
        // rosto (nariz) do corpo MakeHuman chega a ~14,5 cm do centro da cabeça; + raio da barra + 0,5 de folga
        const min = SEG.headRadius + 6
        return (d >= min && (s.head[1] < BAR.y || s.head[0] < BAR.x)) || `cabeça a ${d.toFixed(1)} cm do eixo da barra (mín. ${min.toFixed(1)}, por trás)`
      },
    },
    { name: 'Braços estendidos embaixo', at: { pose: 'Pendurado' }, test: lib.elbow(165, 180) },
    {
      name: 'Queixo acima da barra no topo',
      at: { pose: 'Queixo acima da barra' },
      test: (s) => chinY(s) > BAR.y || `queixo ${(BAR.y - chinY(s)).toFixed(1)} cm abaixo da barra`,
    },
    {
      name: 'Cotovelos para baixo no topo (abaixo das mãos, por fora dos ombros)',
      at: { pose: 'Queixo acima da barra' },
      test: (s) => {
        for (const k of ['L', 'R'] as const) {
          const below = s.hand[k][1] - s.elbow[k][1]
          const out = Math.abs(s.elbow[k][2]) - Math.abs(s.shoulder[k][2])
          if (below < 15 || out < 3) return `cotovelo (${k}) ${below.toFixed(1)} cm abaixo da mão e ${out.toFixed(1)} cm por fora do ombro`
        }
        return true
      },
    },
    {
      name: 'Tronco inclinado para trás no topo (peito em direção à barra)',
      at: { pose: 'Queixo acima da barra' },
      test: (s) => (s.up[0] < 0 && angle(s.up, v(0, 1, 0)) >= 8) || 'tronco não inclina para trás no topo',
    },
  ],
  review: {
    status: 'verificado',
    notes: 'Diferenças conscientes do GIF 0652: tornozelos não cruzados (simetria) e barra sem os suportes da parede (a biblioteca só tem a barra).',
  },
}

export default barraFixa
