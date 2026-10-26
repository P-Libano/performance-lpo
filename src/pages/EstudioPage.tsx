import { useMemo, useState, type ReactNode } from 'react'
import { BodyMap } from '../anim/BodyMap'
import { runChecks } from '../anim/checks'
import { EXERCISES } from '../anim/exercises'
import { AnimPlayer } from '../anim/render/AnimPlayer'
import type { ExerciseSpec } from '../anim/spec'
import { STILLS } from '../anim/stills'
import { AnimStills } from '../components/AnimStills'
import { ExerciseGif } from '../components/ExerciseMedia'
import { Chip, Screen } from '../components/ui'
import { useExercise } from '../lib/useCatalog'

/**
 * Estúdio de revisão das animações próprias (só em desenvolvimento). É o portão 3 do processo
 * (docs/animacoes/PROCESSO.md): a pessoa que revisa vê a animação ao lado do GIF do dataset, confere a ficha,
 * as verificações automáticas e os músculos por fase, marca o checklist e copia o registro da revisão para o
 * arquivo do exercício.
 */

/** Checklist humano (mesmo texto do PROCESSO.md). */
const CHECKLIST = [
  'O movimento é reconhecível como o exercício, comparando com o GIF do dataset ao lado',
  'Cada ponto técnico da ficha aparece corretamente',
  'Nenhuma pose ensina um erro (lombar arredondada sob carga, joelho para dentro, cotovelo travado…)',
  'Os músculos de cada fase estão certos e a fonte é aceitável',
  'Ritmo plausível (fases concêntrica e excêntrica com tempos razoáveis)',
  'Aparelho e pegada corretos',
]

const STATUS_TONE: Record<ExerciseSpec['review']['status'], string> = {
  rascunho: 'bg-surface-2 text-muted',
  verificado: 'bg-warn/15 text-warn',
  revisado: 'bg-accent/15 text-accent',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** Poses-chave paradas, lado a lado (o que a folha de contato mostra). */
function KeyPoses({ spec }: { spec: ExerciseSpec }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {spec.frames.map((f, i) => (
        <figure key={i}>
          <AnimPlayer spec={{ ...spec, frames: [{ ...f, moveMs: 150 }, { ...f, moveMs: 150 }] }} still className="aspect-square rounded-lg" />
          <figcaption className="mt-0.5 text-[10px] leading-tight text-muted">
            {i + 1}. {f.name ?? '—'} · {f.phase}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

function Review({ spec }: { spec: ExerciseSpec }) {
  const failures = useMemo(() => runChecks(spec), [spec])
  const reference = useExercise(spec.datasetId)
  const [speed, setSpeed] = useState(1)
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false))
  const [by, setBy] = useState('')
  const [notes, setNotes] = useState('')
  const allChecked = checked.every(Boolean)
  const record = `review: { status: 'revisado', by: '${by.replace(/'/g, '')}', date: '${new Date().toISOString().slice(0, 10)}', notes: '${notes.replace(/'/g, '’')}' },`

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="display text-lg font-bold">{spec.name}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[spec.review.status]}`}>{spec.review.status}</span>
        <span className="text-xs text-muted">dataset {spec.datasetId}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-xs text-muted">Nossa animação</p>
          <AnimPlayer spec={spec} speed={speed} />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">Referência: GIF do dataset</p>
          {reference ? <ExerciseGif exercise={reference} /> : <div className="aspect-square rounded-xl bg-surface-2" />}
        </div>
      </div>
      <div className="mt-2 flex gap-1 text-sm" role="radiogroup" aria-label="Velocidade">
        {[1, 0.5, 0.25].map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={speed === v}
            onClick={() => setSpeed(v)}
            className={`rounded-lg border px-3 py-1 ${speed === v ? 'border-accent bg-accent/10 text-accent' : 'border-line'}`}
          >
            {v.toLocaleString('pt-BR')}×
          </button>
        ))}
      </div>

      <KeyPoses spec={spec} />

      <Section title="Imagens para o app (corpo 3D)">
        {STILLS[spec.id]?.stills.length ? (
          <>
            <AnimStills stills={STILLS[spec.id].stills} alt={spec.name} />
            <p className="mt-1 text-xs text-muted">
              Entram no app quando o exercício for revisado. Para refazer depois de mudar a animação: npm run anim:stills -- {spec.id}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Ainda não geradas: npm run anim:stills -- {spec.id}</p>
        )}
      </Section>

      <Section title={`Verificações automáticas (${failures.length ? `${failures.length} falha${failures.length > 1 ? 's' : ''}` : 'todas ok'})`}>
        {failures.length ? (
          <ul className="space-y-1 text-sm text-danger">
            {failures.map((f, i) => (
              <li key={i}>
                <strong>{f.check}</strong> · {f.where}: {f.message}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {['Ficha completa', 'Alcance, limites articulares, chão e aparelhos (todos os quadros)', ...spec.checks.map((c) => c.name)].map((n) => (
              <li key={n} className="text-accent">
                ✓ <span className="text-ink">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Fases e músculos">
        <div className="space-y-4">
          {spec.phases.map((p) => {
            const m = spec.muscles.find((x) => x.phase === p.name)
            return (
              <div key={p.name} className="rounded-xl border border-line bg-surface p-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted">{p.description}</p>
                {m && <BodyMap primary={m.primary} secondary={m.secondary} className="mt-2" />}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Fonte: {spec.muscleSource}</p>
      </Section>

      <Section title="Pontos técnicos">
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {spec.keyPoints.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </Section>

      <Section title="Revisão técnica (portão 3)">
        <ul className="space-y-1.5">
          {CHECKLIST.map((c, i) => (
            <li key={c}>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => setChecked(checked.map((x, j) => (j === i ? e.target.checked : x)))}
                  className="mt-0.5 size-4 accent-[var(--color-accent)]"
                />
                {c}
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2">
          <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Quem revisou" className="h-10 rounded-lg border border-line bg-bg px-3 text-sm" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (o que ajustar, ou 'ok')" rows={2} className="rounded-lg border border-line bg-bg p-3 text-sm" />
        </div>
        {allChecked && by.trim() && !failures.length ? (
          <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
            <p className="font-medium">Aprovado. Cole no arquivo do exercício (src/anim/exercises/…):</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-2 text-xs">{record}</pre>
            <button onClick={() => navigator.clipboard?.writeText(record)} className="mt-2 rounded-lg border border-line px-3 py-1 text-xs">
              Copiar
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Para aprovar: verificações automáticas sem falhas, todos os itens marcados e o nome de quem revisou.
          </p>
        )}
      </Section>
    </div>
  )
}

export default function EstudioPage() {
  const [sel, setSel] = useState(EXERCISES[0]?.id)
  const spec = EXERCISES.find((e) => e.id === sel)
  return (
    <Screen title="Estúdio de animações" back>
      <p className="text-sm text-muted">Revisão das animações próprias (docs/animacoes/PROCESSO.md). Só aparece em desenvolvimento.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXERCISES.map((e) => (
          <button key={e.id} onClick={() => setSel(e.id)} className={`rounded-xl border px-3 py-1.5 text-sm ${e.id === sel ? 'border-accent bg-accent/10' : 'border-line'}`}>
            {e.name} <Chip>{e.review.status}</Chip>
          </button>
        ))}
      </div>
      <div className="mt-4">{spec && <Review key={spec.id} spec={spec} />}</div>
    </Screen>
  )
}
