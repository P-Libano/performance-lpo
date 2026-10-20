import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LEG, SEG } from '../body'
import { EXERCISES } from '../exercises'
import { MUSCLE_IDS, type MuscleId } from '../muscles'
import { PALETTE } from '../palette'
import { both, footFlat, mirrorFoot, mirrorZ, solve, type PoseSpec } from '../pose'
import type { PropSpec } from '../props'
import { cycleMs, sampleAt } from '../spec'
import { v } from '../vec'
import { AnimPlayer, stillMs } from './AnimPlayer'
import { DEFAULT_CAMERA, framePoints, makeCamera, viewBoxFor } from './camera'
import { Figure, MUSCLE_REGIONS } from './Figure'

const standing: PoseSpec = {
  pelvis: v(-1, SEG.ankleHeight + LEG.a + LEG.b - 0.5, 0),
  pitch: 0,
  hands: both(v(2, 86, 22), mirrorZ),
  feet: both(footFlat(0, 12), mirrorFoot),
}
const svg = (inner: string) => `<svg>${inner}</svg>`
const draw = (props: PropSpec[], muscles = { primary: [] as MuscleId[], secondary: [] as MuscleId[] }, camera = DEFAULT_CAMERA, pose = standing) =>
  renderToStaticMarkup(createElement(Figure, { skeleton: solve(pose), props, muscles, camera }))
const count = (html: string, s: string) => html.split(s).length - 1

describe('motor de desenho — exercícios', () => {
  it.each(EXERCISES.map((e) => [e.name, e] as const))('%s: desenha animado e parado sem erro', (_n, spec) => {
    const anim = renderToStaticMarkup(createElement(AnimPlayer, { spec }))
    expect(anim).toContain('<svg')
    expect(anim).toContain('gif-frame')
    expect(anim).toContain(sampleAt(spec, 0).phase) // legenda com a fase
    const still = renderToStaticMarkup(createElement(AnimPlayer, { spec, still: true }))
    expect(still).toContain('<svg')
    expect(still).not.toContain('rounded-md border') // miniatura sem legenda
    // quadro fixo cai numa pose-chave parada
    expect(sampleAt(spec, stillMs(spec)).holding).toBe(true)
  })

  it.each(EXERCISES.map((e) => [e.name, e] as const))('%s: nada sai do quadro em nenhum instante do ciclo', (_n, spec) => {
    const [x, y, w, h] = viewBoxFor(spec)
    expect(w).toBeCloseTo(h, 5)
    const cam = makeCamera(spec.camera ?? DEFAULT_CAMERA)
    for (let t = 0; t < cycleMs(spec); t += 25) {
      for (const [p, r] of framePoints(sampleAt(spec, t).skeleton, spec)) {
        const [px, py] = cam.project(p)
        expect(px - r).toBeGreaterThanOrEqual(x)
        expect(px + r).toBeLessThanOrEqual(x + w)
        expect(py - r).toBeGreaterThanOrEqual(y)
        expect(py + r).toBeLessThanOrEqual(y + h)
      }
    }
  })
})

describe('motor de desenho — aparelhos', () => {
  const PROPS: PropSpec[] = [
    { kind: 'barbell' },
    { kind: 'barbell', plates: 2 },
    { kind: 'dumbbells', axis: 'z' },
    { kind: 'dumbbells', axis: 'x' },
    { kind: 'bench', x0: -110, x1: 20 },
    { kind: 'bench', x0: -60, x1: 30, incline: { deg: 35, hingeX: 0 } },
    { kind: 'cable', pulley: v(60, 200, 0), handle: 'bar', column: { x: 70, z: 0 } },
    { kind: 'cable', pulley: v(60, 20, 0), handle: 'rope' },
    { kind: 'cable', pulley: v(0, 100, 80), handle: 'single' },
    { kind: 'pullupBar', x: 0, y: 228, halfLength: 60 },
    { kind: 'legPress', seat: { x0: -45, x1: 12, y: 50 }, back: { hingeX: -38, deg: 50 }, rail: 45 },
    { kind: 'legPress', seat: { x0: -45, x1: 5, y: 50 }, back: { hingeX: -30, deg: 35 }, rail: 45, handles: { x: -22, y: 58 } },
    { kind: 'latPulldown', seat: { x0: -30, x1: 18, y: 45 }, thighPad: { x: 30, y: 70 }, pulley: v(15, 232, 0), towerX: 88 },
    { kind: 'mat', x0: -100, x1: 100 },
  ]
  it('toda variação de aparelho desenha, e cabe no quadro', () => {
    const kinds = new Set<string>()
    for (const p of PROPS) {
      kinds.add(p.kind)
      const html = svg(draw([p]))
      expect(html.length).toBeGreaterThan(1000)
      expect(html).not.toMatch(/NaN|undefined/)
      const [x, y, w, h] = viewBoxFor({ frames: [{ pose: standing, moveMs: 1, holdMs: 1, phase: 'x' }], props: [p] })
      expect(w).toBeGreaterThan(0)
      expect(Number.isFinite(x + y + h)).toBe(true)
    }
    // todos os tipos de PropSpec cobertos
    expect([...kinds].sort()).toEqual(['barbell', 'bench', 'cable', 'dumbbells', 'latPulldown', 'legPress', 'mat', 'pullupBar'])
  })

  it('anilha do lado de lá é pintada antes do corpo e a do lado de cá depois (ordem por profundidade)', () => {
    const html = draw([{ kind: 'barbell' }])
    const plates = [...html.matchAll(new RegExp(`fill="${PALETTE.plate}"`, 'g'))].map((m) => m.index!)
    const torso = html.indexOf(`fill="${PALETTE.shorts}"`) // short do tronco/coxas
    expect(plates.length).toBe(2)
    expect(plates[0]).toBeLessThan(torso)
    expect(plates[1]).toBeGreaterThan(torso)
  })
})

describe('motor de desenho — músculos', () => {
  it('todo MuscleId tem região desenhável', () => {
    for (const id of MUSCLE_IDS) expect(MUSCLE_REGIONS[id]?.length, id).toBeGreaterThan(0)
  })

  it('cada músculo aparece em vermelho visto de frente ou de costas', () => {
    for (const id of MUSCLE_IDS) {
      const m = { primary: [id], secondary: [] }
      const seen = count(draw([], m), PALETTE.primary) + count(draw([], m, { yaw: 200, pitch: 12 }), PALETTE.primary)
      expect(seen, id).toBeGreaterThan(0)
    }
  })

  it('músculo da frente não aparece visto de costas e vice-versa', () => {
    const back = { yaw: 180, pitch: 0 }
    const front = { yaw: 0, pitch: 0 }
    expect(count(draw([], { primary: ['abdomen'], secondary: [] }, back), PALETTE.primary)).toBe(0)
    expect(count(draw([], { primary: ['eretores'], secondary: [] }, front), PALETTE.primary)).toBe(0)
    expect(count(draw([], { primary: ['abdomen'], secondary: [] }, front), PALETTE.primary)).toBeGreaterThan(0)
    expect(count(draw([], { primary: ['eretores'], secondary: [] }, back), PALETTE.primary)).toBeGreaterThan(0)
  })
})

describe('câmera', () => {
  it('padrão 3/4: o atleta olha para a direita da tela e o lado esquerdo dele fica mais perto', () => {
    const cam = makeCamera()
    expect(cam.project(v(10, 0, 0))[0]).toBeGreaterThan(0)
    expect(cam.depth(v(0, 0, 10))).toBeGreaterThan(0)
    expect(cam.project(v(0, 10, 0))[1]).toBeLessThan(0) // y do mundo para cima = para cima na tela
  })
})
