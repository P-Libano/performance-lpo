import { describe, expect, it } from 'vitest'
import { BAR, GROUND, HALF, LEN, MIDFOOT, RETURN_LABEL, SEQUENCES, VIEWBOX, cycleMs, dist, frameAt, gripFor, knee, outline, poseAt, rig, skeleton } from './lpoPoses'

const all = Object.entries(SEQUENCES)
const frame = (id: keyof typeof SEQUENCES, label: string) => SEQUENCES[id].frames.find((f) => f[3] === label)![0]
/** Distância horizontal entre a barra e o meio do pé da frente. */
const offMidfoot = (p: ReturnType<typeof frame>) => Math.abs(p.bar[0] - (p.front[0] + MIDFOOT))

describe('animações de LPO — geometria', () => {
  it('coxa, canela, braço e antebraço mantêm o comprimento em todos os quadros (e entre eles)', () => {
    for (const [, { frames }] of all) {
      const T = cycleMs(frames)
      for (let t = 0; t < T; t += 40) {
        const s = skeleton(poseAt(frames, t))
        for (const l of s.legs) {
          expect(dist(s.hip, l.knee)).toBeCloseTo(LEN.thigh, 1)
          expect(dist(l.knee, l.ankle)).toBeCloseTo(LEN.shin, 1)
          expect(l.toe[1]).toBe(GROUND)
        }
        expect(dist(s.shoulder, s.elbow)).toBeCloseTo(LEN.upperArm, 1)
        expect(dist(s.elbow, s.hand)).toBeCloseTo(LEN.forearm, 1)
      }
    }
  })

  it('quadros-chave ao alcance: a barra fica exatamente onde a pose diz (nenhuma pede braço maior que o real)', () => {
    for (const [id, { frames }] of all) {
      for (const [p, , , label] of frames) {
        const s = skeleton(p)
        expect(dist(s.bar, p.bar), `${id} · ${label}`).toBeLessThan(0.01)
        expect(dist(s.hand, s.bar)).toBeLessThan(0.01)
      }
    }
  })

  it('entre quadros, a barra acompanha a mão em vez de se soltar', () => {
    for (const [, { frames }] of all) {
      const T = cycleMs(frames)
      for (let t = 0; t < T; t += 40) {
        const s = skeleton(poseAt(frames, t))
        expect(dist(s.elbow, s.bar)).toBeCloseTo(LEN.forearm, 1)
      }
    }
  })

  it('joelho sempre à frente da linha quadril–tornozelo', () => {
    expect(knee([46, 86], [60, 107])[0]).toBeGreaterThan(53)
  })
})

describe('animações de LPO — técnica', () => {
  it('arranco e clean começam com a anilha no chão', () => {
    for (const id of ['snatch', 'clean'] as const) {
      const p = SEQUENCES[id].frames[0][0]
      expect(GROUND - p.bar[1]).toBeCloseTo(LEN.plate, 0)
    }
  })

  it('a barra passa sobre o meio do pé no início, na 1ª puxada e nas recepções', () => {
    expect(offMidfoot(frame('snatch', 'Posição inicial'))).toBeLessThanOrEqual(3)
    expect(offMidfoot(frame('snatch', '1ª puxada'))).toBeLessThanOrEqual(3)
    expect(offMidfoot(frame('snatch', 'Recepção'))).toBeLessThanOrEqual(3)
    expect(offMidfoot(frame('snatch', 'Recuperação'))).toBeLessThanOrEqual(3)
    expect(offMidfoot(frame('jerk', 'Recuperação'))).toBeLessThanOrEqual(3)
  })

  it('na 1ª puxada as costas mantêm o ângulo e os ombros ficam à frente da barra', () => {
    const [setup, knee1] = [frame('snatch', 'Posição inicial'), frame('snatch', '1ª puxada')]
    expect(Math.abs(setup.torso - knee1.torso)).toBeLessThanOrEqual(6)
    for (const p of [setup, knee1]) expect(skeleton(p).shoulder[0]).toBeGreaterThan(p.bar[0])
  })

  it('na 2ª puxada o atleta estende tudo e sobe na ponta dos pés, com a barra rente ao quadril', () => {
    const p = frame('snatch', '2ª puxada')
    const s = skeleton(p)
    expect(p.front[1]).toBeGreaterThan(0)
    expect(dist(s.hip, s.legs[1].ankle)).toBeGreaterThan(LEN.thigh + LEN.shin - 2) // perna quase reta
    expect(Math.abs(p.bar[0] - p.hip[0])).toBeLessThanOrEqual(3)
  })

  it('recepções: arranco com a barra acima da cabeça em agachamento; clean com a barra nos ombros', () => {
    const sn = skeleton(frame('snatch', 'Recepção'))
    expect(sn.bar[1]).toBeLessThan(sn.head[1])
    expect(sn.hip[1]).toBeGreaterThan(sn.legs[1].knee[1]) // quadril abaixo do joelho
    const cl = skeleton(frame('clean', 'Recepção'))
    expect(Math.abs(cl.bar[1] - cl.shoulder[1])).toBeLessThan(4)
    expect(cl.elbow[0]).toBeGreaterThan(cl.shoulder[0]) // cotovelos à frente
  })

  it('jerk recebe em split: um pé à frente, outro atrás na ponta', () => {
    const p = frame('jerk', 'Recepção em split')
    expect(p.front[0]).toBeGreaterThan(p.back[0] + 25)
    expect(p.back[1]).toBeGreaterThan(0)
    expect(skeleton(p).bar[1]).toBeLessThan(skeleton(p).head[1])
  })
})

describe('animações de LPO — vista 3/4', () => {
  const ids = Object.keys(SEQUENCES) as (keyof typeof SEQUENCES)[]
  const d3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

  it('nada sai do quadro: corpo, barra e anilhas cabem no viewBox em todo o ciclo', () => {
    for (const id of ids) {
      const [x, y, w, h] = VIEWBOX[id]
      expect(w).toBeCloseTo(h, 5) // quadrado, como os GIFs
      const { frames } = SEQUENCES[id]
      for (let t = 0; t < cycleMs(frames); t += 30) {
        for (const [[px, py], r] of outline(rig(poseAt(frames, t), gripFor(id)))) {
          expect(px - r, id).toBeGreaterThanOrEqual(x)
          expect(px + r, id).toBeLessThanOrEqual(x + w)
          expect(py - r, id).toBeGreaterThanOrEqual(y)
          expect(py + r, id).toBeLessThanOrEqual(y + h)
        }
      }
    }
  })

  it('as mãos ficam na barra, entre os colares, com a pegada certa (arranco larga, clean/jerk na largura dos ombros)', () => {
    for (const id of ids) {
      const { frames } = SEQUENCES[id]
      for (let t = 0; t < cycleMs(frames); t += 40) {
        const r = rig(poseAt(frames, t), gripFor(id))
        for (const sd of [r.far, r.near]) {
          expect(Math.hypot(sd.hand[0] - r.s.bar[0], sd.hand[1] - r.s.bar[1])).toBeLessThan(0.01)
          expect(Math.abs(sd.hand[2])).toBeLessThan(BAR.collar)
          expect(Math.abs(sd.hand[2])).toBeGreaterThan(HALF.shoulder)
        }
      }
    }
    expect(gripFor('snatch')).toBeGreaterThan(gripFor('clean') + 8)
  })

  it('o giro dos cotovelos é contínuo (o cotovelo passa pelo lado, sem pular)', () => {
    for (const id of ids) {
      const { frames } = SEQUENCES[id]
      // passo curto: um movimento rápido (a puxada por baixo) anda ~5 em 8 ms; um pulo de solução anda > 12
      for (let t = 0; t < cycleMs(frames); t += 8) {
        const [a, b] = [rig(poseAt(frames, t)), rig(poseAt(frames, t + 8))]
        expect(d3(a.near.elbow, b.near.elbow), `${id} @${t}`).toBeLessThan(8)
      }
    }
    // nas poses-chave, o cotovelo 3D coincide com o do perfil
    const s = rig(frame('clean', 'Recepção'))
    expect(s.near.elbow[0]).toBeCloseTo(s.s.elbow[0], 5)
    expect(s.near.elbow[1]).toBeCloseTo(s.s.elbow[1], 5)
  })

  it('no rack o cotovelo fica à frente e um pouco abaixo do ombro (não apontando para cima)', () => {
    for (const p of [frame('clean', 'Recepção'), frame('jerk', 'Rack')]) {
      const s = skeleton(p)
      const ang = (Math.atan2(s.elbow[1] - s.shoulder[1], s.elbow[0] - s.shoulder[0]) * 180) / Math.PI
      expect(ang).toBeGreaterThan(10) // abaixo da horizontal (y do SVG cresce para baixo)
      expect(ang).toBeLessThan(60)
    }
  })
})

describe('animações de LPO — tempo e fases', () => {
  it('toda fase tem nome e a volta ao início é identificada', () => {
    for (const [, { frames }] of all) {
      expect(frames.every((f) => f[3].length > 0)).toBe(true)
      expect(frameAt(frames, 10).label).toBe(RETURN_LABEL)
      expect(frameAt(frames, frames[0][1] + 10).label).toBe(frames[0][3])
    }
  })

  it('a puxada é rápida e a recuperação é lenta (como no movimento real)', () => {
    const f = SEQUENCES.snatch.frames
    const pull = f.find((x) => x[3] === '2ª puxada')![1] + f.find((x) => x[3] === 'Puxada por baixo')![1]
    expect(pull).toBeLessThan(500)
    expect(f.find((x) => x[3] === 'Recuperação')![1]).toBeGreaterThan(pull)
  })

  it('o ciclo fecha e a barra não dá saltos entre quadros', () => {
    for (const [, { frames }] of all) {
      const T = cycleMs(frames)
      expect(poseAt(frames, 0).bar[0]).toBeCloseTo(poseAt(frames, T).bar[0], 5)
      for (let t = 0; t < T; t += 16) expect(dist(skeleton(poseAt(frames, t)).bar, skeleton(poseAt(frames, t + 16)).bar)).toBeLessThan(6)
    }
  })
})
