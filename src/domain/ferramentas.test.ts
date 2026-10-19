import { describe, expect, it } from 'vitest'
import { loadable, percentTable, platesPerSide, warmupRamp } from './ferramentas'

describe('calculadora de anilhas (por lado)', () => {
  it('100 kg na barra de 20: 25 + 15 de cada lado', () => {
    expect(platesPerSide(100, 20)).toEqual({
      perSide: 40,
      plates: [
        { plate: 25, count: 1 },
        { plate: 15, count: 1 },
      ],
      leftoverKg: 0,
      loadedKg: 100,
      onlyBar: false,
    })
  })

  it('usa 1,25 sem resíduo de ponto flutuante (72,5 kg; 26,25 por lado)', () => {
    const r = platesPerSide(72.5, 20)
    expect(r.perSide).toBe(26.25)
    expect(r.plates).toEqual([
      { plate: 25, count: 1 },
      { plate: 1.25, count: 1 },
    ])
    expect(r.leftoverKg).toBe(0)
    expect(platesPerSide(61.25 * 2 + 20, 20).leftoverKg).toBe(0)
  })

  it('várias anilhas iguais e barra de 15 kg', () => {
    expect(platesPerSide(155, 15).plates).toEqual([{ plate: 25, count: 2 }, { plate: 20, count: 1 }])
  })

  it('avisa a sobra que não fecha', () => {
    const r = platesPerSide(101, 20)
    expect(r.plates).toEqual([{ plate: 25, count: 1 }, { plate: 15, count: 1 }])
    expect(r.leftoverKg).toBe(1)
    expect(r.loadedKg).toBe(100)
    expect(platesPerSide(23, 20)).toMatchObject({ plates: [{ plate: 1.25, count: 1 }], leftoverKg: 0.5 })
  })

  it('alvo até o peso da barra: só a barra', () => {
    expect(platesPerSide(20, 20)).toMatchObject({ onlyBar: true, plates: [], loadedKg: 20 })
    expect(platesPerSide(10, 20).onlyBar).toBe(true)
  })
})

describe('rampa de aquecimento LPO', () => {
  it('barra, 40, 60, 75, 85, 92% e o alvo, em cargas montáveis', () => {
    expect(warmupRamp(100, 20).map((s) => [s.label, s.kg, s.reps])).toEqual([
      ['Barra', 20, '5 reps'],
      ['40%', 40, '3 reps'],
      ['60%', 60, '2 reps'],
      ['75%', 75, '2 reps'],
      ['85%', 85, '1 rep'],
      ['92%', 92.5, '1 rep'],
      ['Alvo', 100, 'séries de trabalho'],
    ])
  })

  it('pula degraus repetidos ou abaixo da barra', () => {
    // 40 kg: 40% = 16 → barra (repetido), 60% = 24 → 25
    expect(warmupRamp(40, 20).map((s) => s.kg)).toEqual([20, 25, 30, 35, 37.5, 40])
    expect(warmupRamp(15, 15).map((s) => s.label)).toEqual(['Barra'])
  })

  it('usa a barra escolhida', () => {
    expect(warmupRamp(60, 15)[0]).toEqual({ label: 'Barra', pct: null, kg: 15, reps: '5 reps' })
    expect(warmupRamp(60, 15)[1].kg).toBe(25) // 24 → 25
  })

  it('arredonda para múltiplos de 2,5 kg', () => {
    expect([loadable(41.2), loadable(43.8), loadable(10)]).toEqual([40, 45, 20])
  })
})

describe('tabela de % do 1RM', () => {
  it('50 a 95% com reps sugeridas', () => {
    const t = percentTable(100)
    expect(t.map((r) => r.pct)).toEqual([50, 60, 70, 75, 80, 85, 90, 95])
    expect(t[0]).toEqual({ pct: 50, reps: '4–5 reps', kg: 50 })
    expect(t.at(-1)).toEqual({ pct: 95, reps: '1 rep', kg: 95 })
    expect(percentTable(87).find((r) => r.pct === 85)?.kg).toBe(74) // 73,95 → 74
    expect(percentTable(0)[0].kg).toBe(0)
  })
})
