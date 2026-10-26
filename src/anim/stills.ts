import manifest from './stills.json'

/**
 * Imagens paradas das animações próprias (uma por fase), geradas por `npm run anim:stills` no corpo 3D
 * (tools/render3d). O app lê só o manifesto: não carrega o motor de animação. stills.test.ts confere que o
 * manifesto está em dia com os exercícios (imagens, rótulos e status de revisão).
 */
export interface Still {
  /** caminho relativo à base do app (public/), ex.: "anim/lpo-clean-chao/1.webp" */
  src: string
  /** nome da pose (fase do movimento) */
  label: string
}
export interface StillSet {
  status: 'rascunho' | 'verificado' | 'revisado'
  /** índice da miniatura (a pose do meio do exercício) */
  thumb: number
  stills: Still[]
}

export const STILLS = manifest as Record<string, StillSet>

/** Imagens publicadas (exercício revisado) para um exercício do catálogo, se houver. */
export const publishedStills = (exerciseId: string): StillSet | undefined => {
  const s = STILLS[exerciseId]
  return s?.status === 'revisado' && s.stills.length ? s : undefined
}

export const stillUrl = (src: string) => import.meta.env.BASE_URL + src
