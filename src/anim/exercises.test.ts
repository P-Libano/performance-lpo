import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { runChecks } from './checks'
import { EXERCISES } from './exercises'

/**
 * Portão 2 do processo (docs/animacoes/PROCESSO.md): todo exercício com animação própria precisa passar na
 * ficha, nas verificações gerais (todos os quadros) e nas restrições específicas que declarou.
 */
const datasetIds = new Set(loadFixtureCatalog().map((e) => e.id))

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
