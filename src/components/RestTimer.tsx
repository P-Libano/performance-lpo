import { useEffect, useRef, useState } from 'react'
import { PRESETS_SEC, leftSec, mmss, nudgeTimer, pauseTimer, presetLabel, resumeTimer, type TimerState } from '../domain/timer'

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.6)
  } catch {
    // sem áudio disponível: só vibração
  }
}

/** Fim do descanso: vibra (PWA no Android) e bipa (WebAudio). */
export function alertRestDone() {
  navigator.vibrate?.([200, 100, 200, 100, 400])
  beep()
}

/** Botões de preset (1 / 1,5 / 2 / 3 / 5 min). */
export function TimerPresets({ onPick, className = '' }: { onPick: (sec: number) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {PRESETS_SEC.map((s) => (
        <button key={s} onClick={() => onPick(s)} className="h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm font-medium hover:border-muted">
          {presetLabel(s)}
        </button>
      ))}
    </div>
  )
}

/**
 * Descanso: barra fixa sobre a navegação (no treino) ou cartão embutido (`inline`, em Ferramentas).
 * O estado vem de fora (na sessão, fica no banco e sobrevive a recarregar a página).
 */
export function RestTimer({ state, onChange, inline }: { state: TimerState; onChange: (s: TimerState) => void; inline?: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  const alerted = useRef<number | undefined>(undefined)
  const { until, total, pausedLeft } = state
  const paused = pausedLeft !== undefined

  useEffect(() => {
    if (!until) return
    setNow(Date.now()) // senão o primeiro quadro usa o horário de montagem
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [until])

  const left = leftSec(state, now)
  const done = !!until && !paused && until - now <= 0
  useEffect(() => {
    if (done && alerted.current !== until) {
      alerted.current = until
      alertRestDone()
      if (!inline) {
        const t = setTimeout(() => onChange({}), 4000)
        return () => clearTimeout(t)
      }
    }
  }, [done, until, onChange, inline])

  if (!until && !paused) return null
  const pct = total ? Math.min(100, Math.max(0, (1 - left / total) * 100)) : 0
  const btn = 'h-10 rounded-xl px-2.5 text-sm'

  const card = (
    <div
      className={`overflow-hidden rounded-2xl border ${inline ? '' : 'mx-auto max-w-xl shadow-xl shadow-black/50'} ${
        done ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-2'
      }`}
      role="timer"
      aria-live="polite"
    >
      {!done && <div className={`h-1 transition-[width] duration-200 ${paused ? 'bg-muted' : 'bg-accent'}`} style={{ width: `${pct}%` }} />}
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className={`text-xs ${done ? '' : 'text-muted'}`}>{done ? 'Descanso encerrado' : paused ? 'Pausado' : 'Descanso'}</p>
          <p className="display text-2xl font-bold">{done ? 'Bora!' : mmss(left)}</p>
        </div>
        {!done && (
          <>
            <button onClick={() => onChange(nudgeTimer(state, -15))} className={`${btn} bg-surface`} aria-label="Menos 15 segundos">
              −15
            </button>
            <button onClick={() => onChange(nudgeTimer(state, 15))} className={`${btn} bg-surface`} aria-label="Mais 15 segundos">
              +15
            </button>
            <button onClick={() => onChange(paused ? resumeTimer(state) : pauseTimer(state))} className={`${btn} bg-surface font-medium`}>
              {paused ? 'Continuar' : 'Pausar'}
            </button>
          </>
        )}
        <button onClick={() => onChange({})} className={`${btn} font-medium ${done ? 'bg-accent-ink/10' : 'bg-accent text-accent-ink'}`}>
          {done ? 'Fechar' : paused ? 'Zerar' : 'Pular'}
        </button>
      </div>
    </div>
  )
  if (inline) return card
  return <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-20 px-3 pb-2 print:hidden">{card}</div>
}
