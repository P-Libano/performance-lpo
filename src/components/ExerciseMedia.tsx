import { useState } from 'react'
import { publishedStills, stillUrl } from '../anim/stills'
import { APP_NAME } from '../brand'
import { MEDIA_ATTRIBUTION, mediaUrl } from '../data/catalog'
import { LPO_BY_ID, type LpoAnimation as LpoId } from '../data/lpo'
import type { Exercise } from '../data/types'
import { AnimStills } from './AnimStills'
import { GifPlayer } from './GifPlayer'
import { LpoAnimation } from './LpoAnimation'

/** Miniatura (jpg) para listas. */
export function ExerciseThumb({ exercise, size = 56 }: { exercise: Exercise; size?: number }) {
  const [failed, setFailed] = useState(false)
  // animação própria revisada: a pose do meio, já gerada como imagem
  const own = publishedStills(exercise.id)
  if (own) {
    return (
      <img
        src={stillUrl(own.stills[own.thumb].src)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="gif-frame shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  // LPO: miniatura do dataset (1ª parte); sem ela, quadro da animação própria
  if (exercise.animation && (failed || !exercise.image)) {
    return <LpoAnimation id={exercise.animation as LpoId} still className="shrink-0 rounded-lg" style={{ width: size, height: size }} />
  }
  if (failed || !exercise.image) {
    // CDN pode recusar (limite de taxa) ou estar offline sem cache
    return (
      <div
        aria-hidden
        className="grid shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" className="size-1/2" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  return (
    <img
      onError={() => setFailed(true)}
      src={mediaUrl(exercise.image)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="gif-frame shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size }}
    />
  )
}

/** GIF de execução com a atribuição exigida pela licença da mídia (Gym visual). */
export function ExerciseGif({ exercise, className = '' }: { exercise: Exercise; className?: string }) {
  const [failed, setFailed] = useState(false)
  const alt = `Execução: ${exercise.namePt ?? exercise.name}`
  // animação própria revisada (imagens do corpo 3D, uma por fase): substitui os GIFs do dataset
  const own = publishedStills(exercise.id)
  if (own) {
    return (
      <figure className={className}>
        <AnimStills stills={own.stills} alt={alt} />
        <figcaption className="mt-1 text-[10px] text-muted">Ilustração do {APP_NAME}</figcaption>
      </figure>
    )
  }
  // mesmo player para todos: GIF do dataset ou, nos LPO, os GIFs das partes do movimento em sequência
  const parts = exercise.parts?.length ? exercise.parts : exercise.gif ? [{ gif: exercise.gif, label: '' }] : []
  if (parts.length && !failed) {
    return (
      <figure className={className}>
        <GifPlayer parts={parts} alt={alt} onFail={() => setFailed(true)} />
        <figcaption className="mt-1 space-y-0.5 text-[10px] leading-snug text-muted">
          {LPO_BY_ID.get(exercise.id)?.mediaNote && <span className="block">{LPO_BY_ID.get(exercise.id)!.mediaNote}</span>}
          <a href="https://gymvisual.com/" target="_blank" rel="noreferrer" className="block hover:underline">
            {exercise.attribution || MEDIA_ATTRIBUTION}
          </a>
        </figcaption>
      </figure>
    )
  }
  // reserva: animação própria (GIFs indisponíveis, ex.: offline no primeiro acesso)
  if (exercise.animation) {
    return (
      <figure className={className}>
        <LpoAnimation id={exercise.animation as LpoId} className="aspect-square w-full max-w-[360px] rounded-xl" />
        <figcaption className="mt-1 text-[10px] text-muted">Animação ilustrativa do {APP_NAME} (GIF indisponível agora)</figcaption>
      </figure>
    )
  }
  if (!exercise.gif) {
    return (
      <figure className={className}>
        <div className="grid aspect-square w-full place-items-center rounded-xl bg-surface-2 px-3 text-center text-sm text-muted">
          Exercício próprio, sem GIF
        </div>
      </figure>
    )
  }
  return (
    <figure className={className}>
      <div className="grid aspect-square w-full place-items-center rounded-xl bg-surface-2 text-sm text-muted">GIF indisponível offline</div>
      <figcaption className="mt-1 text-[10px] text-muted">
        <a href="https://gymvisual.com/" target="_blank" rel="noreferrer" className="hover:underline">
          {exercise.attribution || MEDIA_ATTRIBUTION}
        </a>
      </figcaption>
    </figure>
  )
}
