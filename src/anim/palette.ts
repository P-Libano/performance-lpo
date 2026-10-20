/**
 * Cores das animações e do mapa muscular (fixas: o quadro é branco nos dois temas, como os GIFs do dataset).
 * Mesmo código de cores dos GIFs da Gym Visual: músculo principal em vermelho, secundário em rosa.
 */
export const PALETTE = {
  frame: '#ffffff',
  skin: '#f4f2f0',
  skinFar: '#e4e1de',
  shade: '#d9d5d1',
  shadeFar: '#cbc7c3',
  line: '#8a8580',
  detail: '#c9c4bf',
  hair: '#3a3532',
  shorts: '#50555d',
  shortsFar: '#40444b',
  primary: '#c8453b',
  primaryLine: '#962c24',
  secondary: '#eaa093',
  secondaryLine: '#c97a6e',
  /** aparelhos */
  plate: '#2b2c2f',
  plateRim: '#161719',
  plateRing: '#424349',
  hub: '#a9afb6',
  bar: '#80868d',
  sleeve: '#abb1b8',
  metal: '#9aa0a7',
  metalDark: '#6b7178',
  pad: '#2f3237',
  padEdge: '#1d1f22',
  cable: '#3d4248',
  floor: '#e9ecef',
} as const

export type Level = 0 | 1 | 2
export const levelFill = (l: Level) => (l === 2 ? PALETTE.primary : l === 1 ? PALETTE.secondary : undefined)
