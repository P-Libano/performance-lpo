import { useEffect, useState } from 'react'
import { stillUrl, type Still } from '../anim/stills'

/** Tempo em cada imagem quando passa sozinho. */
const STILL_MS = 1800

/**
 * Imagens paradas da animação própria, uma por fase: passam sozinhas (com transição suave), toque na imagem
 * pausa, a barra de baixo vai para uma fase. Mesmo visual do player de GIFs (GifPlayer).
 */
export function AnimStills({ stills, alt, className = '' }: { stills: Still[]; alt: string; className?: string }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const multi = stills.length > 1

  useEffect(() => {
    if (!multi || paused) return
    const t = setTimeout(() => setI((x) => (x + 1) % stills.length), STILL_MS)
    return () => clearTimeout(t)
  }, [i, multi, paused, stills.length])

  return (
    <div className={`w-full max-w-[360px] ${className}`}>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? `Continuar: ${alt}` : `Pausar: ${alt}`}
        className="gif-frame relative block aspect-square w-full overflow-hidden rounded-xl"
      >
        {stills.map((s, k) => (
          <img
            key={s.src}
            src={stillUrl(s.src)}
            alt={k === i ? `${alt} — ${s.label}` : ''}
            aria-hidden={k !== i}
            width={480}
            height={480}
            decoding="async"
            loading={k === 0 ? 'eager' : 'lazy'}
            className="absolute inset-0 size-full object-contain transition-opacity duration-300"
            style={{ opacity: k === i ? 1 : 0 }}
          />
        ))}
        {paused && (
          <span className="absolute inset-0 grid place-items-center bg-white/40">
            <span className="grid size-12 place-items-center rounded-full bg-neutral-900/70 text-xl text-white" aria-hidden>
              ▶
            </span>
          </span>
        )}
        {multi && (
          <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-md border border-black/10 bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-800">
            {i + 1}/{stills.length} · {stills[i].label}
          </span>
        )}
      </button>
      {multi && (
        <div className="mt-1.5 flex gap-1" role="tablist" aria-label="Fases do movimento">
          {stills.map((s, k) => (
            <button key={s.src} type="button" role="tab" aria-selected={k === i} aria-label={`Fase ${k + 1}: ${s.label}`} onClick={() => setI(k)} className="flex-1 py-1.5">
              <span className="block h-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-accent" style={{ width: k <= i ? '100%' : '0%' }} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
