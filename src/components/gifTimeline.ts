/**
 * Linha do tempo do player de GIFs: quadros (de uma ou várias partes) com duração, e o que desenhar
 * em cada instante. Pura (testável): o componente só desenha o resultado no canvas.
 *
 * Os GIFs do dataset têm 12–24 quadros por ciclo (~4–5 por segundo). Em vez de saltar, cada quadro
 * fica parado na primeira parte do seu tempo e se funde no seguinte na parte final; na troca de parte
 * (ex.: puxada → recepção) a fusão é mais longa, para não haver corte seco.
 */

export interface TimelineFrame {
  /** Duração do quadro no GIF original (ms). */
  ms: number
  /** Índice da parte (GIF) de onde vem. */
  part: number
}

/** Fração final de cada quadro usada para fundir no próximo. */
export const BLEND = 0.55
/** Tempo extra de fusão na troca de parte (ms). */
export const PART_FADE_MS = 450

export interface Timeline {
  /** Início de cada quadro no ciclo (ms) e duração efetiva (com a fusão de troca de parte). */
  starts: number[]
  durations: number[]
  total: number
  /** Início e fim de cada parte no ciclo (para a barra de progresso). */
  parts: { start: number; end: number }[]
}

export function buildTimeline(frames: TimelineFrame[]): Timeline {
  const starts: number[] = []
  const durations: number[] = []
  let t = 0
  frames.forEach((f, i) => {
    const next = frames[(i + 1) % frames.length]
    // o último quadro de uma parte ganha a fusão longa para o primeiro da seguinte
    const d = f.ms + (next.part !== f.part ? PART_FADE_MS : 0)
    starts.push(t)
    durations.push(d)
    t += d
  })
  const nParts = Math.max(...frames.map((f) => f.part)) + 1
  const parts = Array.from({ length: nParts }, (_, p) => {
    const idx = frames.map((f, i) => (f.part === p ? i : -1)).filter((i) => i >= 0)
    return { start: starts[idx[0]], end: starts[idx.at(-1)!] + durations[idx.at(-1)!] }
  })
  return { starts, durations, total: t, parts }
}

const smooth = (x: number) => x * x * (3 - 2 * x)

/** O que desenhar no instante `ms`: quadro de base, próximo quadro e opacidade dele (0–1). */
export function sample(tl: Timeline, frames: TimelineFrame[], ms: number): { a: number; b: number; mix: number; part: number } {
  const t = ((ms % tl.total) + tl.total) % tl.total
  // busca binária do quadro corrente
  let lo = 0
  let hi = tl.starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (tl.starts[mid] <= t) lo = mid
    else hi = mid - 1
  }
  const a = lo
  const b = (a + 1) % frames.length
  const f = (t - tl.starts[a]) / tl.durations[a]
  const changesPart = frames[b].part !== frames[a].part
  // na troca de parte a fusão ocupa o tempo extra inteiro; nos demais, a fração final do quadro
  const blendFrom = changesPart ? frames[a].ms / tl.durations[a] : 1 - BLEND
  const mix = f <= blendFrom ? 0 : smooth(Math.min(1, (f - blendFrom) / (1 - blendFrom)))
  return { a, b, mix, part: mix > 0.5 ? frames[b].part : frames[a].part }
}

/** Instante de início de uma parte (para pular para ela). */
export const partStart = (tl: Timeline, part: number) => tl.parts[part]?.start ?? 0
