import { describe, expect, it } from 'vitest'
import { buildSession } from '../domain/session'
import { CHORAO_PLAN, TEMPLATE_NAME, choraoTemplate } from './chorao'
import { allWeeks } from './program'

describe('template LPO + Musculação (plano inicial do Chorão)', () => {
  const { program, unmatched } = choraoTemplate(0)
  const weeks = allWeeks(program)
  const items = weeks[0].days.flatMap((d) => d.groups.flatMap((g) => g.items))

  it('todos os exercícios do plano casam com o catálogo', () => {
    expect(unmatched).toEqual([])
    expect(items).toHaveLength(CHORAO_PLAN.reduce((a, d) => a + d.exercises.length, 0))
  })

  it('4 dias (a quarta livre fica fora) e ciclo de 4 semanas sem deload', () => {
    expect(program.source).toBe('template')
    expect(program.templateName).toBe(TEMPLATE_NAME)
    expect(weeks[0].days.map((d) => d.key)).toEqual(['SEG', 'TER', 'QUI', 'SEX'])
    expect(weeks.map((w) => w.kind)).toEqual(['carga', 'carga', 'carga', 'carga'])
    expect(weeks[0].days[0].name).toBe('Segunda — Snatch Suspenso & Inferiores')
    expect(weeks[0].days[0].notes).toMatch(/Séries de LPO/)
  })

  it('isMain vira papel principal; LPO sem reps ganha 1–3; carga inicial do plano', () => {
    const [snatch, tripla, stiff, frontal] = weeks[0].days[0].groups.map((g) => g.items[0])
    expect(snatch).toMatchObject({ exerciseId: 'lpo-snatch-suspenso', role: 'principal', sets: 5, reps: { min: 1, max: 3 }, startKg: 40 })
    expect(tripla).toMatchObject({ exerciseId: 'lpo-tripla-extensao', role: 'composto', reps: { min: 1, max: 3 }, startKg: 100 })
    expect(stiff).toMatchObject({ exerciseId: '0116', role: 'composto', sets: 3, reps: { min: 8, max: 8 }, startKg: 80 })
    expect(frontal).toMatchObject({ exerciseId: '0042', role: 'principal' })
    const gemeos = weeks[0].days[2].groups.at(-1)!.items[0]
    expect(gemeos.startKg).toBeUndefined()
  })

  it('o principal sobe 2,5 kg (olímpicos não pulam de 5 em 5)', () => {
    expect(program.goal.progression.principal).toMatchObject({ rule: 'carga_por_rpe', increment: { superiorKg: 2.5, inferiorKg: 2.5 } })
  })

  it('a primeira sessão sugere a carga inicial do plano', () => {
    const s = buildSession({ ...program, id: 1 }, 1, 'SEG', [], () => false, 0)
    expect(s.cycle).toBe(1)
    expect(s.exercises[0].suggestion.weight).toBe(40)
    expect(s.exercises[0].suggestion.reason).toMatch(/Carga inicial do plano: 40 kg/)
    expect(s.exercises[0].log.map((l) => l.weight)).toEqual([40, 40, 40, 40, 40])
  })
})
