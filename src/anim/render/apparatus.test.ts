import { describe, expect, it } from 'vitest'
import { SIDES } from '../body'
import { EXERCISES } from '../exercises'
import { DIM, insideSolid, legPressPlatform, solidsAt, solidsOf, type PropSpec } from '../props'
import { cycleMs, sampleAt } from '../spec'
import { add, dot, mul, v } from '../vec'

/** Aparelhos: a mesma geometria serve para desenhar e para verificar (props.ts + propGeom.ts). */

const byKind = (kind: PropSpec['kind']) => EXERCISES.flatMap((e) => e.props.filter((p) => p.kind === kind).map((p) => [e, p] as const))

describe('aparelhos — sólidos', () => {
  it('barra fixa: a cabeça encostada na barra conta como atravessar; 12 cm à frente, não', () => {
    const bar: PropSpec = { kind: 'pullupBar', x: 0, y: 225, halfLength: 60 }
    const [solid] = solidsOf(bar)
    expect(solid.name).toBe('barra fixa')
    expect(insideSolid(solid, v(0, 225 + 4, 0))).toBe(true)
    expect(insideSolid(solid, v(DIM.pullupBar.clearance + 1.5, 225, 0))).toBe(false)
    // montantes nas pontas
    expect(solidsOf(bar).filter((b) => b.name.startsWith('montante'))).toHaveLength(2)
  })

  it('caixa inclinada (plataforma): dentro/fora pelo referencial dela, não pela caixa envolvente', () => {
    for (const [e, p] of byKind('legPress')) {
      const s = sampleAt(e, 0).skeleton
      const plat = solidsAt(p, s).find((b) => b.obb)!
      expect(plat, e.name).toBeTruthy()
      const { face, rail, up } = legPressPlatform(p as Extract<PropSpec, { kind: 'legPress' }>, s)
      expect(insideSolid(plat, add(face, mul(rail, DIM.legPress.platformThickness / 2)), 0.5)).toBe(true)
      // canto da caixa envolvente, fora da plataforma inclinada
      expect(insideSolid(plat, add(face, add(mul(up, DIM.legPress.platformHalfHeight * 0.9), mul(rail, 15))))).toBe(false)
    }
  })

  it('leg press: a plataforma se apoia na SOLA (nenhum calcanhar/ponta passa dela) em todo o ciclo', () => {
    for (const [e, p] of byKind('legPress')) {
      for (let t = 0; t < cycleMs(e); t += 40) {
        const s = sampleAt(e, t).skeleton
        const { face, rail } = legPressPlatform(p as Extract<PropSpec, { kind: 'legPress' }>, s)
        const sole = SIDES.flatMap((k) => [s.heel[k], s.toe[k]]).map((q) => dot(q, rail) - dot(face, rail))
        expect(Math.max(...sole), e.name).toBeCloseTo(0, 6)
      }
    }
  })

  it('leg press: nenhuma articulação (fora pés e mãos) dentro da plataforma em todo o ciclo', () => {
    for (const [e, p] of byKind('legPress')) {
      for (let t = 0; t < cycleMs(e); t += 40) {
        const s = sampleAt(e, t).skeleton
        const plat = solidsAt(p, s).find((b) => b.obb)!
        for (const k of SIDES) for (const j of ['knee', 'hip', 'shoulder', 'elbow'] as const) expect(insideSolid(plat, s[j][k]), `${e.name} ${j} ${k} @${t}`).toBe(false)
      }
    }
  })

  it('puxada alta: assento, apoio de coxas e torre são sólidos; os rolos ficam em cima das coxas', () => {
    const items = byKind('latPulldown')
    expect(items.length).toBeGreaterThan(0)
    for (const [e, p] of items) {
      const names = solidsOf(p).map((b) => b.name)
      expect(names).toEqual(['assento da puxada', 'apoio de coxas', 'torre da puxada'])
      const pad = (p as Extract<PropSpec, { kind: 'latPulldown' }>).thighPad
      const s = sampleAt(e, 0).skeleton
      // rolo logo acima da coxa, perto do joelho (segura o atleta), sem atravessar
      const knee = s.knee.L
      expect(pad.y, e.name).toBeGreaterThan(knee[1])
      expect(pad.y - knee[1], e.name).toBeLessThan(22)
      expect(Math.abs(pad.x - knee[0]), e.name).toBeLessThan(15)
    }
  })
})
