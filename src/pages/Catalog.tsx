import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { Chip, Icon, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { MUSCLE_GROUP_PT } from '../data/curated'
import { curatedInfo } from '../data/lpo'
import { BODY_PART_PT, equipmentPt, musclePt } from '../data/i18n'
import { EMPTY_FILTER, filterCatalog, type CatalogFilter } from '../data/search'
import { BODY_PARTS } from '../data/types'
import { useExercises } from '../lib/useCatalog'

const PAGE = 40

const groupOf = (id: string) => {
  const c = curatedInfo(id)
  return c && MUSCLE_GROUP_PT[c.group]
}

export default function Catalog() {
  const all = useExercises()
  const [f, setF] = useState<CatalogFilter>(EMPTY_FILTER)
  const [limit, setLimit] = useState(PAGE)

  const equipments = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of all ?? []) counts.set(e.equipment, (counts.get(e.equipment) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [all])

  const results = useMemo(() => (all ? filterCatalog(all, f) : []), [all, f])
  const update = (patch: Partial<CatalogFilter>) => {
    setF((prev) => ({ ...prev, ...patch }))
    setLimit(PAGE)
  }

  const select = 'h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm'

  return (
    <Screen title="Exercícios">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
        <Icon name="search" className="size-4 text-muted" />
        <input
          value={f.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="Buscar (ex.: supino, rosca, lateral raise)"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <select value={f.bodyPart} onChange={(e) => update({ bodyPart: e.target.value })} className={select}>
          <option value="">Todos os grupos</option>
          {BODY_PARTS.map((b) => (
            <option key={b} value={b}>
              {BODY_PART_PT[b]}
            </option>
          ))}
        </select>
        <select value={f.equipment} onChange={(e) => update({ equipment: e.target.value })} className={select}>
          <option value="">Todo equipamento</option>
          {equipments.map((eq) => (
            <option key={eq} value={eq}>
              {equipmentPt(eq)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="flex rounded-xl border border-line bg-surface p-0.5">
          {[
            [true, 'Principais'],
            [false, 'Todos'],
          ].map(([val, label]) => (
            <button
              key={String(val)}
              onClick={() => update({ onlyCurated: val as boolean })}
              className={`rounded-lg px-3 py-1.5 ${f.onlyCurated === val ? 'bg-surface-2 text-ink' : 'text-muted'}`}
            >
              {label as string}
            </button>
          ))}
        </div>
        <span className="text-muted">{all ? `${results.length} exercícios` : 'Carregando…'}</span>
      </div>

      <ul className="mt-3 divide-y divide-line">
        {results.slice(0, limit).map((e) => (
          <li key={e.id}>
            <Link to={`/exercicio/${e.id}`} className="flex items-center gap-3 py-2.5">
              <ExerciseThumb exercise={e} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{displayName(e)}</p>
                {e.namePt && <p className="truncate text-xs text-muted">{e.name}</p>}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Chip>{groupOf(e.id) ?? musclePt(e.target)}</Chip>
                  <Chip>{equipmentPt(e.equipment)}</Chip>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {results.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="mt-3 w-full rounded-xl border border-line py-3 text-sm text-muted hover:bg-surface"
        >
          Mostrar mais ({results.length - limit} restantes)
        </button>
      )}
      {all && results.length === 0 && (
        <p className="mt-8 text-center text-muted">
          Nada encontrado.{' '}
          {f.onlyCurated && (
            <button className="text-accent underline" onClick={() => update({ onlyCurated: false })}>
              Buscar em todos os {all.length}
            </button>
          )}
        </p>
      )}
    </Screen>
  )
}
