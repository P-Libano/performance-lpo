import type { Skeleton } from './body'
import type { MuscleId } from './muscles'
import { EASE, defaultElbowPole, defaultKneePole, mixPose, shouldersOf, slerp, solve, type Ease, type PoseSpec } from './pose'
import { add, dot, len, mul, sub, unit, type V3 } from './vec'
import type { PropSpec } from './props'

/**
 * Formato de um exercício (um arquivo por exercício em src/anim/exercises/). Ver docs/animacoes/PROCESSO.md:
 * a ficha técnica (fases, pontos-chave, músculos com fonte) vem antes das poses; o status de revisão decide
 * se o app usa esta animação ou o GIF do dataset.
 */

export interface Keyframe {
  /** nome da pose-chave (ex.: "Posição inicial", "Travamento"), para restrições que valem só nela */
  name?: string
  pose: PoseSpec
  /** ms da pose anterior até esta (a 1ª parte da última: o ciclo fecha) */
  moveMs: number
  /** ms parado nesta pose */
  holdMs: number
  /** fase do movimento em que esta pose termina (um dos nomes de `phases`) */
  phase: string
  ease?: Ease
  /**
   * Caminho das mãos na transição até esta pose. 'linear' (padrão): reta no mundo — certo quando a mão segue
   * um objeto (barra subindo na vertical). 'shoulder': arco em volta do ombro (direção e distância ao ombro
   * interpoladas) — certo para balanço de braço livre (burpee, polichinelo, elevação), em que a reta faria a
   * mão passar por dentro do ombro e o cotovelo fechar.
   */
  handPath?: 'linear' | 'shoulder'
}

export interface Check {
  /** Frase curta, em pt-BR, do que é verificado (aparece no estúdio e nas falhas de teste). */
  name: string
  /** Onde verificar: nas poses-chave (padrão), em todos os quadros, nas poses-chave de uma fase ou numa pose nomeada. */
  at?: 'keyframes' | 'all' | { phase: string } | { pose: string }
  /** `true` = ok; texto = o que deu errado. */
  test: (s: Skeleton) => true | string
}

export type ReviewStatus = 'rascunho' | 'verificado' | 'revisado'

export interface ExerciseSpec {
  /** id do exercício no catálogo do app (dataset, ex.: '0025') ou LPO próprio ('lpo-…') */
  id: string
  /** GIF do dataset usado como referência na revisão (o que esta animação substitui) */
  datasetId: string
  name: string
  /**
   * Câmera (graus). `yaw`: de onde se olha, medido a partir da frente do atleta (+x) girando para a esquerda
   * dele (+z): 0 = de frente, 90 = perfil esquerdo, 180 = de costas. `pitch`: elevação (acima do atleta).
   * Padrão (render/camera.ts, DEFAULT_CAMERA) = { yaw: 52, pitch: 12 }: o 3/4 dos GIFs do dataset.
   * Troque quando o aparelho tapar o movimento (ex.: leg press de perfil, yaw ≈ 85).
   */
  camera?: { yaw: number; pitch: number }
  phases: { name: string; description: string }[]
  /** pontos técnicos (cada um verificável → vira um `check`) */
  keyPoints: string[]
  /** músculos por fase: principal (vermelho) e secundário (rosa) */
  muscles: { phase: string; primary: MuscleId[]; secondary: MuscleId[] }[]
  /** de onde vêm os músculos (livro, revisão de EMG…) */
  muscleSource: string
  props: PropSpec[]
  frames: Keyframe[]
  /**
   * Imagens paradas para o app (uma por fase, na ordem da execução): nomes de poses-chave. Ausente = as poses
   * nomeadas na ordem das poses-chave, sem repetir nome, até 5 (`stillFrames`).
   */
  stills?: string[]
  checks: Check[]
  review: { status: ReviewStatus; by?: string; date?: string; notes?: string }
}

// ───────── linha do tempo ─────────

export const cycleMs = (spec: Pick<ExerciseSpec, 'frames'>) => spec.frames.reduce((a, f) => a + f.moveMs + f.holdMs, 0)

export interface Sample {
  pose: PoseSpec
  skeleton: Skeleton
  /** fase em curso (a da pose para onde está indo, ou onde está parado) */
  phase: string
  /** índice da pose-chave de destino */
  frame: number
  /** true se está parado numa pose-chave */
  holding: boolean
}

/**
 * Pose no instante `ms` do ciclo (a 1ª transição parte da última pose: o ciclo fecha).
 *
 * Poses-chave seguidas SEM parada (holdMs = 0 nas intermediárias) formam um trecho só: uma curva de Hermite
 * monótona (`steffen`) que passa por todas elas, cada uma no seu tempo, com a velocidade contínua nas
 * intermediárias (sem quina nem salto de velocidade). Nas pontas do trecho (paradas) a velocidade é zero se a
 * 1ª transição tem `ease` in/inout e a última out/inout; com outro `ease` a ponta chega/sai em movimento.
 * Transição entre duas paradas: interpolação direta com o `ease` dela, como sempre.
 */
export function sampleAt(spec: Pick<ExerciseSpec, 'frames'>, ms: number): Sample {
  const T = cycleMs(spec)
  let t = ((ms % T) + T) % T
  const fr = spec.frames
  const n = fr.length
  for (let i = 0; i < n; i++) {
    const f = fr[i]
    if (t < f.moveMs) {
      const run = runOf(fr, i)
      if (run) return sampleRun(fr, run, i, t)
      const from = fr[(i - 1 + n) % n].pose
      const e = EASE[f.ease ?? 'inout'](t / f.moveMs)
      const pose = mixPose(from, f.pose, e)
      if (f.handPath === 'shoulder') pose.hands = handsOnArc(from, f.pose, pose, e)
      return { pose, skeleton: solve(pose), phase: f.phase, frame: i, holding: false }
    }
    t -= f.moveMs
    if (t < f.holdMs) return { pose: f.pose, skeleton: solve(f.pose), phase: f.phase, frame: i, holding: true }
    t -= f.holdMs
  }
  const last = n - 1
  return { pose: fr[last].pose, skeleton: solve(fr[last].pose), phase: fr[last].phase, frame: last, holding: true }
}

// ───────── trechos sem parada ─────────

/** Transições (índices, em ordem) do trecho sem parada que contém a transição `i`; null = transição isolada. */
function runOf(fr: Keyframe[], i: number): number[] | null {
  const n = fr.length
  if (!fr.some((f) => f.holdMs > 0)) return null // ciclo sem nenhuma parada: cada transição por si
  let a = i
  while (fr[(a - 1 + n) % n].holdMs === 0) a = (a - 1 + n) % n
  const idx = [a]
  while (fr[idx[idx.length - 1]].holdMs === 0) idx.push((idx[idx.length - 1] + 1) % n)
  return idx.length > 1 ? idx : null
}


const slow = (e: Ease | undefined, end: 'in' | 'out') => (e ?? 'inout') === 'inout' || (e ?? 'inout') === end

/**
 * Hermite monótono (Steffen, 1990) num valor: passa por y[k] no tempo K[k], velocidade contínua, e nunca sai
 * da faixa entre duas poses vizinhas (um pé parado no chão em duas poses não afunda entre elas; a mão não
 * passa do alcance). Pontas: velocidade zero se `stopIn`/`stopOut`, senão a inclinação do 1º/último trecho.
 */
function steffen(y: number[], K: number[], j: number, tau: number, stopIn: boolean, stopOut: boolean): number {
  const m = y.length - 1
  const slope = (k: number) => (y[k + 1] - y[k]) / (K[k + 1] - K[k])
  const tangent = (k: number) => {
    if (k === 0) return stopIn ? 0 : slope(0)
    if (k === m) return stopOut ? 0 : slope(m - 1)
    const d0 = slope(k - 1)
    const d1 = slope(k)
    if (d0 * d1 <= 0) return 0
    const h0 = K[k] - K[k - 1]
    const h1 = K[k + 1] - K[k]
    const p = (d0 * h1 + d1 * h0) / (h0 + h1)
    return Math.sign(d0) * Math.min(Math.abs(d0), Math.abs(d1), 0.5 * Math.abs(p)) * 2
  }
  const h = K[j + 1] - K[j]
  const u = (tau - K[j]) / h
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * y[j] + (-2 * u3 + 3 * u2) * y[j + 1] + h * (u3 - 2 * u2 + u) * tangent(j) + h * (u3 - u2) * tangent(j + 1)
}

/** Pose com todos os campos opcionais preenchidos (iguais em todas as poses do trecho) e direções unitárias. */
function fullPose(p: PoseSpec, all: PoseSpec[]): PoseSpec {
  const fillDir = (get: (q: PoseSpec) => V3 | undefined) => {
    const d = get(p) ?? all.map(get).find((x) => x)
    return d ? unit(d) : undefined
  }
  const foot = (k: 'L' | 'R') => ({
    ankle: p.feet[k].ankle,
    toe: p.feet[k].toe,
    ...(all.some((q) => q.feet[k].sole) ? { sole: fillDir((q) => q.feet[k].sole) } : {}),
  })
  return {
    pelvis: p.pelvis,
    pitch: p.pitch,
    yaw: p.yaw ?? 0,
    twist: p.twist ?? 0,
    head: p.head ?? 0,
    hands: p.hands,
    ...(all.some((q) => q.palms) ? { palms: { L: p.palms?.L ?? 0, R: p.palms?.R ?? 0 } } : {}),
    ...(all.some((q) => q.rack) ? { rack: { L: p.rack?.L ?? 0, R: p.rack?.R ?? 0 } } : {}),
    feet: { L: foot('L'), R: foot('R') },
    // guia ausente nesta pose = a padrão dela (não a de outra pose do trecho: na parada seguinte, sem guia, o
    // joelho/cotovelo voltava de uma vez para a padrão)
    ...(all.some((q) => q.elbowPole)
      ? { elbowPole: { L: unit(p.elbowPole?.L ?? defaultElbowPole(p, 'L')), R: unit(p.elbowPole?.R ?? defaultElbowPole(p, 'R')) } }
      : {}),
    ...(all.some((q) => q.kneePole)
      ? { kneePole: { L: unit(p.kneePole?.L ?? defaultKneePole(p, 'L')), R: unit(p.kneePole?.R ?? defaultKneePole(p, 'R')) } }
      : {}),
  } as PoseSpec
}

/** Mesma curva em cada número da estrutura (poses de mesmo formato). */
function curveOf<T>(xs: T[], f: (y: number[]) => number): T {
  const x0 = xs[0] as unknown
  if (typeof x0 === 'number') return f(xs as number[]) as T
  if (Array.isArray(x0)) return x0.map((_, c) => f(xs.map((x) => (x as number[])[c]))) as T
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(x0 as object)) out[key] = curveOf(xs.map((x) => (x as Record<string, unknown>)[key]), f)
  return out as T
}

function sampleRun(fr: Keyframe[], idx: number[], i: number, lt: number): Sample {
  const n = fr.length
  const m = idx.length
  // poses do trecho (da parada de partida até a de chegada) e o tempo de chegada em cada uma
  const raw: PoseSpec[] = [fr[(idx[0] - 1 + n) % n].pose, ...idx.map((k) => fr[k].pose)]
  const P = raw.map((p) => fullPose(p, raw))
  const K: number[] = [0]
  for (const k of idx) K.push(K[K.length - 1] + fr[k].moveMs)
  const j = idx.indexOf(i)
  const tau = K[j] + lt
  const stopIn = slow(fr[idx[0]].ease, 'in')
  const stopOut = slow(fr[idx[m - 1]].ease, 'out')
  const f = (y: number[]) => steffen(y, K, j, tau, stopIn, stopOut)
  const pose = curveOf(P, f)
  // guias de cotovelo/joelho: giro com velocidade angular uniforme (slerp) entre as poses vizinhas, com o
  // ângulo acumulado passando pela mesma curva suave. Interpoladas componente a componente, duas guias distantes
  // (ex.: cotovelo por fora → à frente no rack, ~130°) giravam quase tudo no meio da transição, de uma vez
  for (const key of ['elbowPole', 'kneePole'] as const) {
    if (!pose[key]) continue
    for (const k of ['L', 'R'] as const) {
      const dirs = P.map((p) => p[key]![k]!)
      const acc = [0]
      for (let q = 1; q < dirs.length; q++) acc.push(acc[q - 1] + angleBetween(dirs[q - 1], dirs[q]))
      const span = acc[j + 1] - acc[j]
      const u = span < 1e-6 ? 0 : Math.min(1, Math.max(0, (f(acc) - acc[j]) / span))
      pose[key]![k] = slerp(dirs[j], dirs[j + 1], u)
    }
  }
  // só na transição marcada: no mesmo trecho pode haver mão presa ao ombro (braços estendidos) e barra com
  // altura própria no mundo (puxada alta, passagem por baixo)
  if (fr[i].handPath === 'shoulder') {
    // mãos em arco em volta do ombro: direção e distância ao ombro passam pela mesma curva
    // (a mão que não muda no trecho, ex. apoiada no chão, fica onde está)
    const sm = shouldersOf(pose)
    for (const k of ['L', 'R'] as const) {
      if (P.every((p) => len(sub(p.hands[k], P[0].hands[k])) < 1e-6)) continue
      const rel = P.map((p) => sub(p.hands[k], shouldersOf(p)[k]))
      pose.hands[k] = add(sm[k], mul(unit(curveOf(rel.map(unit), f)), f(rel.map(len))))
    }
  }
  return { pose, skeleton: solve(pose), phase: fr[i].phase, frame: i, holding: false }
}

/** Ângulo (rad) entre duas direções. */
const angleBetween = (a: V3, b: V3) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b)))))

/** Mãos em arco em volta do ombro: direção (esférica) e distância ao ombro interpoladas. */
function handsOnArc(a: PoseSpec, b: PoseSpec, mid: PoseSpec, t: number): PoseSpec['hands'] {
  const sa = shouldersOf(a)
  const sb = shouldersOf(b)
  const sm = shouldersOf(mid)
  const out = {} as PoseSpec['hands']
  for (const k of ['L', 'R'] as const) {
    const ra = sub(a.hands[k], sa[k])
    const rb = sub(b.hands[k], sb[k])
    const da = len(ra)
    const db = len(rb)
    const ua = unit(ra)
    const ub = unit(rb)
    // slerp da direção
    const cos = Math.max(-1, Math.min(1, dot(ua, ub)))
    const om = Math.acos(cos)
    const dir =
      om < 1e-4
        ? ua
        : add(mul(ua, Math.sin((1 - t) * om) / Math.sin(om)), mul(ub, Math.sin(t * om) / Math.sin(om)))
    out[k] = add(sm[k], mul(unit(dir), da + (db - da) * t))
  }
  return out
}

/** Instante (ms) em que o ciclo está parado na pose-chave i. */
export function keyframeTime(spec: Pick<ExerciseSpec, 'frames'>, i: number): number {
  let t = 0
  for (let k = 0; k <= i; k++) t += spec.frames[k].moveMs + (k < i ? spec.frames[k].holdMs : 0)
  return t + Math.min(1, spec.frames[i].holdMs / 2)
}

/** Poses que viram imagens paradas no app: índice da pose-chave, nome e instante (ms) em que o ciclo está parado nela. */
export function stillFrames(spec: Pick<ExerciseSpec, 'frames' | 'stills'>): { frame: number; name: string; ms: number }[] {
  const named = spec.frames.map((f, i) => ({ frame: i, name: f.name ?? '' })).filter((x) => x.name)
  const pick = spec.stills
    ? spec.stills.map((n) => {
        const hit = named.find((x) => x.name === n)
        if (!hit) throw new Error(`stills: pose "${n}" não existe`)
        return hit
      })
    : named.filter((x, i) => named.findIndex((y) => y.name === x.name) === i).slice(0, 5)
  return pick.map((x) => ({ ...x, ms: keyframeTime(spec, x.frame) }))
}

/** Músculos da fase (para o destaque e o mapa muscular). */
export const musclesOf = (spec: ExerciseSpec, phase: string) =>
  spec.muscles.find((m) => m.phase === phase) ?? { phase, primary: [], secondary: [] }
