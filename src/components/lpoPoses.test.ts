import { describe, expect, it } from 'vitest'
import { GROUND, LEN, SEQUENCES, cycleMs, knee, poseAt, skeleton } from './lpoPoses'

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('animações de LPO', () => {
  it('coxa e canela mantêm o comprimento em todas as poses (pés presos ao chão)', () => {
    for (const { frames } of Object.values(SEQUENCES)) {
      for (const [p] of frames) {
        for (const leg of skeleton(p).legs) {
          expect(dist(p.hip, leg.knee)).toBeCloseTo(LEN.thigh, 1)
          expect(dist(leg.knee, leg.ankle)).toBeCloseTo(LEN.shin, 1)
          expect(leg.ankle[1]).toBeLessThanOrEqual(GROUND)
        }
      }
    }
  })

  it('joelho sempre à frente da linha quadril–tornozelo', () => {
    const k = knee([46, 86], [60, 107])
    expect(k[0]).toBeGreaterThan(53)
  })

  it('arranco e clean começam com a anilha apoiada no chão', () => {
    for (const id of ['snatch', 'clean'] as const) {
      const hand = skeleton(SEQUENCES[id].frames[0][0]).hand
      expect(GROUND - hand[1]).toBeCloseTo(LEN.plate, 0)
    }
  })

  it('termina com a barra acima da cabeça (arranco/jerk) ou nos ombros (clean)', () => {
    const end = (id: keyof typeof SEQUENCES) => skeleton(SEQUENCES[id].frames.at(-1)![0])
    expect(end('snatch').hand[1]).toBeLessThan(end('snatch').head[1])
    expect(end('jerk').hand[1]).toBeLessThan(end('jerk').head[1])
    const c = end('clean')
    expect(Math.abs(c.hand[1] - c.shoulder[1])).toBeLessThan(10)
  })

  it('a interpolação é contínua e o ciclo fecha', () => {
    const { frames } = SEQUENCES.snatch
    const T = cycleMs(frames)
    expect(poseAt(frames, 0).hip[0]).toBeCloseTo(poseAt(frames, T).hip[0], 5)
    for (let t = 0; t < T; t += 16) {
      expect(dist(poseAt(frames, t).hip, poseAt(frames, t + 16).hip)).toBeLessThan(3)
    }
  })
})
