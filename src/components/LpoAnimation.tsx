import { useEffect, useState, type CSSProperties } from 'react'
import type { LpoAnimation as LpoId } from '../data/lpo'
import { GROUND, LEN, SEQUENCES, cycleMs, poseAt, skeleton, type Pose } from './lpoPoses'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function Figure({ pose }: { pose: Pose }) {
  const s = skeleton(pose)
  const line = (a: [number, number], b: [number, number], w = 4.5) => (
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} />
  )
  const [back, front] = s.legs
  return (
    <>
      <line x1={4} y1={GROUND} x2={116} y2={GROUND} stroke="var(--color-line)" strokeWidth={1.5} />
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* perna de trás e braço mais apagados dão profundidade */}
        <g opacity={0.45}>
          {line(s.hip, back.knee)}
          {line(back.knee, back.ankle)}
          {line(back.ankle, back.toe, 3.5)}
        </g>
        {line(s.hip, front.knee)}
        {line(front.knee, front.ankle)}
        {line(front.ankle, front.toe, 3.5)}
        {line(s.hip, s.shoulder, 6)}
        {line(s.shoulder, s.elbow, 3.5)}
        {line(s.elbow, s.hand, 3.5)}
      </g>
      <circle cx={s.head[0]} cy={s.head[1]} r={LEN.head} fill="currentColor" />
      {/* barra vista de lado: anilha em aro translúcido (no rack ela fica na frente do rosto) + ponta da barra */}
      <circle cx={s.hand[0]} cy={s.hand[1]} r={LEN.plate} fill="var(--color-accent)" fillOpacity={0.3} stroke="var(--color-accent)" strokeWidth={2.5} />
      <circle cx={s.hand[0]} cy={s.hand[1]} r={2.2} fill="var(--color-accent)" />
    </>
  )
}

/** Animação vetorial do app para os LPO (o dataset não tem esses movimentos). `still` = quadro fixo (miniaturas). */
export function LpoAnimation({
  id,
  still,
  className = '',
  style,
}: {
  id: LpoId
  still?: boolean
  className?: string
  style?: CSSProperties
}) {
  const seq = SEQUENCES[id] ?? SEQUENCES.snatch
  const animate = !still && !reducedMotion()
  const [ms, setMs] = useState(0)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      setMs(now - t0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, id])

  // parado: a posição de potência/extensão resume melhor o movimento que a pose inicial
  const pose = animate ? poseAt(seq.frames, ms) : seq.frames[Math.min(3, seq.frames.length - 1)][0]
  return (
    <svg
      viewBox="0 -20 120 136"
      role="img"
      aria-label={seq.caption}
      className={`bg-surface-2 text-ink ${className}`}
      style={style}
      data-cycle-ms={cycleMs(seq.frames)}
    >
      <Figure pose={pose} />
    </svg>
  )
}
