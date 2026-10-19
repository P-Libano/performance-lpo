/**
 * Cronômetro de descanso (porte do Chorão: presets, pausar/continuar). O estado guarda o horário de
 * término (sobrevive a recarregar a página e a tela apagada) ou, pausado, os segundos que faltavam.
 */

export interface TimerState {
  /** Fim do descanso (ms). Ausente = parado ou pausado. */
  until?: number
  /** Duração total (s), para a barra de progresso. */
  total?: number
  /** Pausado: segundos que faltavam. */
  pausedLeft?: number
}

/** Presets do Chorão: 1, 1,5, 2, 3 e 5 minutos. */
export const PRESETS_SEC = [60, 90, 120, 180, 300] as const

export const presetLabel = (s: number) => (s % 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s / 60} min`)

export const startTimer = (sec: number, now = Date.now()): TimerState => ({ until: now + sec * 1000, total: sec })

export const leftSec = (t: TimerState, now = Date.now()) =>
  t.pausedLeft !== undefined ? t.pausedLeft : t.until ? Math.max(0, Math.ceil((t.until - now) / 1000)) : 0

export function pauseTimer(t: TimerState, now = Date.now()): TimerState {
  if (!t.until) return t
  return { total: t.total, pausedLeft: leftSec(t, now) }
}

export function resumeTimer(t: TimerState, now = Date.now()): TimerState {
  if (t.pausedLeft === undefined) return t
  return { total: t.total, until: now + t.pausedLeft * 1000 }
}

/** ±segundos (pausado também); nunca abaixo de zero. */
export function nudgeTimer(t: TimerState, sec: number, now = Date.now()): TimerState {
  if (t.pausedLeft !== undefined) return { ...t, pausedLeft: Math.max(0, t.pausedLeft + sec) }
  if (!t.until) return t
  return { ...t, until: Math.max(now, t.until + sec * 1000) }
}

export const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
