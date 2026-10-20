import { HEIGHT, SIDES, type Skeleton } from './body'
import { MUSCLE_IDS } from './muscles'
import { jointAngle } from './pose'
import { DIM, midHands, solidsOf, type PropSpec } from './props'
import { cycleMs, sampleAt, type Check, type ExerciseSpec } from './spec'
import { angle, v, type V3 } from './vec'

/**
 * Verificações das animações (docs/animacoes/PROCESSO.md, portão 2).
 * - Gerais: valem para todo exercício e rodam em todos os quadros do ciclo.
 * - Biblioteca: restrições reutilizáveis que cada exercício declara em `checks`.
 */

const fmt = (n: number) => n.toFixed(1).replace('.', ',')

// ───────── biblioteca de restrições ─────────

/** Ponto médio do pé (entre calcanhar e ponta), média dos dois pés. */
export const midfoot = (s: Skeleton): V3 => {
  const m = (k: 'L' | 'R') => [(s.heel[k][0] + s.toe[k][0]) / 2, 0, (s.heel[k][2] + s.toe[k][2]) / 2] as const
  return v((m('L')[0] + m('R')[0]) / 2, 0, (m('L')[2] + m('R')[2]) / 2)
}

export const lib = {
  /** Barra (meio das mãos) na vertical do meio do pé, ± `tol` cm. */
  barOverMidfoot: (tol = 4): Check['test'] => (s) => {
    const dx = midHands(s)[0] - midfoot(s)[0]
    return Math.abs(dx) <= tol || `barra ${fmt(dx)} cm ${dx > 0 ? 'à frente' : 'atrás'} do meio do pé (máx. ${tol})`
  },
  /** Mãos na mesma altura (barra nivelada). */
  handsLevel: (tol = 1): Check['test'] => (s) => {
    const dy = Math.abs(s.hand.L[1] - s.hand.R[1])
    return dy <= tol || `mãos com ${fmt(dy)} cm de diferença de altura`
  },
  /** Lados esquerdo e direito espelhados (exercício bilateral). */
  symmetric: (tol = 1): Check['test'] => (s) => {
    const pairs: [string, V3, V3][] = [
      ['mão', s.hand.L, s.hand.R],
      ['cotovelo', s.elbow.L, s.elbow.R],
      ['joelho', s.knee.L, s.knee.R],
      ['tornozelo', s.ankle.L, s.ankle.R],
    ]
    for (const [n, a, b] of pairs) {
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] + b[2])
      if (d > tol) return `${n} esquerdo e direito não estão espelhados (${fmt(d)} cm)`
    }
    return true
  },
  /** Calcanhares e pontas no chão (y = floor). */
  feetFlat: (floorY = 0, tol = 1.5): Check['test'] => (s) => {
    for (const k of SIDES)
      for (const [n, p] of [
        ['calcanhar', s.heel[k]],
        ['ponta do pé', s.toe[k]],
      ] as const)
        if (Math.abs(p[1] - floorY) > tol) return `${n} (${k}) a ${fmt(p[1] - floorY)} cm do apoio`
    return true
  },
  /** Ângulo interno do joelho (180 = estendido) dentro da faixa. */
  knee: (min: number, max: number): Check['test'] => (s) => {
    for (const k of SIDES) {
      const a = jointAngle(s.hip[k], s.knee[k], s.ankle[k])
      if (a < min || a > max) return `joelho (${k}) a ${Math.round(a)}° (esperado ${min}–${max}°)`
    }
    return true
  },
  /** Ângulo interno do cotovelo dentro da faixa. */
  elbow: (min: number, max: number): Check['test'] => (s) => {
    for (const k of SIDES) {
      const a = jointAngle(s.shoulder[k], s.elbow[k], s.hand[k])
      if (a < min || a > max) return `cotovelo (${k}) a ${Math.round(a)}° (esperado ${min}–${max}°)`
    }
    return true
  },
  /** Inclinação do tronco em relação à vertical (graus) dentro da faixa. */
  trunk: (min: number, max: number): Check['test'] => (s) => {
    const a = angle(s.up, v(0, 1, 0))
    return (a >= min && a <= max) || `tronco a ${Math.round(a)}° da vertical (esperado ${min}–${max}°)`
  },
  /** Pelve e peito apoiados no tampo (centro do corpo 8–16 cm acima da superfície). */
  backOn: (surfaceY: number): Check['test'] => (s) => {
    for (const [n, p] of [
      ['pelve', s.pelvis],
      ['peito', s.chest],
    ] as const) {
      const h = p[1] - surfaceY
      if (h < 8 || h > 16) return `${n} a ${fmt(h)} cm do apoio (esperado 8–16)`
    }
    return true
  },
  /** Abertura dos cotovelos em relação ao tronco (ângulo braço–tronco visto de cima), p. ex. supino ≈ 45–75°. */
  elbowFlare: (min: number, max: number): Check['test'] => (s) => {
    for (const k of SIDES) {
      const arm = [s.elbow[k][0] - s.shoulder[k][0], s.elbow[k][1] - s.shoulder[k][1], s.elbow[k][2] - s.shoulder[k][2]] as const
      // ângulo entre o braço e o eixo do tronco (para baixo), no plano do tronco
      const a = angle(arm, [-s.up[0], -s.up[1], -s.up[2]])
      if (a < min || a > max) return `braço (${k}) a ${Math.round(a)}° do tronco (esperado ${min}–${max}°)`
    }
    return true
  },
  /** Antebraços na vertical (cotovelo embaixo da mão), ± tol graus — supino, desenvolvimento. */
  forearmVertical: (tol = 15): Check['test'] => (s) => {
    for (const k of SIDES) {
      const fore = [s.hand[k][0] - s.elbow[k][0], s.hand[k][1] - s.elbow[k][1], s.hand[k][2] - s.elbow[k][2]] as const
      const a = angle(fore, v(0, 1, 0))
      if (a > tol) return `antebraço (${k}) a ${Math.round(a)}° da vertical (máx. ${tol})`
    }
    return true
  },
  /** Mãos num ponto fixo (barra fixa, pegador) ± tol. */
  handsAt: (pts: { L: V3; R: V3 }, tol = 1): Check['test'] => (s) => {
    for (const k of SIDES) {
      const d = Math.hypot(s.hand[k][0] - pts[k][0], s.hand[k][1] - pts[k][1], s.hand[k][2] - pts[k][2])
      if (d > tol) return `mão (${k}) a ${fmt(d)} cm do apoio`
    }
    return true
  },
}

// ───────── verificações gerais ─────────

const JOINTS = (s: Skeleton): [string, V3][] => [
  ['pelve', s.pelvis],
  ['peito', s.chest],
  ['cabeça', s.head],
  ...SIDES.flatMap((k) =>
    (['knee', 'ankle', 'heel', 'toe', 'shoulder', 'elbow', 'wrist', 'hand'] as const).map((j): [string, V3] => [`${j} ${k}`, s[j][k]]),
  ),
]

/** Partes do corpo que podem tocar um sólido (mãos no banco, pés no apoio). */
const CONTACT_OK = /^(hand|wrist|heel|toe|ankle)/

export interface Failure {
  check: string
  where: string
  message: string
}

/** Erros de preenchimento da ficha (portão 1). */
export function specErrors(spec: ExerciseSpec): string[] {
  const errs: string[] = []
  const names = new Set(spec.phases.map((p) => p.name))
  if (!spec.phases.length) errs.push('sem fases')
  if (spec.keyPoints.length < 3) errs.push('menos de 3 pontos técnicos')
  if (!spec.muscleSource.trim()) errs.push('músculos sem fonte')
  if (spec.frames.length < 2 || spec.frames.length > 6) errs.push('use de 2 a 6 poses-chave')
  for (const f of spec.frames) if (!names.has(f.phase)) errs.push(`pose-chave com fase desconhecida: "${f.phase}"`)
  for (const p of spec.phases) {
    const m = spec.muscles.find((x) => x.phase === p.name)
    if (!m) errs.push(`fase "${p.name}" sem músculos`)
    else if (!m.primary.length) errs.push(`fase "${p.name}" sem músculo principal`)
  }
  for (const m of spec.muscles) for (const id of [...m.primary, ...m.secondary]) if (!MUSCLE_IDS.includes(id)) errs.push(`músculo desconhecido: ${id}`)
  if (spec.checks.length < 2) errs.push('declare pelo menos 2 restrições específicas')
  const poseNames = new Set(spec.frames.map((f) => f.name).filter(Boolean))
  for (const c of spec.checks) {
    const at = c.at
    if (typeof at === 'object' && 'pose' in at && !poseNames.has(at.pose)) errs.push(`restrição "${c.name}" aponta para pose inexistente: "${at.pose}"`)
    if (typeof at === 'object' && 'phase' in at && !names.has(at.phase)) errs.push(`restrição "${c.name}" aponta para fase inexistente: "${at.phase}"`)
  }
  for (const f of spec.frames) {
    if (f.moveMs < 150 || f.moveMs > 4000) errs.push(`transição de ${f.moveMs} ms (use 150–4000)`)
  }
  const T = cycleMs(spec)
  if (T < 1500 || T > 12000) errs.push(`ciclo de ${T} ms (use 1,5–12 s)`)
  if (spec.review.status === 'revisado' && !(spec.review.by && spec.review.date)) errs.push('revisado sem quem/quando')
  return errs
}

/** Verificações gerais de um quadro. */
function generalFailures(s: Skeleton, props: PropSpec[], keyframe: boolean): string[] {
  const out: string[] = []
  // alcance: nas poses-chave a mão/pé precisa chegar exatamente; entre elas, tolerância de 2 cm
  const tol = keyframe ? 0.3 : 2
  for (const k of SIDES) {
    if (s.reachError.hand[k] > tol) out.push(`mão (${k}) não alcança o alvo (faltam ${fmt(s.reachError.hand[k])} cm)`)
    if (s.reachError.foot[k] > tol) out.push(`pé (${k}) não alcança o alvo (faltam ${fmt(s.reachError.foot[k])} cm)`)
    // limites humanos (ângulo interno: 180 = reto)
    const kneeA = jointAngle(s.hip[k], s.knee[k], s.ankle[k])
    const elbowA = jointAngle(s.shoulder[k], s.elbow[k], s.hand[k])
    if (kneeA < 30) out.push(`joelho (${k}) fechado demais (${Math.round(kneeA)}°)`)
    if (elbowA < 25) out.push(`cotovelo (${k}) fechado demais (${Math.round(elbowA)}°)`)
  }
  // nada abaixo do chão
  for (const [n, p] of JOINTS(s)) if (p[1] < -1) out.push(`${n} abaixo do chão (${fmt(p[1])} cm)`)
  // cabeça não fica abaixo do joelho em pé, etc.: alturas absurdas
  if (s.head[1] > HEIGHT * 1.6) out.push('cabeça alta demais')
  // corpo não atravessa sólidos (exceto pontos de contato: mãos e pés)
  for (const box of props.flatMap(solidsOf))
    for (const [n, p] of JOINTS(s)) {
      if (CONTACT_OK.test(n)) continue
      const inside = p.every((c, i) => c > box.min[i] + 1 && c < box.max[i] - 1)
      if (inside) out.push(`${n} dentro do ${box.name}`)
    }
  return out
}

/** Roda tudo: ficha, gerais (todos os quadros) e específicas. Lista vazia = aprovado no portão 2. */
export function runChecks(spec: ExerciseSpec, stepMs = 40): Failure[] {
  const failures: Failure[] = specErrors(spec).map((m) => ({ check: 'ficha', where: '—', message: m }))
  const T = cycleMs(spec)
  const seen = new Set<string>()
  const push = (f: Failure) => {
    const key = `${f.check}|${f.message.replace(/[\d,]+/g, '#')}`
    if (!seen.has(key)) {
      seen.add(key)
      failures.push(f)
    }
  }
  // poses-chave
  spec.frames.forEach((f, i) => {
    const s = sampleAt(spec, keyframeTime(spec, i)).skeleton
    const where = `pose ${i + 1} (${f.phase})`
    for (const m of generalFailures(s, spec.props, true)) push({ check: 'geral', where, message: m })
    for (const c of spec.checks) {
      const at = c.at ?? 'keyframes'
      const applies =
        at === 'all' || at === 'keyframes' || (typeof at === 'object' && ('phase' in at ? at.phase === f.phase : at.pose === f.name))
      if (applies) {
        const r = c.test(s)
        if (r !== true) push({ check: c.name, where, message: r })
      }
    }
  })
  // todos os quadros
  for (let t = 0; t < T; t += stepMs) {
    const smp = sampleAt(spec, t)
    const where = `${t} ms (${smp.phase})`
    for (const m of generalFailures(smp.skeleton, spec.props, false)) push({ check: 'geral', where, message: m })
    for (const c of spec.checks)
      if (c.at === 'all') {
        const r = c.test(smp.skeleton)
        if (r !== true) push({ check: c.name, where, message: r })
      }
  }
  return failures
}

/** Instante (ms) em que o ciclo está parado na pose-chave i. */
export function keyframeTime(spec: Pick<ExerciseSpec, 'frames'>, i: number): number {
  let t = 0
  for (let k = 0; k <= i; k++) t += spec.frames[k].moveMs + (k < i ? spec.frames[k].holdMs : 0)
  return t + Math.min(1, spec.frames[i].holdMs / 2)
}

export { DIM }
