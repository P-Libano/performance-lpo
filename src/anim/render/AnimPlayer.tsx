import { useEffect, useMemo, useRef, useState } from 'react'
import { PALETTE } from '../palette'
import { cycleMs, musclesOf, sampleAt, type ExerciseSpec } from '../spec'
import { DEFAULT_CAMERA, viewBoxFor } from './camera'
import { Figure } from './Figure'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Instante do quadro fixo (miniatura, "reduzir movimento"): a pose-chave do meio do ciclo, parada. */
export function stillMs(spec: Pick<ExerciseSpec, 'frames'>): number {
  const i = Math.floor(spec.frames.length / 2)
  let t = 0
  for (let k = 0; k <= i; k++) t += spec.frames[k].moveMs + (k < i ? spec.frames[k].holdMs : 0)
  return t + Math.min(1, spec.frames[i].holdMs / 2)
}

/**
 * Player das animações próprias (mesma moldura e selo do GifPlayer): figura 3D desenhada a cada quadro,
 * músculos da fase em curso, nome da fase no canto. Toque pausa/retoma. `still` = quadro fixo sem legenda
 * (miniaturas). Com "reduzir movimento" do sistema, fica parado (com a legenda da fase).
 */
export function AnimPlayer({ spec, still, className = '', speed = 1 }: { spec: ExerciseSpec; still?: boolean; className?: string; speed?: number }) {
  const animate = !still && !reducedMotion()
  const vb = useMemo(() => viewBoxFor(spec).join(' '), [spec])
  const [ms, setMs] = useState(() => (animate ? 0 : stillMs(spec)))
  const [paused, setPaused] = useState(false)
  const clock = useRef({ offset: 0, pausedAt: null as number | null })
  // velocidade (revisão em câmera lenta no estúdio): o relógio é reescalado sem saltar de posição
  const speedRef = useRef(speed)
  useEffect(() => {
    const c = clock.current
    const now = performance.now()
    const t = ((c.pausedAt ?? now) - c.offset) * speedRef.current
    c.offset = (c.pausedAt ?? now) - t / speed
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    if (!animate) {
      setMs(stillMs(spec))
      return
    }
    let raf = 0
    clock.current = { offset: performance.now(), pausedAt: null }
    setPaused(false)
    const tick = (now: number) => {
      const c = clock.current
      setMs(((c.pausedAt ?? now) - c.offset) * speedRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, spec])

  const sample = sampleAt(spec, ms)
  const m = musclesOf(spec, sample.phase)
  const svg = (
    <svg viewBox={vb} role="img" aria-label={spec.name} className="block size-full" data-cycle-ms={cycleMs(spec)}>
      <Figure skeleton={sample.skeleton} props={spec.props} muscles={m} camera={spec.camera ?? DEFAULT_CAMERA} />
    </svg>
  )

  if (still)
    return (
      <span className={`gif-frame relative block overflow-hidden ${className}`} style={{ background: PALETTE.frame }}>
        {svg}
      </span>
    )

  const toggle = () => {
    if (!animate) return
    const c = clock.current
    const now = performance.now()
    if (c.pausedAt === null) c.pausedAt = now
    else {
      c.offset += now - c.pausedAt
      c.pausedAt = null
    }
    setPaused(c.pausedAt !== null)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={paused ? `Continuar: ${spec.name}` : `Pausar: ${spec.name}`}
      className={`gif-frame relative block aspect-square w-full overflow-hidden rounded-xl ${className}`}
      style={{ background: PALETTE.frame }}
    >
      {svg}
      {paused && (
        <span className="absolute inset-0 grid place-items-center bg-white/40">
          <span className="grid size-12 place-items-center rounded-full bg-neutral-900/70 text-xl text-white" aria-hidden>
            ▶
          </span>
        </span>
      )}
      <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-md border border-black/10 bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-800">
        {sample.phase}
      </span>
    </button>
  )
}
