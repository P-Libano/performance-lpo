import { SIDES, type Skeleton } from '../body'
import { cycleMs, sampleAt, type ExerciseSpec } from '../spec'
import { DEG, cross, dot, unit, v, type V3 } from '../vec'
import { shapePoints, shapesOf } from './propGeom'

/**
 * Câmera ortográfica 3/4, como os GIFs do dataset (Gym Visual).
 *
 * `yaw` = de onde a câmera olha, em graus em torno da vertical, medido a partir da frente do atleta (+x) para
 * a esquerda dele (+z): 0 = de frente, 90 = perfil esquerdo, 180 = de costas. `pitch` = elevação (graus).
 * O padrão (52°, 12°) é o 3/4 frontal-esquerdo dos GIFs: a anilha de cá fica embaixo à esquerda e o atleta
 * olha para a direita da tela.
 */
export interface CameraSpec {
  yaw: number
  pitch: number
}

export const DEFAULT_CAMERA: CameraSpec = { yaw: 52, pitch: 12 }

export type Pt = [number, number]

export interface Camera {
  spec: CameraSpec
  /** vetor unitário do mundo que aponta para a câmera */
  toCam: V3
  /** direções do mundo que viram "direita" e "para cima" na tela */
  right: V3
  up: V3
  /** mundo (cm) → tela (unidades do viewBox = cm; y da tela para baixo) */
  project: (p: V3) => Pt
  /** quanto mais alto, mais perto da câmera */
  depth: (p: V3) => number
}

export function toCam({ yaw, pitch }: CameraSpec): V3 {
  return v(Math.cos(yaw * DEG) * Math.cos(pitch * DEG), Math.sin(pitch * DEG), Math.sin(yaw * DEG) * Math.cos(pitch * DEG))
}

const cache = new Map<string, Camera>()

export function makeCamera(spec: CameraSpec = DEFAULT_CAMERA): Camera {
  const key = `${spec.yaw}|${spec.pitch}`
  const hit = cache.get(key)
  if (hit) return hit
  const t = toCam(spec)
  const right = unit(cross(v(0, 1, 0), t))
  const up = unit(cross(t, right))
  const cam: Camera = {
    spec,
    toCam: t,
    right,
    up,
    project: (p) => [dot(p, right), -dot(p, up)],
    depth: (p) => dot(p, t),
  }
  cache.set(key, cam)
  return cam
}

export type Box = [number, number, number, number]

/** Pontos (com raio) que precisam caber no quadro: corpo inteiro (com volume) e aparelhos. */
export function framePoints(s: Skeleton, spec: Pick<ExerciseSpec, 'props'>): [V3, number][] {
  const pts: [V3, number][] = [
    [s.pelvis, 18],
    [s.chest, 20],
    [s.neck, 9],
    [s.head, 15],
  ]
  for (const k of SIDES)
    for (const j of ['hip', 'knee', 'ankle', 'heel', 'toe', 'shoulder', 'elbow', 'wrist', 'hand'] as const)
      pts.push([s[j][k], j === 'shoulder' ? 11 : j === 'hip' ? 13 : 8])
  for (const p of spec.props) for (const sh of shapesOf(p, s)) for (const q of shapePoints(sh)) pts.push([q, 1])
  return pts
}

/**
 * Enquadramento quadrado do exercício, varrendo o ciclo inteiro: nada sai do quadro em nenhum quadro, e a
 * figura ocupa o máximo dele (cada GIF do dataset também é enquadrado no seu movimento).
 */
export function viewBoxFor(spec: Pick<ExerciseSpec, 'frames' | 'props' | 'camera'>, camera?: CameraSpec, stepMs = 40): Box {
  const cam = makeCamera(camera ?? spec.camera ?? DEFAULT_CAMERA)
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  const T = cycleMs(spec)
  for (let t = 0; t <= T; t += stepMs) {
    for (const [p, r] of framePoints(sampleAt(spec, t).skeleton, spec)) {
      const [x, y] = cam.project(p)
      x0 = Math.min(x0, x - r)
      x1 = Math.max(x1, x + r)
      y0 = Math.min(y0, y - r)
      y1 = Math.max(y1, y + r)
    }
  }
  const size = Math.max(x1 - x0, y1 - y0) * 1.06
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return [cx - size / 2, cy - size / 2, size, size].map((n) => Math.round(n * 10) / 10) as Box
}
