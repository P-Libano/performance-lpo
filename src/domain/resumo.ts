import type { SessionV2 } from '../programacao/types'
import { tonnage, type Grid, type GridDay } from './ciclo'
import { readinessText } from './readiness'
import { sessionSummary } from './session'

/** Resumos em texto puro para colar no WhatsApp/notas (porte do "Copiar" do Chorão). */

const n = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Um dia da grade: cada exercício com S1–S4 no formato do Chorão, mais prontidão e observações das semanas. */
export function gridDayText(grid: Grid, day: GridDay, nameOf: (id: string) => string, sessions: SessionV2[] = []): string {
  const lines = [`=== ${day.name.toUpperCase()} · CICLO ${grid.cycle} ===`]
  if (day.notes) lines.push(`Plano: ${day.notes}`)
  const daySessions = sessions.filter((s) => (s.cycle ?? 1) === grid.cycle && s.dayKey === day.key).sort((a, b) => a.weekIndex - b.weekIndex)
  for (const s of daySessions) {
    const w = grid.weekIndices.indexOf(s.weekIndex) + 1
    if (s.readiness) lines.push(`S${w} prontidão: ${readinessText(s.readiness)}`)
    if (s.notes?.trim()) lines.push(`S${w} obs: ${s.notes.trim()}`)
  }
  lines.push('')
  day.rows.forEach((r, i) => {
    lines.push(`${i + 1}. ${nameOf(r.exerciseId)}${r.role === 'principal' ? ' (principal)' : ''}`)
    r.cells.forEach((c, wi) => {
      if (c.sets === null && c.kg === null && c.reps === null) {
        lines.push(`   S${wi + 1}: ---`)
        return
      }
      const variant = c.variant ? `(${c.variant}) ` : ''
      const rpe = c.rpe !== null ? ` [RPE ${n(c.rpe)}]` : ''
      lines.push(`   S${wi + 1}: ${variant}${c.sets ?? 0}s x ${c.reps ?? 0}r @ ${n(c.kg ?? 0)}kg${rpe} -> Ton: ${n(c.uniform ? tonnage(c.sets, c.reps, c.kg) : c.tonnage)}kg`)
    })
    lines.push('')
  })
  lines.push(`Tonelagem do dia: ${day.tonnage.map((t, i) => `S${i + 1} ${n(t)}kg`).join(' · ')}`)
  return lines.join('\n')
}

/** Uma sessão concluída: séries feitas por exercício, volume e duração. */
export function sessionText(s: SessionV2, nameOf: (id: string) => string): string {
  const sum = sessionSummary(s)
  const date = new Date(s.startedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const lines = [`=== ${s.dayName.toUpperCase()} ===`, `${date} · semana ${s.weekIndex} · ${sum.durationMin} min · volume ${n(Math.round(sum.volumeKg))}kg`]
  if (s.readiness) lines.push(`Prontidão: ${readinessText(s.readiness)}`)
  if (s.notes?.trim()) lines.push(`Obs: ${s.notes.trim()}`)
  lines.push('')
  s.exercises.forEach((e, i) => {
    const done = e.log.filter((l) => l.done)
    const sets = done.length
      ? done.map((l) => `${l.weight ? `${n(l.weight)}×` : ''}${l.reps ?? '—'}${l.rpe !== null ? `@${n(l.rpe)}` : ''}`).join(' · ')
      : 'não feito'
    lines.push(`${i + 1}. ${nameOf(e.exerciseId)}${e.variant ? ` (${e.variant})` : ''}: ${sets}`)
  })
  return lines.join('\n')
}

/** Copia para a área de transferência (API moderna; cai no execCommand em navegadores antigos). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
