import { useEffect, useMemo, useRef, useState } from 'react'
import { mediaUrl } from '../data/catalog'
import type { Exercise } from '../data/types'
import { buildTimeline, partStart, sample, type Timeline } from './gifTimeline'

export type GifPart = Pick<NonNullable<Exercise['parts']>[number], 'gif' | 'label'>

interface Decoded {
  bmps: ImageBitmap[]
  frames: { ms: number; part: number }[]
  tl: Timeline
}

/** Tempo por parte quando o navegador não decodifica GIF quadro a quadro (os GIFs do dataset têm 3–5 s). */
const FALLBACK_PART_MS = 5000

/** Quadros de todos os GIFs, na ordem das partes. Null = navegador sem ImageDecoder (Safari/iOS). */
async function decodeAll(parts: GifPart[], signal: AbortSignal): Promise<Decoded | null> {
  if (typeof ImageDecoder === 'undefined') return null
  const bmps: ImageBitmap[] = []
  const frames: Decoded['frames'] = []
  try {
    for (let p = 0; p < parts.length; p++) {
      const res = await fetch(mediaUrl(parts[p].gif), { signal, mode: 'cors' })
      if (!res.ok) throw new Error(`GIF ${res.status}`)
      const dec = new ImageDecoder({ data: await res.arrayBuffer(), type: 'image/gif' })
      await dec.tracks.ready
      const n = dec.tracks.selectedTrack?.frameCount ?? 0
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i })
        bmps.push(await createImageBitmap(image))
        // duração em microssegundos; GIF sem duração conta 100 ms
        frames.push({ ms: Math.max(40, (image.duration ?? 100_000) / 1000), part: p })
        image.close()
      }
      dec.close()
    }
  } catch (e) {
    bmps.forEach((b) => b.close())
    throw e
  }
  return frames.length ? { bmps, frames, tl: buildTimeline(frames) } : null
}

/**
 * Player dos GIFs de exercício (padrão do app): movimento suave (cada quadro se funde no seguinte),
 * várias partes em sequência com transição e barra de progresso por parte (toque para ir à parte),
 * toque no GIF para pausar. Sem decodificador, cai no <img> do GIF (alternando as partes por tempo).
 * `onFail` = mídia indisponível (offline etc.).
 */
export function GifPlayer({ parts, alt, className = '', onFail }: { parts: GifPart[]; alt: string; className?: string; onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const bars = useRef<(HTMLSpanElement | null)[]>([])
  const clock = useRef({ offset: 0, pausedAt: null as number | null })
  const decoded = useRef<Decoded | null>(null)
  const [mode, setMode] = useState<'loading' | 'canvas' | 'img'>('loading')
  const [part, setPart] = useState(0)
  const [paused, setPaused] = useState(false)
  const key = useMemo(() => parts.map((p) => p.gif).join('|'), [parts])
  const multi = parts.length > 1

  useEffect(() => {
    const ctl = new AbortController()
    let raf = 0
    clock.current = { offset: performance.now(), pausedAt: null }
    setPaused(false)
    setPart(0)
    setMode('loading')
    decodeAll(parts, ctl.signal)
      .then((d) => {
        if (ctl.signal.aborted) return d?.bmps.forEach((b) => b.close())
        if (!d) return setMode('img')
        decoded.current = d
        setMode('canvas')
        let shownPart = -1
        const tick = (now: number) => {
          const ctx = canvas.current?.getContext('2d')
          const c = clock.current
          const t = (c.pausedAt ?? now) - c.offset
          const s = sample(d.tl, d.frames, t)
          if (ctx) {
            const { width: w, height: h } = ctx.canvas
            ctx.globalAlpha = 1
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, w, h)
            ctx.drawImage(d.bmps[s.a], 0, 0, w, h)
            if (s.mix > 0) {
              ctx.globalAlpha = s.mix
              ctx.drawImage(d.bmps[s.b], 0, 0, w, h)
            }
          }
          if (s.part !== shownPart) {
            shownPart = s.part
            setPart(s.part)
          }
          // progresso de cada parte direto no DOM (sem re-render a cada quadro)
          const tc = ((t % d.tl.total) + d.tl.total) % d.tl.total
          d.tl.parts.forEach((p, i) => {
            const el = bars.current[i]
            if (el) el.style.width = `${Math.min(100, Math.max(0, ((tc - p.start) / (p.end - p.start)) * 100))}%`
          })
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      })
      .catch(() => !ctl.signal.aborted && setMode('img'))
    return () => {
      ctl.abort()
      cancelAnimationFrame(raf)
      decoded.current?.bmps.forEach((b) => b.close())
      decoded.current = null
    }
    // `key` resume `parts` (o array muda de identidade a cada leitura do banco)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // sem decodificador: alterna os GIFs por tempo
  useEffect(() => {
    if (mode !== 'img' || !multi || paused) return
    const t = setInterval(() => setPart((p) => (p + 1) % parts.length), FALLBACK_PART_MS)
    return () => clearInterval(t)
  }, [mode, multi, paused, parts.length])

  const togglePause = () => {
    const c = clock.current
    const now = performance.now()
    if (c.pausedAt === null) c.pausedAt = now
    else {
      c.offset += now - c.pausedAt
      c.pausedAt = null
    }
    setPaused(c.pausedAt !== null)
  }

  const goTo = (p: number) => {
    if (mode === 'img') return setPart(p)
    const d = decoded.current
    if (!d) return
    const c = clock.current
    const now = c.pausedAt ?? performance.now()
    c.offset = now - partStart(d.tl, p)
  }

  return (
    <div className={`w-full max-w-[360px] ${className}`}>
      <button
        type="button"
        onClick={togglePause}
        aria-label={paused ? `Continuar: ${alt}` : `Pausar: ${alt}`}
        className="gif-frame relative block aspect-square w-full overflow-hidden rounded-xl"
      >
        {mode === 'img' ? (
          <img key={part} src={mediaUrl(parts[part].gif)} alt={alt} width={180} height={180} onError={onFail} className="size-full object-contain" />
        ) : (
          <canvas ref={canvas} width={360} height={360} role="img" aria-label={alt} className="size-full" />
        )}
        {mode === 'loading' && <span className="absolute inset-0 grid place-items-center text-xs text-neutral-500">Carregando…</span>}
        {paused && (
          <span className="absolute inset-0 grid place-items-center bg-white/40">
            <span className="grid size-12 place-items-center rounded-full bg-neutral-900/70 text-xl text-white" aria-hidden>
              ▶
            </span>
          </span>
        )}
        {multi && mode !== 'loading' && (
          <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-md border border-black/10 bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-800">
            {part + 1}/{parts.length} · {parts[part].label}
          </span>
        )}
      </button>
      {multi && (
        <div className="mt-1.5 flex gap-1" role="tablist" aria-label="Partes do movimento">
          {parts.map((p, i) => (
            <button
              key={p.gif + i}
              type="button"
              role="tab"
              aria-selected={i === part}
              aria-label={`Parte ${i + 1}: ${p.label}`}
              onClick={() => goTo(i)}
              className="flex-1 py-1.5"
            >
              <span className="block h-1 overflow-hidden rounded-full bg-line">
                <span
                  ref={(el) => {
                    bars.current[i] = el
                  }}
                  className="block h-full rounded-full bg-accent"
                  style={{ width: mode === 'img' ? (i === part ? '100%' : '0%') : '0%' }}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
