import { describe, expect, it } from 'vitest'
import { PRESETS_SEC, leftSec, mmss, nudgeTimer, pauseTimer, presetLabel, resumeTimer, startTimer } from './timer'

describe('cronômetro de descanso', () => {
  it('presets do Chorão', () => {
    expect(PRESETS_SEC.map(presetLabel)).toEqual(['1 min', '1m30s', '2 min', '3 min', '5 min'])
  })

  it('conta pelo horário de término', () => {
    const t = startTimer(90, 1_000)
    expect(t).toEqual({ until: 91_000, total: 90 })
    expect(leftSec(t, 31_000)).toBe(60)
    expect(leftSec(t, 200_000)).toBe(0)
    expect(mmss(leftSec(t, 31_000))).toBe('01:00')
  })

  it('pausa guarda o que falta e continuar retoma de onde parou', () => {
    const paused = pauseTimer(startTimer(120, 0), 50_000)
    expect(paused).toEqual({ total: 120, pausedLeft: 70 })
    expect(leftSec(paused, 999_999)).toBe(70)
    const resumed = resumeTimer(paused, 100_000)
    expect(resumed).toEqual({ total: 120, until: 170_000 })
    expect(leftSec(resumed, 110_000)).toBe(60)
  })

  it('±15s funciona rodando e pausado, sem passar de zero', () => {
    expect(nudgeTimer(startTimer(60, 0), 15, 0).until).toBe(75_000)
    expect(nudgeTimer({ pausedLeft: 10 }, -15)).toEqual({ pausedLeft: 0 })
    expect(nudgeTimer(startTimer(10, 0), -15, 5_000).until).toBe(5_000)
  })
})
