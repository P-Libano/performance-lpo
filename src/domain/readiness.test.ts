import { describe, expect, it } from 'vitest'
import { reviewPrompt } from '../ai/context'
import { choraoTemplate } from '../programacao/chorao'
import { applyReadiness, isLow, readinessScore } from './readiness'
import { buildSession } from './session'

const program = { ...choraoTemplate(0).program, id: 1 }
const fresh = () => buildSession(program, 1, 'SEG', [], () => false, 0)

describe('check-in de prontidão', () => {
  it('média 1–5 com a fadiga invertida', () => {
    expect(readinessScore({ sleep: 4, energy: 4, soreness: 1 })).toBe(4.3)
    expect(readinessScore({ sleep: 2, energy: 2, soreness: 4 })).toBe(2)
    expect(isLow({ sleep: 3, energy: 2, soreness: 4 })).toBe(true) // 2,3
    expect(isLow({ sleep: 3, energy: 3, soreness: 3 })).toBe(false) // 3
  })

  it('prontidão baixa reduz 5% da carga sugerida e das séries ainda não feitas', () => {
    const s = applyReadiness(fresh(), { sleep: 2, energy: 2, soreness: 4 })
    const snatch = s.exercises[0]
    expect(snatch.suggestion.weight).toBe(38) // 40 × 0,95 arredondado a 0,5
    expect(snatch.suggestion.beforeReadiness).toBe(40)
    expect(snatch.suggestion.reason).toMatch(/Prontidão baixa hoje: carga 5% menor/)
    expect(snatch.log.map((l) => l.weight)).toEqual([38, 38, 38, 38, 38])
    expect(s.exercises[2].suggestion.weight).toBe(76) // stiff 80
  })

  it('refazer o check-in desfaz o ajuste e não acumula', () => {
    const s = fresh()
    s.exercises[0].log[0] = { weight: 40, reps: 2, rpe: 8, done: true }
    applyReadiness(s, { sleep: 1, energy: 1, soreness: 5 })
    applyReadiness(s, { sleep: 1, energy: 2, soreness: 5 })
    expect(s.exercises[0].suggestion.weight).toBe(38)
    applyReadiness(s, { sleep: 5, energy: 5, soreness: 1 })
    expect(s.exercises[0].suggestion.weight).toBe(40)
    expect(s.exercises[0].suggestion.beforeReadiness).toBeUndefined()
    expect(s.exercises[0].suggestion.reason).not.toMatch(/Prontidão/)
    // série já feita não muda
    expect(s.exercises[0].log.map((l) => l.weight)).toEqual([40, 40, 40, 40, 40])
    expect(s.readiness).toEqual({ sleep: 5, energy: 5, soreness: 1 })
  })

  it('sem carga sugerida (exercício sem histórico nem carga inicial), nada muda', () => {
    const s = applyReadiness(fresh(), { sleep: 1, energy: 1, soreness: 5 })
    const gemeos = buildSession(program, 1, 'QUI', [], () => false, 0).exercises.at(-1)!
    expect(gemeos.suggestion.weight).toBeNull()
    expect(s.exercises.every((e) => e.suggestion.weight === null || e.suggestion.weight > 0)).toBe(true)
  })

  it('a revisão por IA recebe a prontidão e as observações da sessão', () => {
    const s = applyReadiness({ ...fresh(), status: 'done', startedAt: 1_000, notes: 'Dor leve no ombro' }, { sleep: 2, energy: 2, soreness: 4 })
    const prompt = reviewPrompt(program, [s], (id) => id, [], 2_000)
    expect(prompt).toMatch(/Prontidão: sono 2\/5, energia 2\/5, fadiga 4\/5 \(prontidão 2\/5\) — baixa/)
    expect(prompt).toMatch(/Observações do aluno: Dor leve no ombro/)
  })
})
