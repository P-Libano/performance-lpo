import { useState } from 'react'
import { APP_NAME } from '../brand'
import { MEDIA_ATTRIBUTION, mediaUrl } from '../data/catalog'
import type { LpoAnimation as LpoId } from '../data/lpo'
import type { Exercise } from '../data/types'
import { LpoAnimation } from './LpoAnimation'

/** Miniatura (jpg) para listas. */
export function ExerciseThumb({ exercise, size = 56 }: { exercise: Exercise; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (exercise.animation) {
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
  if (exercise.animation) {
    return (
      <figure className={className}>
        <LpoAnimation id={exercise.animation as LpoId} className="aspect-square w-full max-w-[360px] rounded-xl" />
        <figcaption className="mt-1 text-[10px] text-muted">Animação ilustrativa do {APP_NAME}</figcaption>
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
      {failed ? (
        <div className="grid aspect-square w-full place-items-center rounded-xl bg-surface-2 text-sm text-muted">
          GIF indisponível offline
        </div>
      ) : (
        <img
          src={mediaUrl(exercise.gif)}
          alt={`Execução: ${exercise.namePt ?? exercise.name}`}
          width={180}
          height={180}
          onError={() => setFailed(true)}
          className="gif-frame aspect-square w-full max-w-[360px] rounded-xl object-contain"
        />
      )}
      <figcaption className="mt-1 text-[10px] text-muted">
        <a href="https://gymvisual.com/" target="_blank" rel="noreferrer" className="hover:underline">
          {exercise.attribution || MEDIA_ATTRIBUTION}
        </a>
      </figcaption>
    </figure>
  )
}
