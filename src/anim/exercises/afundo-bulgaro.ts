import { SEG, SIDES, type Side, type Skeleton } from '../body'
import { lib } from '../checks'
import { footFlat, hang, jointAngle, type Foot, type PoseSpec } from '../pose'
import { DIM, type PropSpec } from '../props'
import type { ExerciseSpec } from '../spec'
import { v, type V3 } from '../vec'

/*
 * Agachamento afundo com halteres — variante do GIF do dataset 0410 ("dumbbell single leg split squat"):
 * pé de trás apoiado no banco (agachamento búlgaro), pés fixos, sobe e desce no lugar.
 *
 * Medidas (cm, atleta de 175 cm): perna da FRENTE = esquerda (L), tornozelo em x = 0, z = +10, pé inteiro no
 * chão. Perna de TRÁS = direita (R), peito do pé sobre a ponta do banco (tampo a 43 cm, banco de x = −160 a
 * −72): tornozelo em (−70, 48, −10), dedos para trás. Halteres pendurados ao lado do corpo, pegada neutra.
 * No fundo: coxa da frente ~horizontal, joelho da frente ~90°, joelho de trás perto do chão.
 *
 * Atenção na revisão: (1) a ficha do catálogo diz "afundo"/split squat, mas o GIF 0410 é o búlgaro (pé de trás
 * no banco) e é o que está desenhado; (2) o pé de trás usa `sole` para cima: o peito do pé e os dedos apoiam
 * no tampo e o calcanhar fica no ar, acima do tornozelo, como no GIF.
 */

const BENCH = { x0: -160, x1: -72 }
const BENCH_TOP = DIM.bench.height
const FRONT: Side = 'L'
const REAR: Side = 'R'
const frontFoot = footFlat(0, 10, 0)
/** peito do pé no banco: tornozelo ~5 cm acima do tampo, dedos para trás encostados no tampo */
const rearFoot: Foot = { ankle: v(-70, BENCH_TOP + 5, -10), toe: v(-90, BENCH_TOP + 0.5, -10), sole: v(0, 1, 0) }
const HAND_Z = 24

const pose = (pelvis: V3, pitch: number): PoseSpec => {
  const base = {
    pelvis,
    pitch,
    head: 0,
    feet: { L: frontFoot, R: rearFoot },
    // joelho da frente para a frente (na linha do pé); joelho de trás para baixo
    kneePole: { L: v(1, 0, 0.1), R: v(0.3, -1, 0) },
    // braços pendurados, cotovelos estendidos apontando para trás
    elbowPole: { L: v(-1, 0, 0.3), R: v(-1, 0, -0.3) },
  }
  const shoulderX = pelvis[0] + SEG.trunk * Math.sin((pitch * Math.PI) / 180)
  return { ...base, hands: hang(base, shoulderX, HAND_Z) }
}

/** Em cima: perna da frente quase estendida, tronco quase vertical. */
const TOP = pose(v(-18, 90, 0), 5)
/** Embaixo: coxa da frente perto da horizontal, joelho de trás perto do chão, tronco levemente à frente. */
const BOTTOM = pose(v(-30, 54, 0), 12)

const props: PropSpec[] = [{ kind: 'bench', x0: BENCH.x0, x1: BENCH.x1 }, { kind: 'dumbbells', axis: 'x' }]

const fmt = (n: number) => n.toFixed(1).replace('.', ',')
const kneeAngle = (s: Skeleton, k: Side) => jointAngle(s.hip[k], s.knee[k], s.ankle[k])

export const afundoBulgaro: ExerciseSpec = {
  id: '0410',
  datasetId: '0410',
  name: 'Agachamento afundo com halteres',
  phases: [
    { name: 'Descida', description: 'Dobra os dois joelhos e desce o quadril na vertical, até a coxa da frente ficar quase horizontal.' },
    { name: 'Subida', description: 'Empurra o chão com o pé da frente inteiro até quase estender a perna; o pé de trás só apoia.' },
  ],
  keyPoints: [
    'Pé da frente inteiro no chão (calcanhar não sai)',
    'Pé de trás apoiado no banco, sem sair do lugar',
    'Joelho da frente na direção do pé (não cai para dentro)',
    'Desce até a coxa da frente quase horizontal (joelho da frente ~90°) e o joelho de trás perto do chão',
    'Tronco quase vertical, braços estendidos segurando os halteres',
  ],
  muscles: [
    { phase: 'Descida', primary: ['quadriceps', 'gluteos'], secondary: ['adutores', 'posteriores', 'antebraco'] },
    { phase: 'Subida', primary: ['quadriceps', 'gluteos'], secondary: ['adutores', 'posteriores', 'panturrilhas', 'antebraco'] },
  ],
  muscleSource:
    'Delavier — Guia dos Movimentos de Musculação (Strength Training Anatomy), 3ª ed., afundo com halteres (quadríceps, glúteos; adutores e posteriores como auxiliares); dataset 0410 (alvo quadríceps; glúteos, posteriores, panturrilhas). Distribuição por fase a validar na revisão.',
  props,
  frames: [
    { name: 'Em cima', pose: TOP, moveMs: 1100, holdMs: 400, phase: 'Subida', ease: 'inout' },
    { name: 'Embaixo', pose: BOTTOM, moveMs: 1500, holdMs: 200, phase: 'Descida', ease: 'inout' },
  ],
  checks: [
    {
      name: 'Pé da frente inteiro no chão',
      at: 'all',
      test: (s) => {
        for (const [n, p] of [
          ['calcanhar', s.heel[FRONT]],
          ['ponta do pé', s.toe[FRONT]],
        ] as const)
          if (Math.abs(p[1]) > 1.5) return `${n} da frente a ${fmt(p[1])} cm do chão`
        return true
      },
    },
    {
      name: 'Pé de trás apoiado na ponta do banco',
      at: 'all',
      test: (s) => {
        const a = s.ankle[REAR]
        const h = a[1] - BENCH_TOP
        if (h < 2 || h > 9) return `tornozelo de trás a ${fmt(h)} cm do tampo (esperado 2–9)`
        if (s.toe[REAR][0] > BENCH.x1 || s.toe[REAR][0] < BENCH.x0) return 'dedos de trás fora do banco'
        return true
      },
    },
    {
      name: 'Pé de trás com o peito do pé no banco (sola para cima, calcanhar não encosta)',
      at: 'all',
      test: (s) => {
        const up = s.heel[REAR][1] - s.ankle[REAR][1]
        if (up < 4) return `calcanhar de trás ${fmt(up)} cm acima do tornozelo (esperado ≥ 4: sola para cima)`
        const t = s.toe[REAR][1] - BENCH_TOP
        return (t >= 0 && t <= 2) || `ponta do pé de trás a ${fmt(t)} cm do tampo (esperado 0–2)`
      },
    },
    { name: 'Halteres no mesmo nível', at: 'all', test: lib.handsLevel(1) },
    { name: 'Braços estendidos', at: 'all', test: lib.elbow(165, 180) },
    { name: 'Tronco quase vertical', at: 'all', test: lib.trunk(0, 20) },
    {
      name: 'Joelho da frente na direção do pé (não cai para dentro)',
      at: 'all',
      test: (s) => {
        const dz = s.knee[FRONT][2] - s.ankle[FRONT][2]
        return (dz >= -2 && dz <= 6) || `joelho da frente ${fmt(dz)} cm de lado em relação ao pé`
      },
    },
    {
      name: 'Joelho da frente ~90° embaixo',
      at: { pose: 'Embaixo' },
      test: (s) => {
        const a = kneeAngle(s, FRONT)
        return (a >= 80 && a <= 105) || `joelho da frente a ${Math.round(a)}° (esperado 80–105)`
      },
    },
    {
      name: 'Joelho de trás perto do chão embaixo',
      at: { pose: 'Embaixo' },
      test: (s) => {
        const y = s.knee[REAR][1]
        return (y >= 6 && y <= 20) || `joelho de trás a ${fmt(y)} cm do chão (esperado 6–20)`
      },
    },
    {
      name: 'Perna da frente quase estendida em cima (sem travar)',
      at: { pose: 'Em cima' },
      test: (s) => {
        const a = kneeAngle(s, FRONT)
        return (a >= 155 && a <= 175) || `joelho da frente a ${Math.round(a)}° (esperado 155–175)`
      },
    },
    {
      name: 'Joelhos dentro dos limites (os dois lados)',
      at: 'all',
      test: (s) => {
        for (const k of SIDES) if (kneeAngle(s, k) < 45) return `joelho (${k}) a ${Math.round(kneeAngle(s, k))}°`
        return true
      },
    },
  ],
  review: { status: 'verificado' },
}

export default afundoBulgaro
