import { useEffect, useRef, useState, type ReactNode } from 'react'
import { mediaUrl } from '../data/catalog'
import type { Exercise } from '../data/types'

type Part = NonNullable<Exercise['parts']>[number]
interface Frame {
  bmp: ImageBitmap
  ms: number
  part: number
}

/** Tempo por parte quando o navegador não decodifica GIF quadro a quadro (os GIFs do dataset têm 3–5 s). */
const FALLBACK_PART_MS = 5000

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-md border border-black/10 bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-800">
    {children}
  </span>
)

const label = (parts: Part[], i: number) => (parts.length > 1 ? `${i + 1}/${parts.length} · ${parts[i].label}` : parts[i].label)

/** Quadros de todos os GIFs, na ordem das partes. Null = sem ImageDecoder (Safari/iOS) ou falha. */
async function decodeAll(parts: Part[], signal: AbortSignal): Promise<Frame[] | null> {
  if (typeof ImageDecoder === 'undefined') return null
  const frames: Frame[] = []
  for (let p = 0; p < parts.length; p++) {
    const res = await fetch(mediaUrl(parts[p].gif), { signal, mode: 'cors' })
    if (!res.ok) throw new Error(`GIF ${res.status}`)
    const dec = new ImageDecoder({ data: await res.arrayBuffer(), type: 'image/gif' })
    await dec.tracks.ready
    const n = dec.tracks.selectedTrack?.frameCount ?? 0
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i })
      // duração do quadro em microssegundos; GIF sem duração conta 100 ms
      frames.push({ bmp: await createImageBitmap(image), ms: Math.max(20, (image.duration ?? 100_000) / 1000), part: p })
      image.close()
    }
    dec.close()
  }
  return frames
}

/**
 * Toca os GIFs das partes de um LPO em sequência (puxada → recepção…), cada um uma vez, em loop,
 * com o nome da parte. Mesma moldura branca dos GIFs do dataset. `onFail` = sem mídia (offline etc.).
 */
export function GifSequence({ parts, alt, className = '', onFail }: { parts: Part[]; alt: string; className?: string; onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'loading' | 'canvas' | 'img'>(parts.length > 1 ? 'loading' : 'img')
  const [part, setPart] = useState(0)

  // decodifica e toca no canvas
  useEffect(() => {
    if (parts.length < 2) return
    const ctl = new AbortController()
    let raf = 0
    let frames: Frame[] = []
    decodeAll(parts, ctl.signal)
      .then((fs) => {
        if (ctl.signal.aborted) return
        if (!fs?.length) return setMode('img')
        frames = fs
        setMode('canvas')
        let i = 0
        let shown = -1
        let t0 = performance.now()
        const tick = (now: number) => {
          while (now - t0 >= frames[i].ms) {
            t0 += frames[i].ms
            i = (i + 1) % frames.length
            if (now - t0 > 2000) t0 = now // aba voltou do segundo plano: não corre para alcançar
          }
          if (i !== shown) {
            const ctx = canvas.current?.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
              ctx.drawImage(frames[i].bmp, 0, 0, ctx.canvas.width, ctx.canvas.height)
            }
            shown = i
            setPart(frames[i].part)
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      })
      .catch(() => !ctl.signal.aborted && setMode('img'))
    return () => {
      ctl.abort()
      cancelAnimationFrame(raf)
      frames.forEach((f) => f.bmp.close())
    }
  }, [parts])

  // sem decodificador: alterna os GIFs por tempo
  useEffect(() => {
    if (mode !== 'img' || parts.length < 2) return
    const t = setInterval(() => setPart((p) => (p + 1) % parts.length), FALLBACK_PART_MS)
    return () => clearInterval(t)
  }, [mode, parts.length])

  return (
    <span className={`gif-frame relative block aspect-square w-full max-w-[360px] overflow-hidden rounded-xl ${className}`}>
      {mode === 'img' ? (
        <img key={part} src={mediaUrl(parts[part].gif)} alt={alt} width={180} height={180} onError={onFail} className="size-full object-contain" />
      ) : (
        <canvas ref={canvas} width={180} height={180} role="img" aria-label={alt} className="size-full" />
      )}
      {mode === 'loading' && <span className="absolute inset-0 grid place-items-center text-xs text-neutral-500">Carregando…</span>}
      {mode !== 'loading' && <Badge>{label(parts, part)}</Badge>}
    </span>
  )
}
