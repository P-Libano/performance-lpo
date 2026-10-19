import { useState } from 'react'
import { DEFAULT_READINESS, READINESS_LABELS, isLow, readinessScore } from '../domain/readiness'
import type { Readiness } from '../programacao/types'

const FIELDS: { key: keyof Readiness; label: string; hint: string }[] = [
  { key: 'sleep', label: 'Sono', hint: '5 = excelente' },
  { key: 'energy', label: 'Energia', hint: '5 = alta' },
  { key: 'soreness', label: 'Fadiga', hint: '5 = muito dolorido' },
]

/** Check-in de prontidão do dia (sono, energia, fadiga 1–5). Fechado depois de respondido. */
export function ReadinessCard({ value, onChange, readOnly }: { value: Readiness | undefined; onChange: (r: Readiness) => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(!value && !readOnly)
  const [draft, setDraft] = useState<Readiness>(value ?? DEFAULT_READINESS)
  const r = value ?? draft
  const low = isLow(value)

  return (
    <section className={`mb-3 rounded-xl border px-3 py-2 ${low ? 'border-warn/40 bg-warn/10' : 'border-line bg-surface'}`}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left text-sm">
        <span className="font-medium">Prontidão do dia</span>
        <span className={low ? 'text-warn' : 'text-muted'}>
          {value ? `${readinessScore(value).toLocaleString('pt-BR')}/5${low ? ' · carga −5%' : ''}` : 'responder'} {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <p className="text-xs text-muted">
                {f.label} <span className="opacity-70">({f.hint})</span>
              </p>
              <div className="mt-1 grid grid-cols-5 gap-1" role="radiogroup" aria-label={f.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={r[f.key] === n}
                    disabled={readOnly}
                    title={READINESS_LABELS[f.key][n - 1]}
                    onClick={() => setDraft({ ...r, [f.key]: n })}
                    className={`h-9 rounded-lg border text-sm font-semibold ${
                      r[f.key] === n ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-bg text-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-0.5 text-[11px] text-muted">{READINESS_LABELS[f.key][r[f.key] - 1]}</p>
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
              className="h-10 w-full rounded-lg bg-accent text-sm font-semibold text-accent-ink"
            >
              Salvar check-in · prontidão {readinessScore(draft).toLocaleString('pt-BR')}/5
            </button>
          )}
          <p className="text-[11px] text-muted">Média ≤ 2,5 reduz em 5% a carga sugerida de hoje. Refazer o check-in desfaz o ajuste.</p>
        </div>
      )}
    </section>
  )
}
