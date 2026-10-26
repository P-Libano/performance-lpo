import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EXERCISES } from './exercises'
import { stillFrames } from './spec'
import { STILLS } from './stills'

/**
 * As imagens do app (npm run anim:stills) precisam estar em dia com os exercícios: uma por pose de `stillFrames`,
 * com o rótulo certo, o arquivo em public/ e o mesmo status de revisão (o app decide pelo manifesto se publica).
 * Falhou? Rode `npm run anim:stills -- <id>` e confira as imagens no Estúdio.
 */
const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))

describe.each(EXERCISES.map((e) => [e.name, e] as const))('imagens do app: %s', (_n, spec) => {
  const set = STILLS[spec.id]

  it('foram geradas, uma por fase, com os rótulos das poses', () => {
    expect(set, `sem imagens: npm run anim:stills -- ${spec.id}`).toBeDefined()
    expect(set.stills.map((s) => s.label)).toEqual(stillFrames(spec).map((s) => s.name))
    expect(set.thumb).toBeGreaterThanOrEqual(0)
    expect(set.thumb).toBeLessThan(set.stills.length)
  })

  it('os arquivos existem', () => {
    for (const s of set?.stills ?? []) expect(existsSync(publicDir + s.src), s.src).toBe(true)
  })

  it('o status de revisão do manifesto é o do exercício', () => {
    expect(set?.status, `status mudou: npm run anim:stills -- ${spec.id}`).toBe(spec.review.status)
  })
})

it('não há imagens de exercício que não existe mais', () => {
  const ids = new Set(EXERCISES.map((e) => e.id))
  expect(Object.keys(STILLS).filter((id) => !ids.has(id))).toEqual([])
})
