import { describe, expect, it } from 'vitest'
import { ARM, HEIGHT, LEG, SEG } from './body'
import { both, footFlat, footOnToes, ik2, jointAngle, mirrorFoot, mirrorZ, solve, trunkFrame, type PoseSpec } from './pose'
import { dist, v } from './vec'

const standing: PoseSpec = {
  pelvis: v(0, SEG.ankleHeight + LEG.a + LEG.b - 0.5, 0),
  pitch: 0,
  hands: both(v(0, 85, 18), mirrorZ),
  feet: both(footFlat(0, SEG.hipHalf), mirrorFoot),
}

describe('esqueleto 3D', () => {
  it('referencial do tronco: em pé, inclinado, de bruços e de costas', () => {
    const r = (x: readonly number[]) => x.map((n) => Math.round(n * 100) / 100 + 0)
    expect(r(trunkFrame(0).up)).toEqual([0, 1, 0])
    expect(r(trunkFrame(90).up)).toEqual([1, 0, 0]) // de bruços: cabeça para a frente
    expect(r(trunkFrame(90).front)).toEqual([0, -1, 0]) // olhando para o chão
    expect(r(trunkFrame(-90).up)).toEqual([-1, 0, 0]) // de costas: cabeça para trás
    expect(r(trunkFrame(-90).front)).toEqual([0, 1, 0]) // olhando para o teto
    expect(r(trunkFrame(0, 90).front)).toEqual([0, 0, -1])
  })

  it('cinemática de 2 ossos: comprimentos exatos e dobra para o lado do guia', () => {
    const r = ik2(v(0, 0, 0), v(0, -50, 0), 30, 30, v(1, 0, 0))
    expect(dist(v(0, 0, 0), r.mid)).toBeCloseTo(30, 6)
    expect(dist(r.mid, r.tip)).toBeCloseTo(30, 6)
    expect(r.mid[0]).toBeGreaterThan(0)
    expect(r.error).toBe(0)
    expect(ik2(v(0, 0, 0), v(0, -70, 0), 30, 30, v(1, 0, 0)).error).toBeCloseTo(10, 6)
  })

  it('em pé: ossos com o comprimento antropométrico e alturas plausíveis para 175 cm', () => {
    const s = solve(standing)
    for (const k of ['L', 'R'] as const) {
      expect(dist(s.hip[k], s.knee[k])).toBeCloseTo(SEG.thigh, 4)
      expect(dist(s.knee[k], s.ankle[k])).toBeCloseTo(SEG.shin, 4)
      expect(dist(s.shoulder[k], s.elbow[k])).toBeCloseTo(SEG.upperArm, 4)
      expect(dist(s.elbow[k], s.hand[k])).toBeCloseTo(ARM.b, 4)
      expect(dist(s.elbow[k], s.wrist[k])).toBeCloseTo(SEG.forearm, 4)
      expect(s.reachError.foot[k]).toBe(0)
      expect(s.reachError.hand[k]).toBe(0)
    }
    expect(s.shoulder.L[1]).toBeGreaterThan(0.79 * HEIGHT)
    expect(s.shoulder.L[1]).toBeLessThan(0.84 * HEIGHT)
    expect(s.head[1] + SEG.headRadius).toBeGreaterThan(0.95 * HEIGHT)
    expect(s.head[1] + SEG.headRadius).toBeLessThan(1.03 * HEIGHT)
    expect(s.heel.L[1]).toBeCloseTo(0, 0)
    expect(s.toe.L[1]).toBeCloseTo(0, 6)
  })

  it('joelho e cotovelo dobram para o lado certo por padrão (joelho à frente)', () => {
    const squat = solve({ ...standing, pelvis: v(-20, 55, 0), pitch: 35 })
    expect(squat.knee.L[0]).toBeGreaterThan(squat.ankle.L[0])
    expect(jointAngle(squat.hip.L, squat.knee.L, squat.ankle.L)).toBeLessThan(110)
  })

  it('pé na ponta: a ponta fica no chão e o calcanhar sobe', () => {
    const f = footOnToes(0, 9, 8)
    const flat = footFlat(0, 9)
    expect(f.toe).toEqual(flat.toe)
    expect(f.ankle[1]).toBeGreaterThan(flat.ankle[1] + 5)
    expect(dist(f.ankle, f.toe)).toBeCloseTo(dist(flat.ankle, flat.toe), 6)
  })
})
