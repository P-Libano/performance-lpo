import { describe, expect, it } from 'vitest'
import { BLEND, PART_FADE_MS, buildTimeline, partStart, sample } from './gifTimeline'

// 2 partes: 3 quadros de 200 ms + 2 quadros de 300 ms
const frames = [
  { ms: 200, part: 0 },
  { ms: 200, part: 0 },
  { ms: 200, part: 0 },
  { ms: 300, part: 1 },
  { ms: 300, part: 1 },
]
const tl = buildTimeline(frames)

describe('linha do tempo do player de GIFs', () => {
  it('soma as durações e acrescenta a fusão longa nas trocas de parte (inclusive a volta ao início)', () => {
    expect(tl.durations).toEqual([200, 200, 200 + PART_FADE_MS, 300, 300 + PART_FADE_MS])
    expect(tl.total).toBe(3 * 200 + 2 * 300 + 2 * PART_FADE_MS)
    expect(tl.parts).toEqual([
      { start: 0, end: 600 + PART_FADE_MS },
      { start: 600 + PART_FADE_MS, end: tl.total },
    ])
    expect(partStart(tl, 1)).toBe(600 + PART_FADE_MS)
  })

  it('o quadro fica parado no começo e se funde no próximo no fim do seu tempo', () => {
    expect(sample(tl, frames, 0)).toEqual({ a: 0, b: 1, mix: 0, part: 0 })
    expect(sample(tl, frames, 200 * (1 - BLEND) - 1).mix).toBe(0)
    const meio = sample(tl, frames, 200 * (1 - BLEND / 2))
    expect(meio.mix).toBeGreaterThan(0.3)
    expect(meio.mix).toBeLessThan(0.7)
    expect(sample(tl, frames, 199.9).mix).toBeGreaterThan(0.99)
  })

  it('a opacidade só cresce dentro de um quadro (sem piscar)', () => {
    let prev = -1
    for (let t = 0; t < 200; t += 5) {
      const m = sample(tl, frames, t).mix
      expect(m).toBeGreaterThanOrEqual(prev)
      prev = m
    }
  })

  it('na troca de parte a fusão usa todo o tempo extra e a legenda vira no meio dela', () => {
    const inicio = 400 + 200 // fim do 3º quadro da parte 0
    expect(sample(tl, frames, inicio - 1)).toMatchObject({ a: 2, b: 3, mix: 0, part: 0 })
    expect(sample(tl, frames, inicio + PART_FADE_MS * 0.25)).toMatchObject({ a: 2, b: 3, part: 0 })
    expect(sample(tl, frames, inicio + PART_FADE_MS * 0.75)).toMatchObject({ a: 2, b: 3, part: 1 })
  })

  it('o ciclo fecha: o último quadro se funde no primeiro', () => {
    const fimUltimo = tl.total - 1
    expect(sample(tl, frames, fimUltimo)).toMatchObject({ a: 4, b: 0 })
    expect(sample(tl, frames, tl.total)).toEqual(sample(tl, frames, 0))
  })

  it('GIF de uma parte só: sem fusão longa', () => {
    const one = buildTimeline([
      { ms: 250, part: 0 },
      { ms: 250, part: 0 },
    ])
    expect(one.total).toBe(500)
  })
})
