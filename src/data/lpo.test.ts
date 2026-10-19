import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from './__fixtures__/load'
import { LPO_BY_ID, LPO_DEFS, LPO_EXERCISES, LPO_MEDIA_IDS, lpoWithMedia } from './lpo'

const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))

describe('mídia dos LPO (GIFs do dataset por partes)', () => {
  it('toda parte aponta para um exercício que existe no dataset', () => {
    expect(LPO_MEDIA_IDS.filter((id) => !byId.has(id))).toEqual([])
    expect([...LPO_MEDIA_IDS].sort()).toEqual(['0029', '0069', '0648', '0776', '0786'])
  })

  it('cada LPO tem ao menos uma parte e uma nota dizendo o que a montagem mostra', () => {
    for (const d of LPO_DEFS) {
      expect(d.parts.length, d.id).toBeGreaterThan(0)
      expect(d.mediaNote, d.id).toBeTruthy()
    }
  })

  it('montagens: snatch = puxada + overhead squat; clean = power clean + front squat; jerk = squat jerk', () => {
    const ids = (id: string) => LPO_BY_ID.get(id)!.parts.map((p) => p.id)
    expect(ids('lpo-snatch-chao')).toEqual(['0776', '0069'])
    expect(ids('lpo-snatch-suspenso')).toEqual(['0776', '0069'])
    expect(ids('lpo-clean-chao')).toEqual(['0648', '0029'])
    expect(ids('lpo-jerk')).toEqual(['0786'])
  })

  it('preenche GIF, miniatura, atribuição e partes a partir do catálogo, na ordem', () => {
    const snatch = lpoWithMedia((id) => byId.get(id)).find((e) => e.id === 'lpo-snatch-chao')!
    expect(snatch.parts).toEqual([
      { from: '0776', gif: byId.get('0776')!.gif, image: byId.get('0776')!.image, label: 'Puxada (snatch pull)' },
      { from: '0069', gif: byId.get('0069')!.gif, image: byId.get('0069')!.image, label: 'Recepção: agachamento overhead' },
    ])
    expect(snatch.image).toBe(byId.get('0776')!.image)
    expect(snatch.gif).toBe(byId.get('0776')!.gif)
    expect(snatch.animation).toBe('snatch') // reserva continua disponível
  })

  it('sem o catálogo (ainda não baixado), fica só a animação própria', () => {
    expect(lpoWithMedia(() => undefined)).toEqual(LPO_EXERCISES)
  })
})
