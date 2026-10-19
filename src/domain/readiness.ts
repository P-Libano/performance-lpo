import { roundToHalf } from '../programacao/progression/common'
import type { Readiness, SessionV2 } from '../programacao/types'

/**
 * Check-in de prontidão (porte do Chorão): sono, energia e fadiga de 1 a 5.
 * Com prontidão baixa, a carga sugerida do dia cai 5% (reversível: refazer o check-in desfaz).
 */

export const DEFAULT_READINESS: Readiness = { sleep: 4, energy: 4, soreness: 1 }

/** Média 1–5 (fadiga invertida: 5 = muito dolorido conta como 1). */
export const readinessScore = (r: Readiness) => Math.round(((r.sleep + r.energy + (6 - r.soreness)) / 3) * 10) / 10

export const LOW_READINESS = 2.5
export const READINESS_CUT = 0.05

export const isLow = (r: Readiness | undefined) => !!r && readinessScore(r) <= LOW_READINESS

export const READINESS_LABELS = {
  sleep: ['Péssimo', 'Ruim', 'Médio', 'Bom', 'Excelente'],
  energy: ['Esgotado', 'Baixa', 'Média', 'Boa', 'Alta'],
  soreness: ['Fresco', 'Leve', 'Moderada', 'Alta', 'Muito dolorido'],
} as const

const NOTE = 'Prontidão baixa hoje: carga 5% menor.'

/**
 * Grava o check-in e ajusta a sugestão de carga dos exercícios. Idempotente: guarda a carga original
 * em `beforeReadiness` e volta a ela quando a prontidão não é baixa. Séries ainda não feitas com a
 * carga sugerida acompanham o ajuste; séries já feitas ou editadas ficam como estão.
 */
export function applyReadiness(s: SessionV2, r: Readiness): SessionV2 {
  const low = isLow(r)
  for (const e of s.exercises) {
    const sug = e.suggestion
    const base = sug.beforeReadiness ?? sug.weight
    if (base === null || base === undefined || base <= 0) continue
    const target = low ? roundToHalf(base * (1 - READINESS_CUT)) : base
    const shown = sug.weight
    for (const l of e.log) if (!l.done && l.weight === shown) l.weight = target
    sug.weight = target
    sug.reason = sug.reason.replace(` ${NOTE}`, '')
    if (low) {
      sug.beforeReadiness = base
      sug.reason = `${sug.reason} ${NOTE}`
    } else delete sug.beforeReadiness
  }
  s.readiness = r
  return s
}

export const readinessText = (r: Readiness) => `sono ${r.sleep}/5, energia ${r.energy}/5, fadiga ${r.soreness}/5 (prontidão ${readinessScore(r).toLocaleString('pt-BR')}/5)`
