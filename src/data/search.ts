import { CURATED_BY_ID } from './curated'
import { equipmentPt, musclePt } from './i18n'
import type { Exercise } from './types'

export interface CatalogFilter {
  query: string
  bodyPart: string // '' = todos
  equipment: string // '' = todos
  onlyCurated: boolean
}

export const EMPTY_FILTER: CatalogFilter = { query: '', bodyPart: '', equipment: '', onlyCurated: true }

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function haystack(e: Exercise) {
  return normalize([e.namePt ?? '', e.name, musclePt(e.target), e.target, equipmentPt(e.equipment)].join(' '))
}

/** Filtra e ordena: curados primeiro (por nome pt), depois o resto por nome. */
export function filterCatalog(list: Exercise[], f: CatalogFilter): Exercise[] {
  const terms = normalize(f.query).split(/\s+/).filter(Boolean)
  const out = list.filter((e) => {
    if (f.onlyCurated && !CURATED_BY_ID.has(e.id) && e.source !== 'custom') return false
    if (f.bodyPart && e.bodyPart !== f.bodyPart) return false
    if (f.equipment && e.equipment !== f.equipment) return false
    if (terms.length) {
      const h = haystack(e)
      return terms.every((t) => h.includes(t))
    }
    return true
  })
  return out.sort((a, b) => {
    const ca = a.namePt ? 0 : 1
    const cb = b.namePt ? 0 : 1
    if (ca !== cb) return ca - cb
    return (a.namePt ?? a.name).localeCompare(b.namePt ?? b.name, 'pt-BR')
  })
}
