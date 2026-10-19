import { kgAtPct } from '../programacao/progression/carga'

/**
 * Ferramentas de barra do Chorão: anilhas por lado, rampa de aquecimento LPO e % do 1RM.
 * Contas em centésimos de kg (inteiros): 1,25 kg não deixa resíduo de ponto flutuante.
 */

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const
export const BARS = [
  { kg: 20, label: '20 kg (masculina)' },
  { kg: 15, label: '15 kg (feminina)' },
] as const

const C = (kg: number) => Math.round(kg * 100)

export interface PlateLoad {
  /** Carga em cada lado (kg) que se queria colocar. */
  perSide: number
  plates: { plate: number; count: number }[]
  /** Carga total que sobra e não fecha com as anilhas disponíveis (0 = exata). */
  leftoverKg: number
  /** Carga que de fato fica na barra. */
  loadedKg: number
  onlyBar: boolean
}

export function platesPerSide(targetKg: number, barKg = 20, plates: readonly number[] = PLATES): PlateLoad {
  const side = Math.floor((C(targetKg) - C(barKg)) / 2)
  if (!Number.isFinite(side) || side <= 0) return { perSide: 0, plates: [], leftoverKg: 0, loadedKg: barKg, onlyBar: true }
  let rest = side
  const out: PlateLoad['plates'] = []
  for (const p of plates) {
    const count = Math.floor(rest / C(p))
    if (count > 0) {
      out.push({ plate: p, count })
      rest -= count * C(p)
    }
  }
  const leftoverKg = (C(targetKg) - C(barKg) - 2 * (side - rest)) / 100
  return { perSide: side / 100, plates: out, leftoverKg, loadedKg: targetKg - leftoverKg, onlyBar: false }
}

export interface RampStep {
  label: string
  pct: number | null
  kg: number
  reps: string
}

/** Arredonda para o múltiplo de 2,5 kg mais próximo (o menor passo com anilhas de 1,25 por lado), nunca abaixo da barra. */
export const loadable = (kg: number, barKg = 20) => Math.max(barKg, Math.round(kg / 2.5) * 2.5)

const RAMP: [number, string][] = [
  [40, '3 reps'],
  [60, '2 reps'],
  [75, '2 reps'],
  [85, '1 rep'],
  [92, '1 rep'],
]

/**
 * Rampa de aquecimento LPO do Chorão: barra, 40, 60, 75, 85 e 92% e o alvo. Diferente do original,
 * usa a barra escolhida, arredonda para carga montável e pula degraus repetidos ou acima do alvo.
 */
export function warmupRamp(targetKg: number, barKg = 20): RampStep[] {
  const steps: RampStep[] = [{ label: 'Barra', pct: null, kg: barKg, reps: '5 reps' }]
  // alvo até o peso da barra: só a barra
  if (!(targetKg > barKg)) return steps
  for (const [pct, reps] of RAMP) {
    const kg = loadable((targetKg * pct) / 100, barKg)
    if (kg <= steps[steps.length - 1].kg || kg >= targetKg) continue
    steps.push({ label: `${pct}%`, pct, kg, reps })
  }
  steps.push({ label: 'Alvo', pct: 100, kg: targetKg, reps: 'séries de trabalho' })
  return steps
}

/** Tabela de % do 1RM do Chorão (50–95%) com reps sugeridas para LPO. */
export const PERCENT_ROWS: [number, string][] = [
  [50, '4–5 reps'],
  [60, '3–4 reps'],
  [70, '3 reps'],
  [75, '3 reps'],
  [80, '2–3 reps'],
  [85, '2 reps'],
  [90, '1–2 reps'],
  [95, '1 rep'],
]

export const percentTable = (oneRmKg: number) => PERCENT_ROWS.map(([pct, reps]) => ({ pct, reps, kg: oneRmKg > 0 ? kgAtPct(oneRmKg, pct) : 0 }))

/** Guia RPE/RIR do Chorão. */
export const RPE_GUIDE: [string, string, string][] = [
  ['10', '0', 'Falha ou esforço máximo absoluto.'],
  ['9,5', '0–1', 'Talvez coubesse mais uma rep, com técnica ruim.'],
  ['9', '1', 'Com certeza faria mais 1 repetição limpa.'],
  ['8,5', '1–2', 'Certamente 1 rep, talvez 2 na reserva.'],
  ['8', '2', 'Pesado mas controlado: sobravam 2.'],
  ['7', '3', 'Barra rápida: sobravam 3.'],
  ['6', '4+', 'Leve a moderado: velocidade e técnica.'],
]
