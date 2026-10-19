import { useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MUSCLE_GROUP_PT, type MuscleGroup } from '../data/curated'
import { fmtKg } from '../programacao/progression/common'
import { fmtDay, type LoadPoint, type TonnagePoint } from '../domain/stats'

// Tokens (iguais ao index.css). Marcas usam --color-chart; texto nunca usa a cor da série.
const C = {
  mark: 'var(--color-chart)',
  surface: 'var(--color-surface)',
  grid: 'var(--color-line)',
  muted: 'var(--color-muted)',
  ink: 'var(--color-ink)',
}
const AXIS_TICK = { fill: C.muted, fontSize: 11 }

function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg shadow-black/40">{children}</div>
  )
}

/** Alterna entre o gráfico e a tabela equivalente (acessibilidade: o tooltip nunca é o único caminho). */
export function ChartOrTable({ chart, table }: { chart: ReactNode; table: ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <div>
      {asTable ? table : chart}
      <button onClick={() => setAsTable((v) => !v)} className="mt-1 text-xs text-muted underline-offset-2 hover:underline">
        {asTable ? 'Ver gráfico' : 'Ver tabela'}
      </button>
    </div>
  )
}

/** Carga de trabalho por sessão. Em peso corporal (carga 0), plota repetições totais. */
export function LoadChart({ points }: { points: LoadPoint[] }) {
  const bodyweight = points.every((p) => p.weight === 0)
  const data = points.map((p, i) => ({ ...p, i, label: fmtDay(p.date), y: bodyweight ? p.totalReps : p.weight }))
  const last = data[data.length - 1]
  const ys = data.map((d) => d.y)
  const pad = bodyweight ? 2 : 5
  const domain = [Math.max(0, Math.floor((Math.min(...ys) - pad) / pad) * pad), Math.ceil((Math.max(...ys) + pad) / pad) * pad]
  const fmtY = (v: number) => (bodyweight ? `${v}` : `${v.toLocaleString('pt-BR')}`)

  return (
    <ChartOrTable
      chart={
        <figure aria-label={bodyweight ? 'Repetições totais por sessão' : 'Carga de trabalho por sessão'}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 16, right: 44, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                tickMargin={8}
                axisLine={{ stroke: C.grid }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={domain}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={fmtY}
                allowDecimals={!bodyweight}
              />
              <Tooltip
                cursor={{ stroke: C.muted, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox>
                      <p className="text-muted">{new Date(p.date).toLocaleDateString('pt-BR')}</p>
                      <p className="font-semibold text-ink">
                        {bodyweight ? `${p.totalReps} reps` : fmtKg(p.weight)} <span className="font-normal text-muted">× {p.reps}</span>
                      </p>
                      {!bodyweight && <p className="text-muted">1RM estimado: {fmtKg(p.e1rm)}</p>}
                      {!bodyweight && <p className="text-muted">Volume: {fmtTon(p.volumeKg)}</p>}
                    </TooltipBox>
                  )
                }}
              />
              <Line
                type="linear" /* sessões discretas: sem curva que invente valores entre pontos */
                dataKey="y"
                stroke={C.mark}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={false}
                dot={{ r: 4, fill: C.mark, stroke: C.surface, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: C.mark, stroke: C.surface, strokeWidth: 2 }}
              >
                {/* rótulo só no último ponto */}
                <LabelList
                  dataKey="y"
                  content={({ x, y, index }) =>
                    index === last.i ? (
                      <text x={Number(x) + 8} y={Number(y) + 4} fill={C.ink} fontSize={12} fontWeight={600}>
                        {bodyweight ? `${last.y}` : fmtKg(last.y)}
                      </text>
                    ) : null
                  }
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </figure>
      }
      table={
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">Data</th>
              <th className="py-1 font-normal">{bodyweight ? 'Reps totais' : 'Carga'}</th>
              <th className="py-1 font-normal">Séries</th>
              {!bodyweight && <th className="py-1 font-normal">1RM est.</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...points].reverse().map((p) => (
              <tr key={p.date}>
                <td className="py-1.5">{fmtDay(p.date)}</td>
                <td>{bodyweight ? p.totalReps : fmtKg(p.weight)}</td>
                <td>{p.reps}</td>
                {!bodyweight && <td>{fmtKg(p.e1rm)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}

export const fmtTon = (kg: number) => `${Math.round(kg).toLocaleString('pt-BR')} kg`

/** Volume levantado (peso × reps) por semana: colunas, uma cor. */
export function TonnageChart({ points }: { points: TonnagePoint[] }) {
  const data = points.map((p) => ({ ...p, label: fmtDay(p.week) }))
  return (
    <ChartOrTable
      chart={
        <figure aria-label="Volume levantado por semana">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="28%">
              <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} tickMargin={8} axisLine={{ stroke: C.grid }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
                tickFormatter={(v: number) => v.toLocaleString('pt-BR')}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-2)' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox>
                      <p className="text-muted">Semana de {fmtDay(p.week)}</p>
                      <p className="font-semibold text-ink">{fmtTon(p.kg)}</p>
                      <p className="text-muted">
                        {p.sessions} {p.sessions === 1 ? 'treino' : 'treinos'}
                      </p>
                    </TooltipBox>
                  )
                }}
              />
              {/* sem rótulo na barra: o valor da semana atual já está no card acima do gráfico */}
              <Bar dataKey="kg" fill={C.mark} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </figure>
      }
      table={
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">Semana</th>
              <th className="py-1 font-normal">Treinos</th>
              <th className="py-1 text-right font-normal">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...points].reverse().map((p) => (
              <tr key={p.week}>
                <td className="py-1.5">{fmtDay(p.week)}</td>
                <td>{p.sessions}</td>
                <td className="text-right">{fmtTon(p.kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}

/** Carga de trabalho por semana do ciclo: atual (cor do gráfico) × mesma semana do ciclo anterior (cinza). */
export function CycleWeeksChart({ data, cycle }: { data: { week: string; kg: number | null; prev: number | null }[]; cycle: number }) {
  const hasPrev = data.some((d) => d.prev)
  const rows = data.map((d) => ({ ...d, kg: d.kg ?? 0, prev: d.prev ?? 0 }))
  return (
    <ChartOrTable
      chart={
        <figure aria-label="Carga por semana do ciclo">
          {hasPrev && (
            <figcaption className="mb-1 flex gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm" style={{ background: C.mark }} /> Ciclo {cycle}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm" style={{ background: C.muted }} /> Ciclo anterior
              </span>
            </figcaption>
          )}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 0, left: -8 }} barGap={2} barCategoryGap="24%">
              <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="week" tick={AXIS_TICK} tickLine={false} tickMargin={8} axisLine={{ stroke: C.grid }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => v.toLocaleString('pt-BR')} />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-2)' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox>
                      <p className="text-muted">{p.week}</p>
                      <p className="font-semibold text-ink">{p.kg ? fmtKg(p.kg) : 'sem registro'}</p>
                      {hasPrev && <p className="text-muted">Ciclo anterior: {p.prev ? fmtKg(p.prev) : '—'}</p>}
                    </TooltipBox>
                  )
                }}
              />
              {hasPrev && <Bar dataKey="prev" fill={C.muted} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />}
              <Bar dataKey="kg" fill={C.mark} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
                <LabelList
                  dataKey="kg"
                  content={({ x, y, width, value }) =>
                    Number(value) > 0 ? (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) - 5} fill={C.ink} fontSize={11} textAnchor="middle">
                        {Number(value).toLocaleString('pt-BR')}
                      </text>
                    ) : null
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </figure>
      }
      table={
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">Semana</th>
              <th className="py-1 font-normal">Ciclo {cycle}</th>
              {hasPrev && <th className="py-1 font-normal">Anterior</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((d) => (
              <tr key={d.week}>
                <td className="py-1.5">{d.week}</td>
                <td>{d.kg ? fmtKg(d.kg) : '—'}</td>
                {hasPrev && <td>{d.prev ? fmtKg(d.prev) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}

/** Maior carga do exercício em cada ciclo (uma série: sem legenda; o título nomeia). */
export function CycleHistoryChart({ data }: { data: { label: string; kg: number }[] }) {
  const last = data.length - 1
  return (
    <ChartOrTable
      chart={
        <figure aria-label="Maior carga por ciclo">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 16, right: 44, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} tickMargin={8} axisLine={{ stroke: C.grid }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toLocaleString('pt-BR')} />
              <Tooltip
                cursor={{ stroke: C.muted, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox>
                      <p className="text-muted">{p.label.replace('C', 'Ciclo ')}</p>
                      <p className="font-semibold text-ink">{fmtKg(p.kg)}</p>
                    </TooltipBox>
                  )
                }}
              />
              <Line
                type="linear"
                dataKey="kg"
                stroke={C.mark}
                strokeWidth={2}
                isAnimationActive={false}
                dot={{ r: 4, fill: C.mark, stroke: C.surface, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: C.mark, stroke: C.surface, strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="kg"
                  content={({ x, y, index }) =>
                    index === last ? (
                      <text x={Number(x) + 8} y={Number(y) + 4} fill={C.ink} fontSize={12} fontWeight={600}>
                        {fmtKg(data[last].kg)}
                      </text>
                    ) : null
                  }
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </figure>
      }
      table={
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">Ciclo</th>
              <th className="py-1 text-right font-normal">Maior carga</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-1.5">{d.label.replace('C', 'Ciclo ')}</td>
                <td className="text-right">{fmtKg(d.kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}

/** Séries concluídas por grupo muscular na semana (barras horizontais, uma cor). */
export function WeeklyVolumeChart({ data }: { data: { group: MuscleGroup; sets: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: MUSCLE_GROUP_PT[d.group] }))
  const height = rows.length * 34 + 16
  return (
    <ChartOrTable
      chart={
        <figure aria-label="Séries por grupo muscular na semana">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }} barCategoryGap={8}>
              {/* sem grade: cada barra já tem o valor na ponta */}
              <XAxis type="number" hide domain={[0, (max: number) => Math.max(10, max)]} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...AXIS_TICK, fill: C.ink }} tickLine={false} axisLine={false} width={96} />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-2)' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload
                  if (!p) return null
                  return (
                    <TooltipBox>
                      <p className="font-semibold text-ink">{p.label}</p>
                      <p className="text-muted">
                        {p.sets} {p.sets === 1 ? 'série' : 'séries'} concluídas
                      </p>
                    </TooltipBox>
                  )
                }}
              />
              <Bar dataKey="sets" fill={C.mark} barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false} minPointSize={2}>
                {/* rótulo sempre visível, inclusive 0 (barra vazia não pode parecer dado faltando) */}
                <LabelList
                  dataKey="sets"
                  content={({ x, y, width, height, value }) => (
                    <text
                      x={Number(x) + Number(width) + 6}
                      y={Number(y) + Number(height) / 2 + 4}
                      fill={Number(value) ? C.ink : C.muted}
                      fontSize={12}
                    >
                      {value}
                    </text>
                  )}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </figure>
      }
      table={
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">Grupo</th>
              <th className="py-1 text-right font-normal">Séries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.group}>
                <td className="py-1.5">{r.label}</td>
                <td className="text-right">{r.sets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}
