import { HEIGHT, SIDES, type Side, type Skeleton } from './body'
import { MUSCLE_IDS } from './muscles'
import { jointAngle } from './pose'
import { DIM, insideSolid, midHands, solidsAt, type PropSpec } from './props'
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
  /** Calcanhares e pontas no chão (y = floor). `side` = só um pé (unilaterais). */
  feetFlat: (floorY = 0, tol = 1.5, side?: Side): Check['test'] => (s) => {
    for (const k of side ? [side] : SIDES)
      for (const [n, p] of [
        ['calcanhar', s.heel[k]],
        ['ponta do pé', s.toe[k]],
      ] as const)
        if (Math.abs(p[1] - floorY) > tol) return `${n} (${k}) a ${fmt(p[1] - floorY)} cm do apoio`
    return true
  },
  /** Ângulo interno do joelho (180 = estendido) dentro da faixa. `side` = só um lado. */
  knee: (min: number, max: number, side?: Side): Check['test'] => (s) => {
    for (const k of side ? [side] : SIDES) {
      const a = jointAngle(s.hip[k], s.knee[k], s.ankle[k])
      if (a < min || a > max) return `joelho (${k}) a ${Math.round(a)}° (esperado ${min}–${max}°)`
    }
    return true
  },
  /** Ângulo interno do cotovelo dentro da faixa. `side` = só um lado. */
  elbow: (min: number, max: number, side?: Side): Check['test'] => (s) => {
    for (const k of side ? [side] : SIDES) {
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
  /**
   * Ângulo (3D) entre o braço (ombro → cotovelo) e o eixo do tronco apontando para os pés. No supino, é a
   * "abertura dos cotovelos" (≈ 45–75°); em pé, 0° = braço colado ao lado do corpo. Mesmo cálculo que
   * `upperArmToTrunk` (nome antigo, mantido).
   */
  elbowFlare: (min: number, max: number): Check['test'] => (s) => {
    for (const k of SIDES) {
      const arm = [s.elbow[k][0] - s.shoulder[k][0], s.elbow[k][1] - s.shoulder[k][1], s.elbow[k][2] - s.shoulder[k][2]] as const
      // ângulo entre o braço e o eixo do tronco (para baixo), no plano do tronco
      const a = angle(arm, [-s.up[0], -s.up[1], -s.up[2]])
      if (a < min || a > max) return `braço (${k}) a ${Math.round(a)}° do tronco (esperado ${min}–${max}°)`
    }
    return true
  },
  /** Ângulo braço–tronco (0° = braço colado ao lado do tronco, 90° = braço perpendicular, 180° = acima da cabeça). */
  upperArmToTrunk: (min: number, max: number, side?: Side): Check['test'] => (s) => {
    for (const k of side ? [side] : SIDES) {
      const arm = [s.elbow[k][0] - s.shoulder[k][0], s.elbow[k][1] - s.shoulder[k][1], s.elbow[k][2] - s.shoulder[k][2]] as const
      const a = angle(arm, [-s.up[0], -s.up[1], -s.up[2]])
      if (a < min || a > max) return `braço (${k}) a ${Math.round(a)}° do tronco (esperado ${min}–${max}°)`
    }
    return true
  },
  /**
   * Inclinação do tronco COM SINAL, no plano sagital do mundo: + = inclinado à frente (terra), − = para trás
   * (puxada, recuperação do arranco). Diferente de `trunk`, que mede só o ângulo com a vertical.
   */
  trunkLean: (min: number, max: number): Check['test'] => (s) => {
    const a = Math.atan2(s.up[0], s.up[1]) / (Math.PI / 180)
    return (a >= min && a <= max) || `tronco a ${Math.round(a)}° (${a >= 0 ? 'à frente' : 'para trás'}; esperado ${min}–${max}°)`
  },
  /** Sentado: pelve 8–16 cm acima do assento (as costas podem estar livres — diferente de `backOn`). */
  seatedOn: (surfaceY: number): Check['test'] => (s) => {
    const h = s.pelvis[1] - surfaceY
    return (h >= 8 && h <= 16) || `pelve a ${fmt(h)} cm do assento (esperado 8–16)`
  },
  /** Corpo alinhado (prancha, flexão): ângulo ombro–quadril–tornozelo ≥ `min` (180 = reta), média dos lados. */
  bodyLine: (min = 165): Check['test'] => (s) => {
    const a = (jointAngle(s.shoulder.L, s.hip.L, s.ankle.L) + jointAngle(s.shoulder.R, s.hip.R, s.ankle.R)) / 2
    return a >= min || `corpo dobrado no quadril (${Math.round(a)}°; mínimo ${min}°)`
  },
  /** Ângulo tronco–coxa no quadril (180 = em pé), p. ex. fundo do leg press ≥ 45° (lombar não descola). */
  hipAngle: (min: number, max = 180, side?: Side): Check['test'] => (s) => {
    for (const k of side ? [side] : SIDES) {
      const a = jointAngle(s.chest, s.hip[k], s.knee[k])
      if (a < min || a > max) return `quadril (${k}) a ${Math.round(a)}° (esperado ${min}–${max}°)`
    }
    return true
  },
  /** Joelho na direção da ponta do pé (sem "joelho para dentro"): desvio máximo `tol` graus, visto de cima. */
  kneeTracksFoot: (tol = 15, side?: Side): Check['test'] => (s) => {
    for (const k of side ? [side] : SIDES) {
      const knee = [s.knee[k][0] - s.ankle[k][0], 0, s.knee[k][2] - s.ankle[k][2]] as const
      const foot = [s.toe[k][0] - s.heel[k][0], 0, s.toe[k][2] - s.heel[k][2]] as const
      if (Math.hypot(knee[0], knee[2]) < 3) continue // joelho quase sobre o tornozelo: sem direção
      const a = angle(knee, foot)
      if (a > tol) return `joelho (${k}) a ${Math.round(a)}° da direção do pé (máx. ${tol})`
    }
    return true
  },
  /** Pés fora do chão (salto, pendurado): todos os pontos do pé acima de `min` cm. */
  feetOffFloor: (min = 3, floorY = 0): Check['test'] => (s) => {
    for (const k of SIDES)
      for (const p of [s.heel[k], s.toe[k], s.ankle[k]]) if (p[1] - floorY < min) return `pé (${k}) a ${fmt(p[1] - floorY)} cm do chão (mín. ${min})`
    return true
  },
  /** Diferença de altura entre dois pontos do esqueleto: b.y − a.y dentro de [min, max] (cm). */
  heightRel: (a: (s: Skeleton) => V3, b: (s: Skeleton) => V3, min: number, max: number, label: string): Check['test'] => (s) => {
    const d = b(s)[1] - a(s)[1]
    return (d >= min && d <= max) || `${label}: ${fmt(d)} cm (esperado ${min}–${max})`
  },
  /**
   * Sola apoiada numa superfície (plataforma do leg press, banco inclinado): calcanhar e ponta à distância
   * `tol` do plano que passa por `point` com normal `normal` (apontando para fora da superfície).
   */
  soleOn: (point: V3, normal: V3, tol = 2, side?: Side): Check['test'] => (s) => {
    const n = Math.hypot(...normal)
    const dist = (p: V3) => ((p[0] - point[0]) * normal[0] + (p[1] - point[1]) * normal[1] + (p[2] - point[2]) * normal[2]) / n
    for (const k of side ? [side] : SIDES)
      for (const [nome, p] of [
        ['calcanhar', s.heel[k]],
        ['ponta do pé', s.toe[k]],
      ] as const) {
        const d = dist(p)
        if (Math.abs(d) > tol) return `${nome} (${k}) a ${fmt(d)} cm da superfície`
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

/** Pontos internos dos ossos (25/50/75%) para a verificação de colisão com aparelhos. */
function segmentPoints(s: Skeleton): [string, V3][] {
  const out: [string, V3][] = []
  const along = (n: string, a: V3, b: V3) => {
    for (const t of [0.25, 0.5, 0.75]) out.push([`${n} (${t * 100}%)`, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]])
  }
  along('tronco', s.pelvis, s.chest)
  for (const k of SIDES) {
    along(`coxa ${k}`, s.hip[k], s.knee[k])
    along(`canela ${k}`, s.knee[k], s.ankle[k])
    along(`braço ${k}`, s.shoulder[k], s.elbow[k])
    along(`antebraço ${k}`, s.elbow[k], s.wrist[k])
  }
  return out
}

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
  if (spec.frames.length < 2 || spec.frames.length > 8) errs.push('use de 2 a 8 poses-chave')
  const mid = spec.frames[Math.floor(spec.frames.length / 2)]
  if (mid && mid.holdMs <= 0)
    errs.push(`a pose do meio (nº ${Math.floor(spec.frames.length / 2) + 1}) vira a miniatura do app: precisa de holdMs > 0 — ponha nela a pose mais representativa`)
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
    // quadril: ângulo tronco–coxa (180 = em pé); abaixo de ~25° o tronco "entra" na coxa
    const hipA = jointAngle(s.chest, s.hip[k], s.knee[k])
    if (hipA < 25) out.push(`quadril (${k}) fechado demais (${Math.round(hipA)}° entre tronco e coxa)`)
  }
  // nada abaixo do chão
  for (const [n, p] of JOINTS(s)) if (p[1] < -1) out.push(`${n} abaixo do chão (${fmt(p[1])} cm)`)
  // cabeça não fica abaixo do joelho em pé, etc.: alturas absurdas
  if (s.head[1] > HEIGHT * 1.6) out.push('cabeça alta demais')
  // corpo não atravessa sólidos: articulações (exceto pontos de contato: mãos e pés) e pontos AO LONGO dos
  // ossos (uma canela pode atravessar o banco com joelho e tornozelo fora dele)
  // (inclui os que acompanham o corpo, como a plataforma do leg press, e caixas inclinadas)
  const solids = props.flatMap((p) => solidsAt(p, s))
  if (solids.length) {
    const pts: [string, V3][] = JOINTS(s).filter(([n]) => !CONTACT_OK.test(n))
    for (const [n, p] of segmentPoints(s)) pts.push([n, p])
    for (const box of solids)
      for (const [n, p] of pts) if (insideSolid(box, p)) out.push(`${n} dentro do ${box.name}`)
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
