import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from './__fixtures__/load'
import { CURATED_BY_ID } from './curated'
import { LPO_BY_ID, LPO_EXERCISES } from './lpo'
import { customId, guessGroup, matchExercise } from './match'

const datasetIds = new Set(loadFixtureCatalog().map((e) => e.id))

/** Todos os nomes-base do plano inicial do Chorão V9.7. */
const CHORAO = [
  'Snatch Suspenso',
  'Tripla Extensão',
  'Stiff',
  'Agachamento Frontal',
  'Búlgaro',
  'Gêmeos na Máquina',
  'Clean do Chão',
  'Auxiliar do Snatch',
  'Barra Fixa Supinada',
  'Supino Reto',
  'Remada Curvada',
  'Supino Inclinado com Halteres',
  'Desenvolvimento com Barra',
  'Snatch do Chão',
  'Jerk',
  'Levantamento Terra',
  'Agachamento Costas',
  'Mesa Flexora',
  'Gêmeos',
  'Rosca Direta',
  'Tríceps na Corda',
]

describe('casamento de nomes com o catálogo', () => {
  it('todo exercício do Chorão casa com o dataset ou com um LPO próprio', () => {
    const unmatched = CHORAO.filter((n) => !matchExercise(n))
    expect(unmatched).toEqual([])
    for (const n of CHORAO) {
      const { id } = matchExercise(n)!
      expect(datasetIds.has(id) || LPO_BY_ID.has(id), `${n} → ${id}`).toBe(true)
    }
  })

  it('casa os levantamentos olímpicos com as entradas próprias', () => {
    expect(matchExercise('Snatch Suspenso')?.id).toBe('lpo-snatch-suspenso')
    expect(matchExercise('snatch do chao')?.id).toBe('lpo-snatch-chao')
    expect(matchExercise('Clean do Chão')?.id).toBe('lpo-clean-chao')
    expect(matchExercise('JERK')?.id).toBe('lpo-jerk')
    expect(matchExercise('Power Clean')?.id).toBe('0648')
  })

  it('ignora acento, caixa, preposições e anotações entre parênteses', () => {
    expect(matchExercise('Búlgaro (kg por mão)')?.id).toBe('0410')
    expect(matchExercise('agachamento frontal')?.id).toBe(CURATED_BY_ID.get('0042') && '0042')
  })

  it('casa pelo nome curado quando não há apelido', () => {
    expect(matchExercise('Crucifixo inclinado')).toEqual({ id: '0319', how: 'nome' })
    expect(matchExercise('Voador')?.id).toBe('0596')
  })

  it('devolve null quando nada casa', () => {
    expect(matchExercise('Arremesso de pneu')).toBeNull()
    expect(matchExercise('')).toBeNull()
  })

  it('gera id e grupo para exercícios próprios', () => {
    expect(customId('Arremesso de Pneu!')).toBe('custom-arremesso-pneu')
    expect(guessGroup('Remada no TRX')).toBe('costas')
    expect(guessGroup('Afundo andando')).toBe('quadriceps')
  })

  it('LPO próprios têm passo a passo em pt e animação, sem mídia do dataset', () => {
    for (const e of LPO_EXERCISES) {
      expect(e.id.startsWith('lpo-')).toBe(true)
      expect(e.stepsPt?.length).toBeGreaterThan(0)
      expect(e.animation).toBeTruthy()
      expect(e.gif).toBe('')
    }
  })
})
