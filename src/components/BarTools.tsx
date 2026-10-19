import { useState, type ReactNode } from 'react'
import { BARS, RPE_GUIDE, percentTable, platesPerSide, warmupRamp } from '../domain/ferramentas'

const kgFmt = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
const parse = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 0
}

function KgInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="display h-11 w-24 rounded-lg border border-line bg-bg text-center text-base font-semibold outline-none focus:border-accent"
      />
    </label>
  )
}

function BarSelect({ value, onChange }: { value: number; onChange: (kg: number) => void }) {
  return (
    <div className="flex rounded-lg border border-line bg-bg p-0.5 text-xs" role="radiogroup" aria-label="Barra">
      {BARS.map((b) => (
        <button
          key={b.kg}
          role="radio"
          aria-checked={value === b.kg}
          onClick={() => onChange(b.kg)}
          className={`rounded-md px-2 py-1.5 ${value === b.kg ? 'bg-surface-2 font-semibold text-ink' : 'text-muted'}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <table className="mt-2 w-full text-sm tabular-nums">
    <thead className="text-left text-xs text-muted">
      <tr>
        {head.map((h) => (
          <th key={h} className="py-1 font-normal">
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody className="divide-y divide-line">{children}</tbody>
  </table>
)

/** Anilhas por lado para a carga-alvo (barra de 20 ou 15 kg). */
export function PlateCalculator({ initialKg, bar: initialBar = 20 }: { initialKg?: number | null; bar?: number }) {
  const [kg, setKg] = useState(initialKg ? String(initialKg).replace('.', ',') : '100')
  const [bar, setBar] = useState(initialBar)
  const r = platesPerSide(parse(kg), bar)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <KgInput label="Carga total" value={kg} onChange={setKg} />
        <BarSelect value={bar} onChange={setBar} />
      </div>
      {r.onlyBar ? (
        <p className="mt-3 text-sm text-muted">Só a barra ({kgFmt(bar)}), sem anilhas.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted">Em cada lado ({kgFmt(r.perSide)}):</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {r.plates.map((p) => (
              <li key={p.plate} className="display rounded-lg border-2 border-accent bg-bg px-3 py-1.5 font-semibold">
                {p.count}× {kgFmt(p.plate)}
              </li>
            ))}
          </ul>
          {r.leftoverKg > 0 && (
            <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              Sobram {kgFmt(r.leftoverKg)} que não fecham com anilhas de até 1,25 kg: na barra ficam {kgFmt(r.loadedKg)}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Rampa de aquecimento LPO até a carga de trabalho. */
export function WarmupRamp({ initialKg, bar: initialBar = 20 }: { initialKg?: number | null; bar?: number }) {
  const [kg, setKg] = useState(initialKg ? String(initialKg).replace('.', ',') : '100')
  const [bar, setBar] = useState(initialBar)
  const steps = warmupRamp(parse(kg), bar)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <KgInput label="Carga de trabalho" value={kg} onChange={setKg} />
        <BarSelect value={bar} onChange={setBar} />
      </div>
      <Table head={['Série', 'Intensidade', 'Carga', 'Reps']}>
        {steps.map((s, i) => (
          <tr key={s.label}>
            <td className="py-1.5">{s.label === 'Alvo' ? 'Trabalho' : i + 1}</td>
            <td className="text-muted">{s.pct === null ? 'barra' : `${s.pct}%`}</td>
            <td className="font-semibold">{kgFmt(s.kg)}</td>
            <td className="text-muted">{s.reps}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-1 text-[11px] text-muted">Cargas arredondadas para múltiplos de 2,5 kg (montáveis com anilhas de 1,25 por lado).</p>
    </div>
  )
}

/** Tabela de % do 1RM (50–95%) com reps sugeridas. */
export function PercentTable({ initialRm, hint }: { initialRm?: number | null; hint?: string }) {
  const [rm, setRm] = useState(initialRm ? String(initialRm).replace('.', ',') : '100')
  return (
    <div>
      <KgInput label="Seu 1RM" value={rm} onChange={setRm} />
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      <Table head={['% 1RM', 'Carga', 'Reps sugeridas']}>
        {percentTable(parse(rm)).map((r) => (
          <tr key={r.pct}>
            <td className="py-1.5 font-semibold text-accent">{r.pct}%</td>
            <td className="font-semibold">{kgFmt(r.kg)}</td>
            <td className="text-muted">{r.reps}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

/** Guia RPE ↔ RIR (reps em reserva). */
export function RpeGuideTable() {
  return (
    <Table head={['RPE', 'RIR', 'Como foi a série']}>
      {RPE_GUIDE.map(([rpe, rir, desc]) => (
        <tr key={rpe}>
          <td className="py-1.5 pr-2 font-semibold">{rpe}</td>
          <td className="pr-2 text-muted">{rir}</td>
          <td className="text-ink/85">{desc}</td>
        </tr>
      ))}
    </Table>
  )
}
