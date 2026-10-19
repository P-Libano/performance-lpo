import { useState } from 'react'
import { useParams } from 'react-router'
import { ExerciseGif } from '../components/ExerciseMedia'
import { Chip, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { MUSCLE_GROUP_PT } from '../data/curated'
import { curatedInfo } from '../data/lpo'
import { bodyPartPt, equipmentPt, musclePt } from '../data/i18n'
import type { StoredLang } from '../data/types'
import { useExercise } from '../lib/useCatalog'

const LANG_LABEL: Record<StoredLang, string> = { es: 'Espanhol', en: 'Inglês' }

export default function ExerciseDetail() {
  const { id } = useParams()
  const ex = useExercise(id)
  const [lang, setLang] = useState<StoredLang>('es')

  if (ex === undefined) return <Screen title="Exercício" back>Carregando…</Screen>

  const curated = curatedInfo(ex.id)
  const secondary = [...new Set([ex.muscleGroup, ...ex.secondary])].filter((m) => m !== ex.target)
  const steps = ex.stepsPt?.length ? ex.stepsPt : ex.steps[lang]

  return (
    <Screen title={displayName(ex)} back>
      <ExerciseGif exercise={ex} className="mx-auto w-full max-w-[360px]" />

      <div className="mt-4">
        <h2 className="text-xl font-semibold">{displayName(ex)}</h2>
        {ex.namePt && <p className="text-sm text-muted">{ex.name}</p>}
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Primário</dt>
        <dd className="flex flex-wrap gap-1">
          <Chip tone="accent">{musclePt(ex.target)}</Chip>
          {curated && <Chip>{MUSCLE_GROUP_PT[curated.group]}</Chip>}
        </dd>
        <dt className="text-muted">Secundários</dt>
        <dd className="flex flex-wrap gap-1">
          {secondary.length ? secondary.map((m) => <Chip key={m}>{musclePt(m)}</Chip>) : '—'}
        </dd>
        <dt className="text-muted">Equipamento</dt>
        <dd>{equipmentPt(ex.equipment)}</dd>
        <dt className="text-muted">Região</dt>
        <dd>{bodyPartPt(ex.bodyPart)}</dd>
        {curated && (
          <>
            <dt className="text-muted">Tipo</dt>
            <dd>{curated.compound ? 'Composto (multiarticular)' : 'Isolador (monoarticular)'}</dd>
          </>
        )}
      </dl>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Passo a passo</h3>
          <div className={`flex rounded-lg border border-line p-0.5 text-xs ${ex.stepsPt?.length ? 'hidden' : ''}`}>
            {(['es', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-md px-2 py-1 ${lang === l ? 'bg-surface-2' : 'text-muted'}`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        {!ex.stepsPt?.length && <p className="mt-1 text-xs text-muted">O dataset ainda não tem instruções em português.</p>}
        {ex.source === 'custom' && !steps.length && <p className="mt-1 text-xs text-muted">Exercício próprio, sem passo a passo.</p>}
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs text-muted">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </Screen>
  )
}
