import type { ReactNode } from 'react'
import { SIDES, type Side, type Skeleton } from '../body'
import type { MuscleId } from '../muscles'
import { PALETTE as C, type Level } from '../palette'
import type { PropSpec } from '../props'
import { add, dot, len, lerp3, mul, reject, sub, unit, type V3 } from '../vec'
import { DEFAULT_CAMERA, makeCamera, type Camera, type CameraSpec, type Pt } from './camera'
import { blob, cone, frameOf, lightOf, lofted, patch, pathD, polyPts, seam, hull, type Frame3, type Prof, type Section } from './geom'
import { propPrims, type Prim } from './props'

/*
 * Corpo inteiro a partir do esqueleto 3D, no padrão dos GIFs do dataset (Gym Visual): figura anatômica clara
 * (pele quase branca, contorno cinza fino, sombra do lado oposto à luz), short cinza-escuro, pés descalços,
 * músculo principal em vermelho e secundário em rosa. Desenho próprio, gerado por geometria.
 *
 * Cada parte é um sólido simples (cilindros afunilados, esferas, tronco de elipses empilhadas). Músculos e
 * sombras são recortes da superfície, só na parte voltada para a câmera. Corpo e aparelhos viram peças com
 * profundidade, pintadas da mais longe para a mais perto: funciona em pé, deitado, sentado ou pendurado.
 */

const LINE = 0.7

// ───────── medidas do volume (cm, atleta de 175 cm) ─────────
export const RADIUS = { hip: 9.5, thighMid: 9, knee: 6.3, calf: 6, ankle: 3.7, delt: 7, arm: 5.4, elbow: 4.2, fore: 4.6, wrist: 3.1, hand: 3.9, neck: 6.2, skull: 8.8, jaw: 5.7 }
const R = RADIUS

/** Tronco: elipses empilhadas da pelve (u = 0) à linha dos ombros (u = 1); glúteo atrás, peito à frente. */
const TORSO: Section[] = [
  { u: -0.12, rN: 8.2, rL: 12, c: -0.9 },
  { u: 0.05, rN: 10.2, rL: 14.3, c: -1.8 },
  { u: 0.42, rN: 8.2, rL: 12.6, c: 0.3 },
  { u: 0.72, rN: 10.8, rL: 16, c: 1.9 },
  { u: 0.93, rN: 8.8, rL: 18.4, c: 0.3 },
  { u: 1.06, rN: 6.4, rL: 10.8, c: -0.9 },
]
const TORSO_PROF = lofted(TORSO)

// ───────── músculos: onde cada um fica ─────────

export type Part = 'torso' | 'upperArm' | 'forearm' | 'thigh' | 'shin'

/**
 * Região de um músculo na superfície de uma parte: faixa u0..u1 ao longo do eixo e ângulo (0 = frente da
 * parte; nos membros +90 = lado de fora; no tronco +90 = lado esquerdo) ± meia-abertura.
 */
export interface Region {
  part: Part
  u0: number
  u1: number
  ang: number
  half: number
}

const torso = (u0: number, u1: number, ang: number, half: number): Region => ({ part: 'torso', u0, u1, ang, half })
const both = (u0: number, u1: number, ang: number, half: number) => [torso(u0, u1, ang, half), torso(u0, u1, -ang, half)]

/** Todo músculo do app tem onde ser desenhado (verificado em teste). Frente: peitoral, abdômen, oblíquos, deltoide anterior; atrás: dorsal, romboides, eretores, trapézio, deltoide posterior, glúteos, posteriores. */
export const MUSCLE_REGIONS: Record<MuscleId, Region[]> = {
  peitoral: both(0.64, 0.93, 34, 32),
  deltoide_anterior: [{ part: 'upperArm', u0: -0.16, u1: 0.4, ang: 0, half: 60 }],
  deltoide_lateral: [{ part: 'upperArm', u0: -0.18, u1: 0.4, ang: 90, half: 50 }],
  deltoide_posterior: [{ part: 'upperArm', u0: -0.16, u1: 0.4, ang: 180, half: 60 }],
  biceps: [{ part: 'upperArm', u0: 0.32, u1: 0.9, ang: 0, half: 62 }],
  triceps: [{ part: 'upperArm', u0: 0.3, u1: 0.9, ang: 180, half: 70 }],
  antebraco: [{ part: 'forearm', u0: 0.05, u1: 0.72, ang: 40, half: 120 }],
  trapezio: [torso(0.8, 1.07, 180, 88)],
  dorsal: both(0.4, 0.88, 128, 34),
  romboides: [torso(0.66, 0.95, 180, 32)],
  eretores: [torso(0.1, 0.64, 180, 22)],
  abdomen: [torso(0.2, 0.64, 0, 26)],
  obliquos: both(0.2, 0.6, 66, 18),
  gluteos: [torso(-0.12, 0.22, 180, 80)],
  quadriceps: [{ part: 'thigh', u0: 0.2, u1: 0.93, ang: 0, half: 78 }],
  posteriores: [{ part: 'thigh', u0: 0.18, u1: 0.9, ang: 180, half: 66 }],
  adutores: [{ part: 'thigh', u0: 0.1, u1: 0.62, ang: -90, half: 40 }],
  panturrilhas: [{ part: 'shin', u0: 0.08, u1: 0.6, ang: 180, half: 82 }],
}

export interface MuscleSel {
  primary: readonly MuscleId[]
  secondary: readonly MuscleId[]
}

type Levels = Partial<Record<MuscleId, Level>>
const levelsOf = (m?: MuscleSel): Levels => {
  const out: Levels = {}
  for (const id of m?.secondary ?? []) out[id] = 1
  for (const id of m?.primary ?? []) out[id] = 2
  return out
}

function MusclePatch({ pts, level }: { pts: Pt[]; level?: Level }) {
  if (!level || pts.length < 3) return null
  const hot = level === 2
  return <path d={pathD(pts)} fill={hot ? C.primary : C.secondary} stroke={hot ? C.primaryLine : C.secondaryLine} strokeWidth={0.5} strokeLinejoin="round" opacity={0.93} />
}

/** Músculos de uma parte, nesta ordem (os de trás antes dos da frente não importa: só a parte visível aparece). */
function Muscles({ cam, part, f, prof, lv, skip }: { cam: Camera; part: Part; f: Frame3; prof: Prof; lv: Levels; skip?: (id: MuscleId) => boolean }) {
  const out: ReactNode[] = []
  for (const [id, regions] of Object.entries(MUSCLE_REGIONS) as [MuscleId, Region[]][]) {
    if (!lv[id] || skip?.(id)) continue
    regions.forEach((r, i) => {
      if (r.part === part) out.push(<MusclePatch key={`${id}${i}`} pts={patch(cam, f, prof, r.u0, r.u1, r.ang, r.half)} level={lv[id]} />)
    })
  }
  return <>{out}</>
}

const Detail = ({ pts }: { pts: Pt[] }) =>
  pts.length > 1 ? <polyline points={polyPts(pts)} fill="none" stroke={C.detail} strokeWidth={0.6} strokeLinecap="round" strokeLinejoin="round" /> : null

function Solid({ outline, fill, children }: { outline: Pt[]; fill: string; children?: ReactNode }) {
  return (
    <g>
      <path d={pathD(outline)} fill={fill} stroke={C.line} strokeWidth={LINE} strokeLinejoin="round" />
      {children}
    </g>
  )
}

interface Tone {
  skin: string
  shade: string
  shorts: string
}
const NEAR: Tone = { skin: C.skin, shade: C.shade, shorts: C.shorts }
const FAR: Tone = { skin: C.skinFar, shade: C.shadeFar, shorts: C.shortsFar }

/** Sombra em dois tons (meia-sombra larga e núcleo estreito) no lado oposto à luz. */
function Shading({ cam, f, prof, tone, u0 = 0, u1 = 1 }: { cam: Camera; f: Frame3; prof: Prof; tone: Tone; u0?: number; u1?: number }) {
  const s = prof((u0 + u1) / 2)
  const light = lightOf(cam)
  const away = Math.atan2(dot(f.L, light) / s.rL, dot(f.N, light) / s.rN) / (Math.PI / 180) + 180
  return (
    <>
      <path d={pathD(patch(cam, f, prof, u0, u1, away, 85, false))} fill={tone.shade} opacity={0.55} />
      <path d={pathD(patch(cam, f, prof, u0, u1, away, 40, false))} fill={tone.shade} />
    </>
  )
}

// ───────── partes ─────────

const sign = (k: Side) => (k === 'L' ? 1 : -1)

/** Direção para onde a articulação do meio dobra (joelho: para a frente; cotovelo: para trás). */
function bendDir(root: V3, mid: V3, tip: V3, fallback: V3): V3 {
  const axis = sub(tip, root)
  const off = reject(sub(mid, root), axis)
  return len(off) > 0.05 ? unit(off) : unit(reject(fallback, axis))
}

/** Perna do short: de um pouco acima da articulação do quadril (cobre a "tampa" da coxa) até 25% da coxa. */
const SHORTS = { from: -0.2, to: 0.25 }

/** Borda (bainha) visível de uma seção do membro: arco da frente visível. */
function hemArc(cam: Camera, f: Frame3, prof: Prof, u: number): Pt[] {
  const sec = prof(u)
  const vis = Math.atan2(dot(f.L, cam.toCam) / sec.rL, dot(f.N, cam.toCam) / sec.rN) / (Math.PI / 180)
  return Array.from({ length: 13 }, (_, i) => vis - 88 + (176 * i) / 12).map((a) =>
    cam.project(add(add(add(f.o, mul(f.A, u * f.len)), mul(f.N, sec.rN * Math.cos((a * Math.PI) / 180))), mul(f.L, sec.rL * Math.sin((a * Math.PI) / 180)))),
  )
}

function legPrims(cam: Camera, s: Skeleton, k: Side, lv: Levels, tone: Tone): Prim[] {
  const hip = s.hip[k]
  const knee = s.knee[k]
  const ankle = s.ankle[k]
  const outward = mul(s.left, sign(k))
  const kneeFwd = bendDir(hip, knee, ankle, s.front)
  const thighF = frameOf(hip, knee, kneeFwd, outward)
  const shinF = frameOf(knee, ankle, kneeFwd, outward)
  const thighP = cone(R.hip, R.knee)
  const shinP = cone(R.knee * 0.95, R.ankle)
  const quad = add(hip, add(mul(thighF.A, thighF.len * 0.42), mul(thighF.N, 1.6)))
  const calf = add(knee, add(mul(shinF.A, shinF.len * 0.3), mul(shinF.N, -2)))

  // pé descalço: perfil calcanhar → dedos, extrudado na largura do pé
  const heel = s.heel[k]
  const toe = s.toe[k]
  const fw = unit(sub(toe, heel))
  let up = reject(sub(ankle, heel), fw)
  up = len(up) > 0.1 ? unit(up) : unit(reject(s.up, fw))
  const fl = len(sub(toe, heel))
  const at = (along: number, h: number) => add(heel, add(mul(fw, along), mul(up, h)))
  const side = unit(reject(outward, fw))
  const profile: V3[] = [at(0.6, 0), at(-0.9, 2), at(0.3, 4.7), at(fl * 0.4, 5.3), at(fl * 0.75, 2.8), at(fl + 0.9, 1.3), at(fl, 0)]
  const foot = hull(profile.flatMap((q) => [cam.project(add(q, mul(side, -3.8))), cam.project(add(q, mul(side, 3.8)))]))

  const shin: Prim = {
    depth: cam.depth(lerp3(knee, ankle, 0.5)),
    ref: lerp3(knee, ankle, 0.5),
    node: (
      <Solid outline={blob(cam, [[knee, R.knee * 0.95], [calf, R.calf], [ankle, R.ankle]])} fill={tone.skin}>
        <Shading cam={cam} f={shinF} prof={shinP} tone={tone} />
        <Detail pts={seam(cam, shinF, shinP, 30, 0.12, 0.8)} />
        <Muscles cam={cam} part="shin" f={shinF} prof={shinP} lv={lv} />
      </Solid>
    ),
  }
  const footPrim: Prim = {
    depth: cam.depth(lerp3(heel, toe, 0.5)),
    ref: lerp3(heel, toe, 0.5),
    node: (
      <Solid outline={foot} fill={tone.skin}>
        <polyline points={polyPts([cam.project(at(fl * 0.78, 3)), cam.project(at(fl * 0.82, 0.3))])} stroke={C.detail} strokeWidth={0.6} />
      </Solid>
    ),
  }
  const thighMid = lerp3(hip, knee, 0.5)
  const thigh: Prim = {
    depth: cam.depth(thighMid),
    ref: thighMid,
    node: (
      <Solid outline={blob(cam, [[hip, R.hip], [quad, R.thighMid], [knee, R.knee]])} fill={tone.skin}>
        <Shading cam={cam} f={thighF} prof={thighP} tone={tone} />
        <Detail pts={seam(cam, thighF, thighP, 100, 0.3, 0.92)} />
        <Detail pts={seam(cam, thighF, thighP, -35, 0.45, 0.95)} />
        <Muscles cam={cam} part="thigh" f={thighF} prof={thighP} lv={lv} />
        {/* perna do short: faixa na SUPERFÍCIE da coxa (só a parte visível), até ~25% da coxa. Com a coxa
            apontando para a câmera ela vira um anel fino atrás do joelho, nunca um disco por cima dele. */}
        <path d={pathD(patch(cam, thighF, thighP, SHORTS.from, SHORTS.to, 0, 180, false))} fill={tone.shorts} />
        <polyline points={polyPts(hemArc(cam, thighF, thighP, SHORTS.to))} fill="none" stroke={C.line} strokeWidth={LINE} strokeLinecap="round" />
      </Solid>
    ),
  }
  // pé por cima da canela no tornozelo; coxa por cima da canela no joelho
  return [shin, { ...footPrim, depth: Math.max(footPrim.depth, shin.depth + 0.01) }, { ...thigh, depth: Math.max(thigh.depth, shin.depth + 0.02) }]
}

function armPrims(cam: Camera, s: Skeleton, k: Side, lv: Levels, tone: Tone): Prim[] {
  const sh = s.shoulder[k]
  const el = s.elbow[k]
  const wr = s.wrist[k]
  const hd = s.hand[k]
  const outward = mul(s.left, sign(k))
  // bíceps = lado oposto à dobra do cotovelo
  const front = mul(bendDir(sh, el, hd, mul(s.front, -1)), -1)
  const upF = frameOf(sh, el, front, outward)
  const foreF = frameOf(el, wr, front, outward)
  const upP = cone(R.arm, R.elbow)
  const foreP = cone(R.fore, R.wrist)
  const delt = add(sh, mul(upF.A, 3.6))
  const fore = add(el, add(mul(foreF.A, foreF.len * 0.3), mul(foreF.N, -0.9)))
  const upMid = lerp3(sh, el, 0.5)
  const foreMid = lerp3(el, wr, 0.5)
  const upper: Prim = {
    depth: cam.depth(upMid),
    ref: upMid,
    node: (
      <Solid outline={blob(cam, [[delt, R.delt], [upMid, R.arm], [el, R.elbow]])} fill={tone.skin}>
        <Shading cam={cam} f={upF} prof={upP} tone={tone} />
        <Detail pts={seam(cam, upF, upP, 70, 0.3, 0.85)} />
        <Muscles cam={cam} part="upperArm" f={upF} prof={upP} lv={lv} />
      </Solid>
    ),
  }
  const forearm: Prim = {
    depth: Math.max(cam.depth(foreMid), upper.depth + 0.01),
    ref: foreMid,
    node: (
      <Solid outline={blob(cam, [[el, R.elbow], [fore, R.fore], [wr, R.wrist]])} fill={tone.skin}>
        <Shading cam={cam} f={foreF} prof={foreP} tone={tone} />
        <Muscles cam={cam} part="forearm" f={foreF} prof={foreP} lv={lv} />
      </Solid>
    ),
  }
  // a mão fecha em volta da pegada: fica à frente da barra/halter que ela segura
  const hand: Prim = {
    depth: cam.depth(hd) + 3,
    ref: hd,
    node: <Solid outline={blob(cam, [[lerp3(wr, hd, 0.6), R.hand]])} fill={tone.skin} />,
  }
  return [upper, forearm, hand]
}

function torsoNode(cam: Camera, s: Skeleton, lv: Levels): ReactNode {
  const f = frameOf(s.pelvis, s.chest, s.front, s.left)
  const prof = TORSO_PROF
  const ring = (sec: Section) => Array.from({ length: 24 }, (_, i) => cam.project(add(add(add(f.o, mul(f.A, sec.u * f.len)), mul(f.N, sec.c + sec.rN * Math.cos((i * Math.PI) / 12))), mul(f.L, sec.rL * Math.sin((i * Math.PI) / 12)))))
  const outline = hull(TORSO.flatMap(ring))
  const shorts = hull([TORSO[0], TORSO[1], prof(0.22)].flatMap(ring))
  const P = (u: number, a: number) => cam.project(add(add(add(f.o, mul(f.A, u * f.len)), mul(f.N, prof(u).c + prof(u).rN * Math.cos((a * Math.PI) / 180))), mul(f.L, prof(u).rL * Math.sin((a * Math.PI) / 180))))
  const facing = (a: number, u: number) => {
    // ponto visível? (normal aproximada da elipse)
    const sec = prof(u)
    const n = add(mul(f.N, Math.cos((a * Math.PI) / 180) / sec.rN), mul(f.L, Math.sin((a * Math.PI) / 180) / sec.rL))
    return dot(n, cam.toCam) > 0
  }
  const arc = (u: number, angs: number[]) => (angs.every((a) => facing(a, u)) ? angs.map((a) => P(u, a)) : [])
  return (
    <Solid outline={outline} fill={C.skin}>
      <Shading cam={cam} f={f} prof={prof} tone={NEAR} u0={0} u1={1.06} />
      {/* linha alba, peitoral, abdômen, oblíquos e coluna: o "desenho anatômico" de base */}
      <Detail pts={seam(cam, f, prof, 0, 0.3, 0.7)} />
      <Detail pts={arc(0.7, [-60, -35, -10, 10, 35, 60])} />
      <Detail pts={arc(0.55, [-22, 0, 22])} />
      <Detail pts={arc(0.44, [-22, 0, 22])} />
      <Detail pts={seam(cam, f, prof, 58, 0.28, 0.62)} />
      <Detail pts={seam(cam, f, prof, -58, 0.28, 0.62)} />
      <Detail pts={seam(cam, f, prof, 180, 0.2, 0.9)} />
      <Detail pts={arc(0.78, [150, 120, 100])} />
      <Detail pts={arc(0.78, [-150, -120, -100])} />
      <Muscles cam={cam} part="torso" f={f} prof={prof} lv={lv} skip={(id) => id === 'gluteos'} />
      <path d={pathD(shorts)} fill={C.shorts} stroke={C.line} strokeWidth={LINE} strokeLinejoin="round" />
      {/* glúteo por cima do short (destaque "raio-x", como no dataset) */}
      <Muscles cam={cam} part="torso" f={f} prof={prof} lv={lv} skip={(id) => id !== 'gluteos'} />
    </Solid>
  )
}

function headNode(cam: Camera, s: Skeleton): ReactNode {
  const hu = unit(sub(s.head, s.neck))
  let fw = reject(s.front, hu)
  fw = len(fw) > 1e-3 ? unit(fw) : s.front
  const lat = s.left
  const r = R.skull
  const off = (a: number, b: number, c: number) => add(s.head, add(add(mul(fw, a), mul(hu, b)), mul(lat, c)))
  const jaw = off(3.4, -5.3, 0)
  // cabelo curto: calota de cima e de trás, só a parte voltada para a câmera
  const hair: Pt[] = []
  for (let i = 0; i <= 12; i++)
    for (let j = 0; j < 24; j++) {
      const th = (i / 12) * Math.PI
      const ph = (j / 24) * 2 * Math.PI
      const dir = add(add(mul(hu, Math.cos(th)), mul(fw, Math.sin(th) * Math.cos(ph))), mul(lat, Math.sin(th) * Math.sin(ph)))
      if (dot(dir, hu) + 0.75 * Math.max(0, -dot(dir, fw)) > 0.3 && dot(dir, cam.toCam) > -0.02) hair.push(cam.project(add(s.head, mul(dir, r * 1.05))))
    }
  const faceSide = dot(lat, cam.toCam) >= 0 ? 1 : -1 // olho e sobrancelha do lado que aparece
  const eye = cam.project(off(r * 0.8, 0.4, faceSide * 3.4))
  const neckF = frameOf(s.neck, s.head, fw, lat)
  return (
    <g>
      <Solid outline={blob(cam, [[sub(s.neck, mul(hu, 2)), R.neck + 0.3], [off(-0.7, -3.7, 0), R.neck]])} fill={C.skin}>
        <Shading cam={cam} f={neckF} prof={cone(R.neck, R.neck - 0.6)} tone={NEAR} />
      </Solid>
      <Solid outline={blob(cam, [[s.head, r], [jaw, R.jaw]])} fill={C.skin}>
        <path d={pathD(hull(hair))} fill={C.hair} />
        {SIDES.map((k) => (dot(mul(lat, sign(k)), cam.toCam) > 0.15 ? <Solid key={k} outline={blob(cam, [[off(-1.2, -0.9, sign(k) * r * 0.92), 2.2]])} fill={C.shade} /> : null))}
        {dot(fw, cam.toCam) > 0.05 && (
          <>
            <polyline
              points={polyPts([cam.project(off(r * 0.93, 1.2, faceSide * 2)), cam.project(off(r + 1.9, -2, faceSide * 2)), cam.project(off(r * 0.88, -3.1, faceSide * 2))])}
              fill={C.skin}
              stroke={C.line}
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
            <circle cx={eye[0]} cy={eye[1]} r={0.8} fill={C.hair} />
            <polyline points={polyPts([cam.project(off(r * 0.82, 2.3, faceSide * 1.8)), cam.project(off(r * 0.74, 2.6, faceSide * 4.8))])} fill="none" stroke={C.hair} strokeWidth={0.8} strokeLinecap="round" />
          </>
        )}
      </Solid>
    </g>
  )
}

// ───────── montagem e ordem de pintura ─────────

/** Ponto do eixo do tronco (pelve → pescoço) mais perto de `p`. */
function axisPoint(s: Skeleton, p: V3): V3 {
  const a = s.pelvis
  const ab = sub(s.neck, a)
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)))
  return add(a, mul(ab, t))
}

/**
 * Ordem de pintura. O tronco é o sólido grande: comparar só o centro dele com o de um braço erra (braço do
 * lado de lá estendido para cima no supino, por exemplo). Então cada peça é classificada como "atrás" ou "à
 * frente" do tronco pelo lado em que está em relação ao eixo dele (visto da câmera), e dentro de cada grupo
 * vai da mais longe para a mais perto.
 */
export function paintOrder(cam: Camera, s: Skeleton, prims: Prim[], torso: ReactNode, head: ReactNode): ReactNode[] {
  const behind: Prim[] = []
  const front: Prim[] = []
  for (const p of prims) {
    const off = reject(sub(p.ref, axisPoint(s, p.ref)), s.up)
    ;(dot(off, cam.toCam) >= 0 ? front : behind).push(p)
  }
  const headPrim: Prim = { depth: cam.depth(s.head), ref: s.head, node: head }
  const off = reject(sub(s.head, s.neck), s.up)
  ;(dot(off, cam.toCam) >= -2 ? front : behind).push(headPrim)
  const byDepth = (a: Prim, b: Prim) => a.depth - b.depth
  return [...behind.sort(byDepth).map((p) => p.node), torso, ...front.sort(byDepth).map((p) => p.node)]
}

export interface FigureProps {
  skeleton: Skeleton
  props?: readonly PropSpec[]
  muscles?: MuscleSel
  camera?: CameraSpec
}

/** Um quadro (vai dentro de um <svg viewBox={viewBoxFor(spec)}>). */
export function Figure({ skeleton: s, props = [], muscles, camera = DEFAULT_CAMERA }: FigureProps) {
  const cam = makeCamera(camera)
  const lv = levelsOf(muscles)
  const prims: Prim[] = []
  for (const k of SIDES) {
    const tone = dot(mul(s.left, sign(k)), cam.toCam) >= 0 ? NEAR : FAR
    prims.push(...legPrims(cam, s, k, lv, tone), ...armPrims(cam, s, k, lv, tone))
  }
  props.forEach((p, i) => prims.push(...propPrims(cam, p, s, `p${i}`)))
  const nodes = paintOrder(cam, s, prims, torsoNode(cam, s, lv), headNode(cam, s))
  return (
    <g strokeLinejoin="round">
      {nodes.map((n, i) => (
        <g key={i}>{n}</g>
      ))}
    </g>
  )
}
