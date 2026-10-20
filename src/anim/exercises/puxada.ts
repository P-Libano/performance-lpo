import type { Skeleton } from '../body'
import { lib } from '../checks'
import { both, footFlat, mirrorFoot, mirrorZ, pressUp, solve, type PoseSpec } from '../pose'
import { DIM, midHands } from '../props'
import type { ExerciseSpec } from '../spec'
import { add, angle, mul, v } from '../vec'

/*
 * Puxada frontal na polia (pulldown sentado, pegada pronada aberta).
 * Sentado de frente para a máquina (atleta olhando para +x), num banco (assento) de 45 cm; pés no chão,
 * joelhos a ~90°. A barra desce na vertical, sob a roldana, do alto (braços estendidos) até a parte alta
 * do peito, com o tronco levemente inclinado para trás (peito "para cima").
 *
 * Aparelho: `latPulldown` (assento, rolos do apoio de coxas logo acima das coxas, perto dos joelhos, torre à
 * frente das pontas dos pés com viga até a roldana).
 */

const SEAT = 45
const PELVIS = v(0, SEAT + 10, 0)
const GRIP_Z = 38 // pegada aberta (~76 cm entre as mãos), um pouco mais larga que os ombros
const feet = both(footFlat(40, 15, -10), mirrorFoot)
// cotovelos para baixo, para fora e um pouco para trás (linha lateral do tronco)
const elbowPole = both(v(-0.25, -1, 0.9), mirrorZ)

const body = (pitch: number, head: number) => ({ pelvis: PELVIS, pitch, head, feet, elbowPole })

// Embaixo: barra na parte alta do peito (12 cm abaixo da linha dos ombros, 10 cm à frente do eixo do tronco).
const LOW = body(-18, -6)
const lowSk = solve({ ...LOW, hands: { L: PELVIS, R: PELVIS } })
const BAR_LOW = add(add(lowSk.chest, mul(lowSk.up, -12)), mul(lowSk.front, 10))
/** a barra corre numa vertical (cabo a prumo sob a roldana) */
const BAR_X = BAR_LOW[0]
const PULLEY = v(BAR_X, 232, 0)

/** Braços estendidos: barra no alto, tronco levemente inclinado para trás. */
const TOP: PoseSpec = { ...body(-10, -4), hands: pressUp(body(-10, -4), BAR_X, GRIP_Z) }
/** Barra na parte alta do peito, cotovelos para baixo e para trás, peito aberto. */
const BOTTOM: PoseSpec = { ...LOW, hands: both(v(BAR_X, BAR_LOW[1], GRIP_Z), mirrorZ) }

// Rolos do apoio de coxas: encostados em cima da coxa, a 80% do caminho do quadril ao joelho
// (raio da coxa ali ≈ 7 cm + raio do rolo 5,5 cm + 0,5 cm de folga). Pelve e pés fixos: as coxas não se mexem.
const topSk = solve(TOP)
const ON_THIGH = add(topSk.hip.L, mul(add(topSk.knee.L, mul(topSk.hip.L, -1)), 0.8))
const THIGH_PAD = { x: ON_THIGH[0], y: ON_THIGH[1] + 7 + DIM.latPulldown.rollerRadius + 0.5 }

/** Inclinação do tronco para trás (graus; negativo = inclinado à frente). */
const leanBack = (s: Skeleton) => (s.up[0] <= 0 ? 1 : -1) * angle(s.up, v(0, 1, 0))

export const puxada: ExerciseSpec = {
  id: '2330',
  datasetId: '2330',
  name: 'Puxada frontal na polia',
  camera: { yaw: 62, pitch: 14 },
  phases: [
    { name: 'Puxada', description: 'Puxa a barra na vertical até a parte alta do peito, levando os cotovelos para baixo e para trás.' },
    { name: 'Retorno', description: 'Devolve a barra com controle até os braços estenderem, sem soltar o peso.' },
  ],
  keyPoints: [
    'Sentado, pés apoiados no chão',
    'Tronco levemente inclinado para trás (≈10–20°), sem balançar para gerar impulso',
    'Barra desce na vertical, sob a roldana, até a parte alta do peito (não atrás da nuca)',
    'Cotovelos apontam para baixo e para fora, abaixo das mãos, no fim da puxada',
    'Braços estendidos no alto',
  ],
  muscles: [
    { phase: 'Puxada', primary: ['dorsal'], secondary: ['biceps', 'romboides', 'trapezio', 'deltoide_posterior', 'antebraco'] },
    { phase: 'Retorno', primary: ['dorsal'], secondary: ['biceps', 'romboides', 'antebraco'] },
  ],
  muscleSource:
    'NSCA — Essentials of Strength Training and Conditioning, 4ª ed. (Haff & Triplett, 2016), cap. 15, técnica da puxada na polia alta (lat pulldown): grande dorsal, redondo maior, trapézio médio, romboides e deltoide posterior; Delavier, Guia dos Movimentos de Musculação (bíceps e braquial como auxiliares); distribuição por fase a validar na revisão.',
  props: [
    // torre à frente das pontas dos pés (x ≈ 60), para não tapar as pernas
    { kind: 'latPulldown', seat: { x0: -30, x1: 18, y: SEAT }, thighPad: THIGH_PAD, pulley: PULLEY, towerX: 88 },
  ],
  frames: [
    { name: 'Braços estendidos', pose: TOP, moveMs: 1600, holdMs: 400, phase: 'Retorno', ease: 'inout' },
    { name: 'Barra no peito', pose: BOTTOM, moveMs: 1000, holdMs: 300, phase: 'Puxada', ease: 'inout' },
  ],
  checks: [
    {
      name: 'Sentado no assento',
      at: 'all',
      test: (s) => {
        const h = s.pelvis[1] - SEAT
        return (h >= 8 && h <= 16) || `pelve a ${h.toFixed(1)} cm do assento (esperado 8–16)`
      },
    },
    { name: 'Pés apoiados no chão', at: 'all', test: lib.feetFlat(0, 1.5) },
    { name: 'Barra nivelada', at: 'all', test: lib.handsLevel(1) },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    {
      name: 'Tronco levemente inclinado para trás, sem balanço',
      at: 'all',
      test: (s) => {
        const a = leanBack(s)
        return (a >= 5 && a <= 22) || `tronco a ${a.toFixed(0)}° para trás (esperado 5–22°)`
      },
    },
    {
      name: 'Barra na vertical da roldana (cabo a prumo)',
      at: 'all',
      test: (s) => {
        const dx = midHands(s)[0] - PULLEY[0]
        const dz = midHands(s)[2] - PULLEY[2]
        return Math.hypot(dx, dz) <= 3 || `barra a ${Math.hypot(dx, dz).toFixed(1)} cm da vertical da roldana`
      },
    },
    {
      name: 'Barra à frente do rosto (não atrás da nuca)',
      at: 'all',
      test: (s) => {
        const d = midHands(s)[0] - s.head[0]
        return d >= 8 || `barra ${d.toFixed(1)} cm à frente do centro da cabeça (mín. 8)`
      },
    },
    { name: 'Braços estendidos no alto', at: { pose: 'Braços estendidos' }, test: lib.elbow(165, 180) },
    {
      name: 'Barra na parte alta do peito',
      at: { pose: 'Barra no peito' },
      test: (s) => {
        const b = midHands(s)
        const below = s.chest[1] - b[1]
        const ahead = b[0] - s.chest[0]
        return (below >= 6 && below <= 18 && ahead >= 8 && ahead <= 22) || `barra ${below.toFixed(1)} cm abaixo e ${ahead.toFixed(1)} cm à frente dos ombros`
      },
    },
    {
      name: 'Cotovelos para baixo e para fora no fim da puxada',
      at: { pose: 'Barra no peito' },
      test: (s) => {
        for (const k of ['L', 'R'] as const) {
          const below = s.hand[k][1] - s.elbow[k][1]
          const out = Math.abs(s.elbow[k][2]) - Math.abs(s.shoulder[k][2])
          // braço (25,8 cm) mais curto que antebraço + mão (35,6 cm) no atleta MakeHuman: com a barra no peito
          // o cotovelo fica ~7 cm abaixo da mão (no atleta antigo, ~12)
          if (below < 5 || out < 3) return `cotovelo (${k}) ${below.toFixed(1)} cm abaixo da mão e ${out.toFixed(1)} cm por fora do ombro`
        }
        return true
      },
    },
  ],
  review: {
    status: 'rascunho',
    notes:
      'GIF do dataset 2330 mostra outra variação (puxada de pé no crossover, duas manoplas); o texto do dataset e o nome do catálogo descrevem a puxada sentada, que é o que está desenhado. Comparação visual feita com os GIFs 0198/0150 (puxada sentada). Aparelho trocado para `latPulldown` (assento, apoio de coxas, torre com viga até a roldana).',
  },
}

export default puxada
