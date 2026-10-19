import { CURATED, type MuscleGroup } from './curated'
import { LPO_DEFS } from './lpo'
import { normalize } from './search'

/**
 * Casa um nome livre (ex.: exercício do Chorão, "Supino Reto") com o catálogo:
 * 1) apelidos conhecidos; 2) todas as palavras do nome dentro de um nome curado (o mais curto vence).
 * Sem casamento → null (quem chama cria uma entrada própria).
 */

const STOP = new Set(['com', 'de', 'do', 'da', 'na', 'no', 'em', 'a', 'o', 'e', 'kg', 'por', 'mao', 'maos'])

export const tokens = (s: string) =>
  normalize(s)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))

const key = (s: string) => tokens(s).join(' ')

/** Nome (já sem acento/stopwords) → id. Inclui todos os nomes do Chorão V9.7. */
const ALIASES: Record<string, string> = {
  'snatch suspenso': 'lpo-snatch-suspenso',
  'hang snatch': 'lpo-snatch-suspenso',
  'snatch chao': 'lpo-snatch-chao',
  snatch: 'lpo-snatch-chao',
  arranco: 'lpo-snatch-chao',
  'clean chao': 'lpo-clean-chao',
  clean: 'lpo-clean-chao',
  'power clean': '0648',
  jerk: 'lpo-jerk',
  'split jerk': 'lpo-jerk',
  'tripla extensao': 'lpo-tripla-extensao',
  'auxiliar snatch': 'lpo-auxiliar-snatch',
  stiff: '0116',
  'agachamento frontal': '0042',
  'agachamento costas': '0043',
  bulgaro: '0410',
  'agachamento bulgaro': '0410',
  'gemeos maquina': '0605',
  gemeos: '0605',
  'barra fixa supinada': '1326',
  'supino reto': '0025',
  'remada curvada': '0027',
  'supino inclinado halteres': '0314',
  'desenvolvimento barra': '1457',
  'levantamento terra': '0032',
  terra: '0032',
  'mesa flexora': '0586',
  'rosca direta': '0031',
  'triceps corda': '0200',
}

const NAMES: { id: string; tokens: string[]; len: number }[] = [...CURATED, ...LPO_DEFS].map((c) => {
  const t = tokens(c.pt)
  return { id: c.id, tokens: t, len: t.length }
})

export type MatchHow = 'apelido' | 'nome'

export function matchExercise(name: string): { id: string; how: MatchHow } | null {
  const k = key(name)
  if (!k) return null
  if (ALIASES[k]) return { id: ALIASES[k], how: 'apelido' }
  const q = k.split(' ')
  const hits = NAMES.filter((n) => q.every((t) => n.tokens.includes(t))).sort((a, b) => a.len - b.len)
  return hits.length ? { id: hits[0].id, how: 'nome' } : null
}

/** Palpite de grupo para um exercício criado a partir de um nome que não casou. */
export function guessGroup(name: string): MuscleGroup {
  const n = key(name)
  const rules: [RegExp, MuscleGroup][] = [
    [/snatch|clean|terra|stiff|flexora|posterior/, 'posteriores'],
    [/agach|leg|extensora|afundo|bulgaro|passada/, 'quadriceps'],
    [/supino|crucifixo|peito|flexao/, 'peito'],
    [/remada|puxada|barra fixa|pulldown|costas/, 'costas'],
    [/jerk|desenvolvimento|elevacao lateral|ombro/, 'ombros'],
    [/rosca|biceps/, 'biceps'],
    [/triceps|frances|mergulho/, 'triceps'],
    [/gemeo|panturrilha/, 'panturrilhas'],
    [/gluteo|pelvica/, 'gluteos'],
    [/encolhimento|trapezio/, 'trapezio'],
  ]
  return rules.find(([re]) => re.test(n))?.[1] ?? 'abdomen'
}

/** Id estável para um exercício próprio criado a partir de um nome. */
export const customId = (name: string) => `custom-${tokens(name).join('-').slice(0, 48) || 'exercicio'}`
