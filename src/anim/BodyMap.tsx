import { MUSCLES, type MuscleId } from './muscles'
import { PALETTE, type Level } from './palette'

/**
 * Mapa muscular padrão do app (frente e costas): principal em vermelho, secundário em rosa — o mesmo código
 * de cores das animações e dos GIFs do dataset. Desenho próprio, esquemático; serve a todos os exercícios.
 */

type Shape = { kind: 'e'; cx: number; cy: number; rx: number; ry: number; rot?: number } | { kind: 'p'; d: string }

const e = (cx: number, cy: number, rx: number, ry: number, rot = 0): Shape => ({ kind: 'e', cx, cy, rx, ry, rot })
/** As duas metades do corpo: espelha em torno de x = 50. */
const pair = (cx: number, cy: number, rx: number, ry: number, rot = 0): Shape[] => [e(cx, cy, rx, ry, rot), e(100 - cx, cy, rx, ry, -rot)]

/** Regiões de cada músculo em cada vista (viewBox 0 0 100 200 por vista). */
export const REGIONS: Record<MuscleId, { front: Shape[]; back: Shape[] }> = {
  peitoral: { front: pair(40.5, 50, 9.5, 6.5, -8), back: [] },
  deltoide_anterior: { front: pair(30.5, 42, 5, 6.5, 15), back: [] },
  deltoide_lateral: { front: pair(26.8, 45, 3.5, 6.5, 10), back: pair(26.8, 45, 3.5, 6.5, 10) },
  deltoide_posterior: { front: [], back: pair(30.5, 42, 5, 6.5, 15) },
  biceps: { front: pair(25.9, 62, 4, 9.5, 6), back: [] },
  triceps: { front: [], back: pair(25.9, 62, 4.3, 10, 6) },
  antebraco: { front: pair(22.2, 85, 3.6, 11, 8), back: pair(22.2, 85, 3.6, 11, 8) },
  trapezio: { front: pair(41, 35.5, 6, 2.6, 18), back: [{ kind: 'p', d: 'M50 30 L60 37 L56 58 L50 66 L44 58 L40 37 Z' }] },
  dorsal: { front: [], back: pair(37.5, 64, 7.5, 13, -12) },
  romboides: { front: [], back: pair(45.5, 48, 3.6, 6.5) },
  eretores: { front: [], back: pair(46.6, 82, 2.6, 13) },
  abdomen: { front: [{ kind: 'p', d: 'M43.5 60 Q50 58 56.5 60 L56 90 Q50 94 44 90 Z' }], back: [] },
  obliquos: { front: pair(38.5, 77, 3.6, 10, 8), back: [] },
  gluteos: { front: [], back: pair(42, 104, 8.5, 8.5) },
  quadriceps: { front: pair(41, 127, 6.8, 19, 4), back: [] },
  posteriores: { front: [], back: pair(42, 131, 6.3, 17, 3) },
  adutores: { front: pair(46.8, 120, 2.6, 11, -6), back: pair(47.2, 122, 2.2, 9, -6) },
  panturrilhas: { front: pair(40.5, 160, 3.6, 11), back: pair(42, 159, 5, 12) },
}

/** Silhueta de base (pele), igual nas duas vistas. */
const BODY: Shape[] = [
  e(50, 14, 8.5, 10),
  { kind: 'p', d: 'M45 22 L55 22 L56 31 L44 31 Z' },
  // tronco
  { kind: 'p', d: 'M30 36 Q50 29 70 36 L69 60 Q66 80 64 96 Q50 103 36 96 Q34 80 31 60 Z' },
  // braços (encostados no tronco: sem vão entre as peças)
  ...pair(27, 44, 6.5, 8),
  ...pair(25.2, 63, 5, 12.5, 6),
  ...pair(22, 86, 4.2, 13, 8),
  ...pair(20.4, 101, 3.4, 4.2),
  // quadril e pernas
  { kind: 'p', d: 'M35 92 Q50 98 65 92 L66 108 Q50 114 34 108 Z' },
  ...pair(42, 128, 8.5, 22, 3),
  ...pair(42.5, 161, 5.5, 15),
  ...pair(42.8, 178, 4.2, 3.2),
]

function Draw({ s, fill, stroke, width = 0.6 }: { s: Shape; fill: string; stroke: string; width?: number }) {
  return s.kind === 'e' ? (
    <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} fill={fill} stroke={stroke} strokeWidth={width} />
  ) : (
    <path d={s.d} fill={fill} stroke={stroke} strokeWidth={width} strokeLinejoin="round" />
  )
}

function View({ side, level }: { side: 'front' | 'back'; level: (m: MuscleId) => Level }) {
  const ids = Object.keys(REGIONS) as MuscleId[]
  // secundários primeiro, principais por cima
  const order = [...ids].sort((a, b) => level(a) - level(b))
  return (
    <g>
      {BODY.map((s, i) => (
        <Draw key={i} s={s} fill={PALETTE.skin} stroke={PALETTE.line} />
      ))}
      {order.flatMap((m) => {
        const l = level(m)
        if (!l) return []
        return REGIONS[m][side].map((s, i) => (
          <Draw
            key={`${m}${i}`}
            s={s}
            fill={l === 2 ? PALETTE.primary : PALETTE.secondary}
            stroke={l === 2 ? PALETTE.primaryLine : PALETTE.secondaryLine}
            width={0.5}
          />
        ))
      })}
    </g>
  )
}

export function BodyMap({ primary, secondary, className = '' }: { primary: MuscleId[]; secondary: MuscleId[]; className?: string }) {
  const level = (m: MuscleId): Level => (primary.includes(m) ? 2 : secondary.includes(m) ? 1 : 0)
  const label = `Músculos principais: ${primary.map((m) => MUSCLES[m]).join(', ') || 'nenhum'}. Secundários: ${secondary.map((m) => MUSCLES[m]).join(', ') || 'nenhum'}.`
  return (
    <figure className={className}>
      <svg viewBox="0 0 210 206" role="img" aria-label={label} className="gif-frame block w-full rounded-xl" style={{ background: PALETTE.frame }}>
        <g transform="translate(2 2)">
          <View side="front" level={level} />
          <text x={50} y={203} textAnchor="middle" fontSize={7} fill="#6b7178">
            Frente
          </text>
        </g>
        <g transform="translate(108 2)">
          <View side="back" level={level} />
          <text x={50} y={203} textAnchor="middle" fontSize={7} fill="#6b7178">
            Costas
          </text>
        </g>
      </svg>
      <figcaption className="mt-1.5 space-y-0.5 text-xs">
        {primary.length > 0 && (
          <p>
            <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: PALETTE.primary }} aria-hidden />
            <span className="text-muted">Principais:</span> {primary.map((m) => MUSCLES[m]).join(', ')}
          </p>
        )}
        {secondary.length > 0 && (
          <p>
            <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: PALETTE.secondary }} aria-hidden />
            <span className="text-muted">Secundários:</span> {secondary.map((m) => MUSCLES[m]).join(', ')}
          </p>
        )}
      </figcaption>
    </figure>
  )
}
