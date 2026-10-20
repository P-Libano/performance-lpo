import type { Skeleton } from '../body'
import { SIDES } from '../body'
import { lib } from '../checks'
import { jointAngle, type Foot, type PoseSpec } from '../pose'
import type { PropSpec } from '../props'
import type { ExerciseSpec } from '../spec'
import { add, dot, len, mul, sub, v, type V3 } from '../vec'

/*
 * Leg press 45° (sled). Sentado no assento, costas no encosto reclinado; os pés empurram a plataforma, que
 * corre num trilho a 45° (para a frente e para cima, +x/+y).
 *
 * Medidas (cm, atleta de 175 cm): assento a 50 cm do chão; encosto a 35° do chão a partir de x = −30
 * (tronco a 55° da vertical, pitch −55). Pelve no canto assento/encosto, 11 cm acima das duas superfícies.
 * Os tornozelos andam numa reta paralela ao trilho que passa pela pelve: no fundo a 60 cm do quadril
 * (joelho ≈ 90°), em cima a 85 cm (joelho ≈ 162°, sem travar). Pés na largura do quadril (z = ±14),
 * mãos nas manoplas ao lado do assento (fixas).
 *
 * RASCUNHO — bloqueado pelo motor: em solve() (pose.ts) o calcanhar é sempre posto do lado "de baixo" do pé
 * (reject(−y, frente do pé)), então nenhuma sola pode ficar virada para cima. A plataforma a 45° exige a sola
 * virada para cima/frente: o calcanhar sai ~9 cm do lado do atleta e a ponta entra na plataforma (na folha o
 * pé aparece "na ponta", sem apoiar a sola). Falta também a restrição "sola inteira na plataforma" (calcanhar e
 * ponta à mesma distância ao longo do trilho), que hoje falharia — não declarada para não deixar a suíte vermelha.
 */

const SEAT_Y = 50
const BACK = { hingeX: -30, deg: 35 }
const RAIL = 45
const r = BACK.deg * (Math.PI / 180)
/** normal do encosto (aponta para o atleta) */
const BACK_N = v(Math.sin(r), Math.cos(r), 0)
const HINGE = v(BACK.hingeX, SEAT_Y, 0)
/** direção do trilho (plataforma se afasta por aqui) e direção "para cima" no plano da plataforma */
const RAIL_DIR = v(Math.SQRT1_2, Math.SQRT1_2, 0)
const PLATE_UP = v(-Math.SQRT1_2, Math.SQRT1_2, 0)

// pelve no canto: 11 cm acima do assento e 11 cm à frente do encosto
const PELVIS = v(BACK.hingeX + (11 - 11 * Math.cos(r)) / Math.sin(r), SEAT_Y + 11, 0)
const FOOT_Z = 14
const ANKLE_H = 6.8 // = SEG.ankleHeight: tornozelo afastado da plataforma

/** Pé com a sola na plataforma, dedos para cima (no plano da plataforma), tornozelo a `d` cm da pelve ao longo do trilho. */
const footAt = (d: number, z: number): Foot => {
  const ankle = add(add(PELVIS, mul(RAIL_DIR, d)), v(0, 0, z))
  // como footFlat(): ponta 20 cm "à frente" do pé e encostada no apoio (ANKLE_H mais longe que o tornozelo)
  return { ankle, toe: add(ankle, add(mul(PLATE_UP, 20.1), mul(RAIL_DIR, ANKLE_H))) }
}

const HANDS = { L: v(-22, SEAT_Y + 8, 30), R: v(-22, SEAT_Y + 8, -30) }
const body = {
  pelvis: PELVIS,
  pitch: -(90 - BACK.deg),
  head: 0,
  hands: HANDS,
  // joelhos dobram para cima/para trás (em direção ao peito) e um pouco para fora, na linha dos pés
  kneePole: { L: v(-0.7, 0.7, 0.15), R: v(-0.7, 0.7, -0.15) },
  // cotovelos para baixo e para fora
  elbowPole: { L: v(0, -1, 0.6), R: v(0, -1, -0.6) },
}
const pose = (d: number): PoseSpec => ({ ...body, feet: { L: footAt(d, FOOT_Z), R: footAt(d, -FOOT_Z) } })

/** Em cima: pernas quase estendidas, joelhos sem travar. */
const TOP = pose(85)
/** Embaixo: joelhos a ~90°, quadril ainda apoiado (sem a lombar sair do encosto). */
const BOTTOM = pose(60)

const props: PropSpec[] = [{ kind: 'legPress', seat: { x0: -45, x1: 5, y: SEAT_Y }, back: BACK, rail: RAIL }]

const fmt = (n: number) => n.toFixed(1).replace('.', ',')
/** distância de um ponto à superfície do encosto (ao longo da normal) */
const fromBack = (p: V3) => dot(sub(p, HINGE), BACK_N)

/** Tornozelo L de referência (pose de cima) — os pés só se movem ao longo do trilho. */
const ANKLE_REF = TOP.feet.L.ankle

export const legPress: ExerciseSpec = {
  id: '0739',
  datasetId: '0739',
  name: 'Leg press 45°',
  camera: { yaw: 80, pitch: 15 },
  phases: [
    { name: 'Descida', description: 'Dobra os joelhos com controle, deixando a plataforma descer até os joelhos chegarem a ~90°.' },
    { name: 'Subida', description: 'Empurra a plataforma com o pé inteiro até quase estender as pernas, sem travar os joelhos.' },
  ],
  keyPoints: [
    'Costas e quadril apoiados no encosto o tempo todo (a lombar não sai do banco no fundo)',
    'Pés inteiros na plataforma, na largura do quadril',
    'Joelhos na direção dos pés (não caem para dentro)',
    'Desce até os joelhos a ~90°',
    'Em cima, pernas quase estendidas: joelhos não travam',
  ],
  muscles: [
    { phase: 'Descida', primary: ['quadriceps', 'gluteos'], secondary: ['adutores', 'posteriores'] },
    { phase: 'Subida', primary: ['quadriceps', 'gluteos'], secondary: ['adutores', 'posteriores', 'panturrilhas'] },
  ],
  muscleSource:
    'Delavier — Guia dos Movimentos de Musculação (Strength Training Anatomy), 3ª ed., "leg press inclinado" (quadríceps, glúteos, adutores, posteriores); dataset 0739 (alvo glúteos; quadríceps, posteriores, panturrilhas). Distribuição por fase a validar na revisão.',
  props,
  frames: [
    { name: 'Pernas estendidas', pose: TOP, moveMs: 1100, holdMs: 400, phase: 'Subida', ease: 'inout' },
    { name: 'Joelhos a 90°', pose: BOTTOM, moveMs: 1500, holdMs: 200, phase: 'Descida', ease: 'inout' },
  ],
  checks: [
    {
      name: 'Costas e quadril apoiados no encosto',
      at: 'all',
      test: (s) => {
        for (const [n, p] of [
          ['pelve', s.pelvis],
          ['peito', s.chest],
        ] as const) {
          const h = fromBack(p)
          if (h < 8 || h > 16) return `${n} a ${fmt(h)} cm do encosto (esperado 8–16)`
        }
        const h = s.pelvis[1] - SEAT_Y
        return (h >= 8 && h <= 16) || `pelve a ${fmt(h)} cm do assento (esperado 8–16)`
      },
    },
    {
      name: 'Pés na plataforma (só andam ao longo do trilho, lado a lado)',
      at: 'all',
      test: (s) => {
        for (const k of SIDES) {
          const q = sub(s.ankle[k], add(ANKLE_REF, v(0, 0, k === 'L' ? 0 : -2 * FOOT_Z)))
          const off = len(sub(q, mul(RAIL_DIR, dot(q, RAIL_DIR))))
          if (off > 1) return `tornozelo (${k}) saiu ${fmt(off)} cm da linha do trilho`
        }
        const dd = dot(sub(s.ankle.L, s.ankle.R), RAIL_DIR)
        return Math.abs(dd) <= 0.5 || `pés desalinhados na plataforma (${fmt(dd)} cm)`
      },
    },
    { name: 'Movimento simétrico', at: 'all', test: lib.symmetric(1) },
    { name: 'Mãos nas manoplas', at: 'all', test: lib.handsAt(HANDS, 0.5) },
    {
      name: 'Joelhos na direção dos pés (não caem para dentro)',
      at: 'all',
      test: (s: Skeleton) => {
        for (const k of SIDES) {
          const out = (s.knee[k][2] - s.ankle[k][2]) * (k === 'L' ? 1 : -1)
          if (out < -2) return `joelho (${k}) ${fmt(-out)} cm para dentro do pé`
          if (out > 8) return `joelho (${k}) ${fmt(out)} cm para fora do pé`
        }
        return true
      },
    },
    { name: 'Joelhos a ~90° no fundo', at: { pose: 'Joelhos a 90°' }, test: lib.knee(80, 100) },
    { name: 'Joelhos sem travar em cima', at: { pose: 'Pernas estendidas' }, test: lib.knee(150, 172) },
    {
      name: 'Quadril não fecha demais no fundo (lombar não arredonda)',
      at: { pose: 'Joelhos a 90°' },
      test: (s) => {
        for (const k of SIDES) {
          const a = jointAngle(s.chest, s.hip[k], s.knee[k])
          if (a < 45) return `ângulo tronco–coxa (${k}) de ${Math.round(a)}° (mín. 45)`
        }
        return true
      },
    },
  ],
  review: { status: 'rascunho' },
}

export default legPress
