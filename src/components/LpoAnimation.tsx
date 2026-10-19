import { useEffect, useState, type CSSProperties } from 'react'
import type { LpoAnimation as LpoId } from '../data/lpo'
import { GROUND, LEN, SEQUENCES, cycleMs, farSide, frameAt, skeleton, type Leg, type Pose, type Pt, type Skeleton } from './lpoPoses'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Espessura dos segmentos (vista de lado, em unidades do viewBox). */
const W = { thigh: 9, shin: 7, foot: 4.5, torso: 13, upperArm: 6, forearm: 5, neck: 5.5 }

const Seg = ({ a, b, w }: { a: Pt; b: Pt; w: number }) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} />

function LegShape({ l, hip }: { l: Leg; hip: Pt }) {
  return (
    <>
      <Seg a={hip} b={l.knee} w={W.thigh} />
      <Seg a={l.knee} b={l.ankle} w={W.shin} />
      <Seg a={l.heel} b={l.toe} w={W.foot} />
      <Seg a={l.ankle} b={l.heel} w={W.foot} />
    </>
  )
}

/** Contorno na cor do fundo (separa braço de perna/tronco quando se cruzam). */
const HALO = 'var(--color-surface-2)'
const HALO_W = 3

/** Contorno só da coxa e da canela (pé no chão não precisa). */
const LegHalo = ({ l, hip }: { l: Leg; hip: Pt }) => (
  <>
    <Seg a={hip} b={l.knee} w={W.thigh + HALO_W} />
    <Seg a={l.knee} b={l.ankle} w={W.shin + HALO_W} />
  </>
)

const Arm = ({ s }: { s: Skeleton }) => (
  <>
    <Seg a={s.shoulder} b={s.elbow} w={W.upperArm} />
    <Seg a={s.elbow} b={s.hand} w={W.forearm} />
  </>
)

function Plate({ c, opacity = 1 }: { c: Pt; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <circle cx={c[0]} cy={c[1]} r={LEN.plate} fill="var(--color-accent)" fillOpacity={0.22} stroke="var(--color-accent)" strokeWidth={2.5} />
      <circle cx={c[0]} cy={c[1]} r={LEN.plate * 0.45} fill="none" stroke="var(--color-accent)" strokeWidth={1} opacity={0.6} />
      <circle cx={c[0]} cy={c[1]} r={2.4} fill="var(--color-accent)" />
    </g>
  )
}

export function Figure({ pose }: { pose: Pose }) {
  const s = skeleton(pose)
  const f = farSide(s)
  const ink = { stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  const feetX = [...s.legs.map((l) => l.heel[0]), ...s.legs.map((l) => l.toe[0])]
  return (
    <>
      {/* chão e sombra sob os pés */}
      <line x1={-4} y1={GROUND} x2={124} y2={GROUND} stroke="var(--color-line)" strokeWidth={1.5} />
      <ellipse cx={(Math.min(...feetX) + Math.max(...feetX)) / 2} cy={GROUND + 1.5} rx={(Math.max(...feetX) - Math.min(...feetX)) / 2 + 6} ry={2} fill="currentColor" opacity={0.12} />

      {/* lado de lá: anilha, eixo da barra, braço e pernas mais apagados */}
      <Plate c={s.barFar} opacity={0.45} />
      <line x1={s.barFar[0]} y1={s.barFar[1]} x2={s.bar[0] - 3} y2={s.bar[1] + 2} stroke="var(--color-muted)" strokeWidth={2.2} strokeLinecap="round" />
      <g {...ink} opacity={0.38}>
        <Arm s={f} />
        <LegShape l={f.legs[0]} hip={f.hip} />
        <LegShape l={f.legs[1]} hip={f.hip} />
      </g>

      {/* lado de cá; cada membro leva um contorno na cor do fundo para não se fundir com o que está atrás */}
      <g {...ink}>
        <Seg a={s.hip} b={s.shoulder} w={W.torso} />
        <Seg a={s.shoulder} b={s.neck} w={W.neck} />
      </g>
      <circle cx={s.head[0]} cy={s.head[1]} r={LEN.head} fill="currentColor" />
      <g {...ink} stroke={HALO}>
        <LegHalo l={s.legs[0]} hip={s.hip} />
      </g>
      <g {...ink}>
        <LegShape l={s.legs[0]} hip={s.hip} />
      </g>
      <g {...ink} stroke={HALO}>
        <LegHalo l={s.legs[1]} hip={s.hip} />
      </g>
      <g {...ink}>
        <LegShape l={s.legs[1]} hip={s.hip} />
      </g>
      <g {...ink} stroke={HALO}>
        <Seg a={s.shoulder} b={s.elbow} w={W.upperArm + HALO_W} />
        <Seg a={s.elbow} b={s.hand} w={W.forearm + HALO_W} />
      </g>
      <g {...ink}>
        <Arm s={s} />
      </g>
      <Plate c={s.bar} />
    </>
  )
}

/**
 * Animação vetorial do app para os LPO (o dataset não tem esses movimentos), com o nome da fase.
 * `still` = quadro fixo, sem legenda (miniaturas). Com "reduzir movimento" do sistema, também fica parada.
 */
export function LpoAnimation({ id, still, className = '', style }: { id: LpoId; still?: boolean; className?: string; style?: CSSProperties }) {
  const seq = SEQUENCES[id] ?? SEQUENCES.snatch
  const animate = !still && !reducedMotion()
  // começa parado na posição inicial (o ciclo abre com a volta do fim ao começo)
  const startAt = seq.frames[0][1]
  const [ms, setMs] = useState(startAt)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      setMs(startAt + now - t0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, id, startAt])

  // parado: a 2ª puxada (ou o 4º quadro) resume melhor o movimento que a pose inicial
  const fixed = seq.frames[Math.min(3, seq.frames.length - 1)]
  const { pose, label } = animate ? frameAt(seq.frames, ms) : { pose: fixed[0], label: fixed[3] }
  return (
    <span className={`relative block overflow-hidden bg-surface-2 text-ink ${className}`} style={style}>
      <svg viewBox="-6 -38 132 154" role="img" aria-label={seq.caption} className="block size-full" data-cycle-ms={cycleMs(seq.frames)}>
        <Figure pose={pose} />
      </svg>
      {!still && (
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-bg/80 px-1.5 py-0.5 text-[11px] font-semibold text-ink" aria-hidden>
          {label}
        </span>
      )}
    </span>
  )
}
