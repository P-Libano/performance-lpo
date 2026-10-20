import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { BodyMap, REGIONS } from './BodyMap'
import { DATASET_MUSCLES, MUSCLE_IDS } from './muscles'

describe('mapa muscular', () => {
  it('todo músculo do app tem região em pelo menos uma vista', () => {
    for (const m of MUSCLE_IDS) expect(REGIONS[m].front.length + REGIONS[m].back.length, m).toBeGreaterThan(0)
  })

  it('todo nome de músculo do dataset está mapeado (vazio = de propósito, ex.: sistema cardiovascular)', () => {
    const names = new Set(loadFixtureCatalog().flatMap((e) => [e.target, e.muscleGroup, ...e.secondary].map((n) => n.toLowerCase())))
    expect([...names].filter((n) => !(n in DATASET_MUSCLES)).sort()).toEqual([])
  })

  it('desenha principais em vermelho e secundários em rosa, com descrição acessível', () => {
    const html = renderToStaticMarkup(createElement(BodyMap, { primary: ['gluteos'], secondary: ['eretores'] }))
    expect(html).toContain('#c8453b')
    expect(html).toContain('#eaa093')
    expect(html).toContain('Músculos principais: Glúteos. Secundários: Eretores da espinha.')
  })
})
