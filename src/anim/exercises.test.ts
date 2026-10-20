import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { runChecks } from './checks'
import { EXERCISES } from './exercises'

/**
 * Portão 2 do processo (docs/animacoes/PROCESSO.md): todo exercício com animação própria precisa passar na
 * ficha, nas verificações gerais (todos os quadros) e nas restrições específicas que declarou.
 */
const datasetIds = new Set(loadFixtureCatalog().map((e) => e.id))

// Guarda contra "verde sem testar": todo arquivo de exercício na pasta precisa estar carregado em EXERCISES
// (um cache de módulos ou um arquivo sem `export default` deixaria o exercício de fora em silêncio).
it('todo arquivo de src/anim/exercises/ está cadastrado e foi testado', () => {
  const dir = fileURLToPath(new URL('./exercises/', import.meta.url))
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'))
  expect(EXERCISES.length, `arquivos: ${files.join(', ')}`).toBe(files.length)
})

describe.each(EXERCISES.map((e) => [e.name, e] as const))('animação: %s', (_name, spec) => {
  it('referência do dataset existe', () => {
    expect(datasetIds.has(spec.datasetId) || spec.datasetId.startsWith('lpo-')).toBe(true)
  })

  it('passa em todas as verificações', () => {
    const failures = runChecks(spec)
    // mensagem legível: o que falhou, onde e por quê
    expect(failures.map((f) => `[${f.check}] ${f.where}: ${f.message}`)).toEqual([])
  })
})
