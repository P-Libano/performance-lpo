import { describe, expect, it } from 'vitest'
import { runChecks } from './checks'
import { supino } from './exercises/supino'
import { terra } from './exercises/terra'
import { both, mirrorZ, type PoseSpec } from './pose'
import type { ExerciseSpec } from './spec'
import { v } from './vec'

/**
 * Testes negativos: as verificações precisam REPROVAR poses erradas. Sem isso, "todos os testes passam"
 * não prova nada. Cada caso estraga um exercício de propósito e confere que a restrição certa acusa.
 */

const withPose = (spec: ExerciseSpec, name: string, change: (p: PoseSpec) => PoseSpec): ExerciseSpec => ({
  ...spec,
  frames: spec.frames.map((f) => (f.name === name ? { ...f, pose: change(f.pose) } : f)),
})
const names = (spec: ExerciseSpec) => runChecks(spec).map((f) => `${f.check}: ${f.message}`)

describe('as verificações reprovam poses erradas', () => {
  it('os exemplos corretos passam', () => {
    expect(names(terra)).toEqual([])
    expect(names(supino)).toEqual([])
  })

  it('terra: barra 15 cm à frente do meio do pé', () => {
    const bad = withPose(terra, 'Posição inicial', (p) => ({ ...p, hands: { L: [p.hands.L[0] + 15, p.hands.L[1], p.hands.L[2]], R: [p.hands.R[0] + 15, p.hands.R[1], p.hands.R[2]] } }))
    expect(names(bad).some((n) => n.startsWith('Barra sobre o meio do pé'))).toBe(true)
  })

  it('terra: travamento inclinando o tronco para trás', () => {
    const bad = withPose(terra, 'Travamento', (p) => ({ ...p, pitch: -15 }))
    expect(names(bad).some((n) => n.startsWith('Tronco vertical no travamento'))).toBe(true)
  })

  it('supino: cotovelos abertos a 90° (perpendiculares ao tronco)', () => {
    const bad = withPose(supino, 'Barra no peito', (p) => ({ ...p, elbowPole: both(v(0, -0.2, 1), mirrorZ) }))
    expect(names(bad).some((n) => n.startsWith('Cotovelos a 45–75° do tronco'))).toBe(true)
  })

  it('supino: corpo atravessando o banco', () => {
    const bad = withPose(supino, 'Barra no peito', (p) => ({ ...p, pelvis: v(p.pelvis[0], 30, 0) }))
    const n = names(bad)
    expect(n.some((x) => x.includes('dentro do banco'))).toBe(true)
    expect(n.some((x) => x.startsWith('Costas apoiadas no banco'))).toBe(true)
  })

  it('mão que não alcança a barra é acusada (braço "esticado" além do real)', () => {
    const bad = withPose(terra, 'Travamento', (p) => ({ ...p, hands: both(v(7, 40, 25), mirrorZ) }))
    expect(names(bad).some((n) => /mão \(L\) não alcança/.test(n))).toBe(true)
  })

  it('ficha incompleta é acusada (portão 1)', () => {
    const bad: ExerciseSpec = { ...terra, muscleSource: '', keyPoints: ['só um'], muscles: terra.muscles.slice(1) }
    const n = names(bad)
    expect(n).toContain('ficha: músculos sem fonte')
    expect(n).toContain('ficha: menos de 3 pontos técnicos')
    expect(n).toContain('ficha: fase "Puxada do chão" sem músculos')
  })
})
