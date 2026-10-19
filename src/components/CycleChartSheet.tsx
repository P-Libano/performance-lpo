import { cycleSeries, weekSeries, type GridRow } from '../domain/ciclo'
import type { CycleSnapshot } from '../programacao/types'
import { CycleHistoryChart, CycleWeeksChart } from './charts'
import { Sheet } from './ui'

/** Evolução de carga de um exercício: S1–S4 do ciclo e a maior carga de cada ciclo. Carregado sob demanda (recharts). */
export default function CycleChartSheet({
  row,
  name,
  cycle,
  history,
  onClose,
}: {
  row: GridRow
  name: string
  cycle: number
  history: CycleSnapshot[]
  onClose: () => void
}) {
  const across = cycleSeries(history, row, cycle)
  const weeks = weekSeries(row)
  const empty = weeks.every((w) => !w.kg && !w.prev)
  return (
    <Sheet eyebrow="Evolução de carga" title={name} onClose={onClose}>
      {empty ? (
        <p className="py-6 text-center text-sm text-muted">Registre a carga de alguma semana para ver a evolução.</p>
      ) : (
        <>
          <h3 className="text-sm font-medium text-muted">Carga por semana · ciclo {cycle}</h3>
          <div className="mt-1">
            <CycleWeeksChart data={weeks} cycle={cycle} />
          </div>
        </>
      )}
      <h3 className="mt-5 text-sm font-medium text-muted">Maior carga por ciclo</h3>
      {across.length >= 2 ? (
        <div className="mt-1">
          <CycleHistoryChart data={across} />
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">Aparece depois do primeiro “Novo ciclo” (o app guarda os últimos 24).</p>
      )}
    </Sheet>
  )
}
