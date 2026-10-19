import { describe, expect, it } from 'vitest'
import { choraoTemplate } from '../programacao/chorao'
import type { SessionV2 } from '../programacao/types'
import { buildGrid, logFromCell } from './ciclo'
import { gridDayText, sessionText } from './resumo'
import { buildSession } from './session'

const program = { ...choraoTemplate(0).program, id: 3 }

function seg(weekIndex: number, cells: Parameters<typeof logFromCell>[0][], extra: Partial<SessionV2> = {}): SessionV2 {
  const s = buildSession(program, weekIndex, 'SEG', [], () => false, weekIndex * 1000)
  s.id = weekIndex
  s.status = 'done'
  s.exercises.forEach((e, i) => (e.log = cells[i] ? logFromCell(cells[i]) : []))
  return { ...s, ...extra }
}

describe('resumo em texto', () => {
  const sessions = [
    seg(1, [{ sets: 5, reps: 2, kg: 40, rpe: 7 }], { readiness: { sleep: 4, energy: 4, soreness: 1 }, notes: 'Sapatilha de LPO' }),
    seg(2, [{ sets: 5, reps: 2, kg: 42.5, rpe: null }]),
  ]
  sessions[1].exercises[0].variant = 'Snatch bloco'
  const grid = buildGrid(program, sessions)

  it('dia da grade no formato do Chorão', () => {
    const t = gridDayText(grid, grid.days[0], (id) => (id === 'lpo-snatch-suspenso' ? 'Snatch suspenso' : id), sessions)
    const lines = t.split('\n')
    expect(lines[0]).toBe('=== SEGUNDA — SNATCH SUSPENSO & INFERIORES · CICLO 1 ===')
    expect(t).toContain('Plano: LPO + perna.')
    expect(t).toContain('S1 prontidão: sono 4/5, energia 4/5, fadiga 1/5 (prontidão 4,3/5)')
    expect(t).toContain('S1 obs: Sapatilha de LPO')
    expect(t).toContain('1. Snatch suspenso (principal)\n   S1: 5s x 2r @ 40kg [RPE 7] -> Ton: 400kg\n   S2: (Snatch bloco) 5s x 2r @ 42,5kg -> Ton: 425kg\n   S3: ---')
    expect(t).toContain('Tonelagem do dia: S1 400kg · S2 425kg · S3 0kg · S4 0kg')
  })

  it('sessão concluída', () => {
    const t = sessionText({ ...sessions[1], startedAt: Date.UTC(2026, 9, 19, 12), finishedAt: Date.UTC(2026, 9, 19, 13), durationSec: 3600 }, () => 'Snatch')
    expect(t).toContain('semana 2 · 60 min · volume 425kg')
    expect(t).toContain('1. Snatch (Snatch bloco): 42,5×2 · 42,5×2 · 42,5×2 · 42,5×2 · 42,5×2')
    expect(t).toContain('2. Snatch: não feito')
  })
})
