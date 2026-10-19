import { META, db } from '../db'
import { CURATED_BY_ID } from './curated'
import { LPO_EXERCISES } from './lpo'
import type { Exercise, RawExercise } from './types'

export const DATASET_CDN = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main'
export const DATASET_URL = `${DATASET_CDN}/data/exercises.json`
export const MEDIA_ATTRIBUTION = '© Gym visual — https://gymvisual.com/'

/** Sobe quando o formato de Exercise mudar, forçando novo download. */
const CATALOG_FORMAT = 1
const CATALOG_META_KEY = META.catalog
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000

interface CatalogMeta {
  format: number
  fetchedAt: number
  count: number
}

export const mediaUrl = (path: string) => `${DATASET_CDN}/${path}`

/** Alguns nomes vêm com "°" corrompido ("45в°"). */
const fixName = (name: string) => name.replace(/в°/g, '°')

export function slimExercise(raw: RawExercise): Exercise {
  return {
    id: raw.id,
    name: fixName(raw.name),
    namePt: CURATED_BY_ID.get(raw.id)?.pt,
    bodyPart: raw.body_part,
    equipment: raw.equipment,
    target: raw.target,
    muscleGroup: raw.muscle_group,
    secondary: raw.secondary_muscles,
    image: raw.image,
    gif: raw.gif_url,
    steps: { es: raw.instruction_steps.es ?? [], en: raw.instruction_steps.en ?? [] },
    attribution: raw.attribution,
  }
}

export const displayName = (e: Pick<Exercise, 'name' | 'namePt'>) => e.namePt ?? e.name

async function download(): Promise<Exercise[]> {
  const res = await fetch(DATASET_URL)
  if (!res.ok) throw new Error(`Falha ao baixar exercícios (HTTP ${res.status})`)
  const raw = (await res.json()) as RawExercise[]
  return raw.map(slimExercise)
}

/** Exercícios próprios do app sempre presentes (os criados pelo usuário/importação ficam na tabela). */
const ensureCustom = () => db.exercises.bulkPut([...LPO_EXERCISES])

async function store(list: Exercise[]) {
  await db.transaction('rw', db.exercises, db.meta, async () => {
    // a atualização do dataset não pode levar junto os exercícios criados no app
    const custom = await db.exercises.filter((e) => e.source === 'custom').toArray()
    await db.exercises.clear()
    await db.exercises.bulkPut([...list, ...custom])
    await ensureCustom()
    const meta: CatalogMeta = { format: CATALOG_FORMAT, fetchedAt: Date.now(), count: list.length }
    await db.meta.put({ key: CATALOG_META_KEY, value: meta })
  })
}

/**
 * Garante o catálogo no IndexedDB. Primeiro acesso: baixa (~1,5 MB comprimido).
 * Depois: usa o local e atualiza em segundo plano se estiver velho.
 */
export async function ensureCatalog(): Promise<{ count: number; source: 'local' | 'network' }> {
  const meta = (await db.meta.get(CATALOG_META_KEY))?.value as CatalogMeta | undefined
  const usable = meta && meta.format === CATALOG_FORMAT && meta.count > 0
  if (usable) {
    await ensureCustom()
    if (Date.now() - meta.fetchedAt > REFRESH_AFTER_MS && navigator.onLine) {
      download().then(store).catch(() => {})
    }
    return { count: meta.count, source: 'local' }
  }
  const list = await download()
  await store(list)
  return { count: list.length, source: 'network' }
}
