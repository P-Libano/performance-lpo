import { describe, expect, it } from 'vitest'
import { ARM } from './body'
import { lib, runChecks, specErrors } from './checks'
import { terra } from './exercises/terra'
import { armsAtSides, both, footFlat, jointAngle, mirrorFoot, mirrorPose, solve, type PoseSpec } from './pose'
import { sampleAt, type ExerciseSpec } from './spec'
import { v } from './vec'

/**
 * Recursos do motor pedidos nos relatórios do piloto: sola em superfície inclinada, espelho de poses,
 * braços ao lado do corpo, arco das mãos em volta do ombro, limites da ficha e colisão ao longo dos ossos.
 */

const frame = (name: string) => terra.frames.find((f) => f.name === name)!.pose
const standing = frame('Travamento')

describe('motor: pés', () => {
  it('em pé, o calcanhar fica abaixo do tornozelo e no chão', () => {
    const s = solve(standing)
    for (const k of ['L', 'R'] as const) {
      expect(s.heel[k][1]).toBeLessThan(s.ankle[k][1])
      expect(Math.abs(s.heel[k][1])).toBeLessThan(1.5)
    }
  })

  it('sola explícita (plataforma do leg press) põe o calcanhar do lado da sola', () => {
    // plataforma inclinada 45°: a sola aponta para a frente-baixo (+x, −y)
    const sole = v(Math.SQRT1_2, -Math.SQRT1_2, 0)
    const ankle = v(70, 60, 12)
    const toe = v(70 + 12 * Math.SQRT1_2, 60 + 12 * Math.SQRT1_2, 12)
    const p: PoseSpec = { ...standing, pelvis: v(0, 55, 0), pitch: -30, feet: both({ ankle, toe, sole }, mirrorFoot) }
    const s = solve(p)
    const d = [s.heel.L[0] - s.ankle.L[0], s.heel.L[1] - s.ankle.L[1], s.heel.L[2] - s.ankle.L[2]]
    expect(d[0] * sole[0] + d[1] * sole[1] + d[2] * sole[2]).toBeGreaterThan(5)
  })
})

describe('motor: helpers de pose', () => {
  it('mirrorPose troca os lados e espelha em z', () => {
    const assim: PoseSpec = { ...standing, yaw: 10, twist: 5, feet: { L: footFlat(10, 15), R: footFlat(-5, -12) } }
    const a = solve(assim)
    const b = solve(mirrorPose(assim))
    for (const j of ['knee', 'ankle', 'shoulder', 'elbow', 'hand'] as const) {
      expect(b[j].L[0]).toBeCloseTo(a[j].R[0], 4)
      expect(b[j].L[1]).toBeCloseTo(a[j].R[1], 4)
      expect(b[j].L[2]).toBeCloseTo(-a[j].R[2], 4)
    }
  })

  it('armsAtSides: braços alcançam e ficam colados ao tronco', () => {
    const { hands: _h, ...rest } = standing
    const s = solve({ ...rest, hands: armsAtSides(rest) })
    expect(s.reachError.hand.L).toBeLessThan(0.3)
    expect(s.reachError.hand.R).toBeLessThan(0.3)
    expect(lib.upperArmToTrunk(0, 15)(s)).toBe(true)
  })
})

describe('motor: caminho das mãos', () => {
  // braços de baixo (ao lado) até acima da cabeça: em reta, a mão passa por dentro do ombro
  const { hands: _h, ...rest } = standing
  const down = { ...rest, hands: armsAtSides(rest) }
  const sh = solve(down).shoulder
  const reach = (ARM.a + ARM.b) * 0.996
  const up: PoseSpec = { ...rest, hands: { L: v(sh.L[0], sh.L[1] + reach, sh.L[2]), R: v(sh.R[0], sh.R[1] + reach, sh.R[2]) } }
  const spec = (handPath?: 'shoulder'): Pick<ExerciseSpec, 'frames'> => ({
    frames: [
      { pose: down, moveMs: 600, holdMs: 200, phase: 'a' },
      { pose: up, moveMs: 600, holdMs: 200, phase: 'b', handPath },
    ],
  })
  const minElbow = (sp: Pick<ExerciseSpec, 'frames'>) => {
    let min = 180
    for (let t = 800; t < 1400; t += 20) {
      const s = sampleAt(sp, t).skeleton
      min = Math.min(min, jointAngle(s.shoulder.L, s.elbow.L, s.hand.L))
    }
    return min
  }

  it("'shoulder' mantém o braço aberto (balanço), 'linear' dobra o cotovelo", () => {
    expect(minElbow(spec('shoulder'))).toBeGreaterThan(150)
    expect(minElbow(spec())).toBeLessThan(minElbow(spec('shoulder')))
  })
})

describe('joelho', () => {
  it('padrão: no terra (tronco inclinado) o joelho dobra para a ponta do pé, não para o lado', () => {
    const s = solve(frame('Posição inicial'))
    for (const k of ['L', 'R'] as const) {
      const out = Math.abs(s.knee[k][2]) - Math.abs(s.ankle[k][2])
      // com a ponta do pé a 8° para fora e o joelho bem dobrado, ~9 cm é o acompanhamento normal; o bug abria ~20
      expect(out).toBeLessThan(12)
    }
  })

  it('joelho forçado para o lado com o pé no chão é acusado pela verificação geral', () => {
    const bad: ExerciseSpec = {
      ...terra,
      frames: terra.frames.map((f) => ({ ...f, pose: { ...f.pose, kneePole: { L: v(0, 0, 1), R: v(0, 0, -1) } } })),
    }
    expect(runChecks(bad).some((f) => /joelho \([LR]\) dobra a/.test(f.message))).toBe(true)
  })
})

describe('ficha: limites', () => {
  it('mais de 8 poses-chave é acusado', () => {
    const many = { ...terra, frames: [...terra.frames, ...terra.frames].slice(0, 9) }
    expect(specErrors(many)).toContain('use de 2 a 8 poses-chave')
  })

  it('pose do meio sem pausa é acusada (vira a miniatura)', () => {
    const i = Math.floor(terra.frames.length / 2)
    const bad = { ...terra, frames: terra.frames.map((f, j) => (j === i ? { ...f, holdMs: 0 } : f)) }
    expect(specErrors(bad).some((e) => e.startsWith('a pose do meio'))).toBe(true)
  })
})

describe('colisão ao longo dos ossos', () => {
  it('canela atravessando um banco baixo é acusada mesmo com joelho e tornozelo fora', () => {
    const s = solve(standing)
    const x = s.ankle.L[0]
    const bad: ExerciseSpec = { ...terra, props: [...terra.props, { kind: 'bench', x0: x - 8, x1: x + 8, height: 30 }] }
    expect(runChecks(bad).some((f) => f.message.startsWith('canela'))).toBe(true)
  })
})

describe('biblioteca de restrições', () => {
  const s = solve(standing)
  it('em pé: tronco ~vertical, corpo reto, quadril aberto, joelho na direção do pé', () => {
    expect(lib.trunkLean(-8, 8)(s)).toBe(true)
    expect(lib.bodyLine(165)(s)).toBe(true)
    expect(lib.hipAngle(160)(s)).toBe(true)
    expect(lib.kneeTracksFoot(15)(s)).toBe(true)
    expect(lib.soleOn(v(0, 0, 0), v(0, 1, 0), 2)(s)).toBe(true)
  })

  it('reprovam o que devem', () => {
    const start = solve(frame('Posição inicial'))
    expect(lib.trunkLean(-8, 8)(start)).not.toBe(true) // tronco à frente na saída do chão
    expect(lib.trunkLean(20, 80)(start)).toBe(true)
    expect(lib.hipAngle(160)(start)).not.toBe(true)
    expect(lib.feetOffFloor(3)(s)).not.toBe(true)
    expect(lib.seatedOn(0)(s)).not.toBe(true)
    expect(lib.heightRel((k) => k.hand.L, (k) => k.shoulder.L, 40, 80, 'ombro acima da mão')(s)).toBe(true)
    expect(lib.knee(170, 180, 'L')(start)).not.toBe(true)
  })
})
